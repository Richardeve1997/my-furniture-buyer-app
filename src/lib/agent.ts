import {
  fetchBalance,
  fetchProduct,
  placeApiOrder,
  searchCatalogue,
  ApiError,
} from '@/lib/api'
import { db } from '@/lib/db'
import { formatCents } from '@/lib/money'

/**
 * The Level 3 agent.
 *
 * A small, fixed menu of four actions plus a model that reads what the user
 * typed and decides which to take. The model is GPT-5 mini via the event's
 * shared Azure AI deployment — not Claude, so this speaks the Azure OpenAI
 * chat-completions shape rather than the Anthropic Messages API.
 *
 * The one rule that shapes the whole design: `place_order` spends real money,
 * so the agent is never allowed to execute it. It can only *propose* an order;
 * the loop stops and hands the proposal to the UI, which asks the human. That
 * makes "confirm before spending" structural rather than something the model
 * has to remember to do.
 */

const ENDPOINT = (process.env.AZURE_OPENAI_ENDPOINT ?? '').replace(/\/$/, '')
const API_KEY = process.env.AZURE_OPENAI_API_KEY ?? ''
const DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-5-mini'
const API_VERSION = process.env.AZURE_OPENAI_API_VERSION ?? '2024-12-01-preview'

export function isAgentConfigured(): boolean {
  return Boolean(ENDPOINT && API_KEY && DEPLOYMENT)
}

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
}

/** An order the agent wants to place, waiting on a human yes. */
export type PendingOrder = {
  toolCallId: string
  itemId: string
  name: string
  priceCents: number
  quantity: number
}

export type AgentTurn = {
  messages: ChatMessage[]
  /** The agent's reply to show the user. */
  reply: string
  /** Set when the agent wants to spend money and needs confirmation. */
  pending?: PendingOrder
}

/**
 * Tool descriptions are deliberately honest about what the API cannot do.
 *
 * The catalogue search is an exact, case-insensitive category match — it has
 * no notion of price, colour, or "cheap". If a description implied otherwise,
 * the model would confidently ask the API for something it can't deliver and
 * we'd get a wrong answer instead of a clear one. So the descriptions say
 * plainly that filtering on anything else is the agent's own job.
 */
const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'search_catalogue',
      description:
        'List products from the furniture catalogue, optionally filtered by category. ' +
        'The category filter is an EXACT, case-insensitive match against a known category name — ' +
        'it cannot filter by price, colour, size, or vibe. To answer "cheap", "under $500", "blue", ' +
        'or "for a kid\'s room", call this for a plausible category (or with no category) and then ' +
        'filter and rank the returned results yourself. Call list_categories first if unsure of names.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Exact category name, e.g. "Chairs". Omit to browse everything.',
          },
          limit: {
            type: 'integer',
            description: 'How many products to return. Default 30, max 60.',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_categories',
      description:
        'List the exact category names the catalogue accepts. Use this before search_catalogue ' +
        'when the user names a kind of furniture and you are not certain of the exact category string.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'check_balance',
      description:
        "Get the current user's remaining balance. There is only ever one user — yours — so this " +
        'takes no arguments and cannot look anyone else up.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'place_order',
      description:
        'Propose buying one specific item for the current user. This SPENDS REAL MONEY. ' +
        'It does not complete the purchase on its own — it asks the human to confirm first, ' +
        'and they may decline. Only call it when the user has clearly asked to buy something ' +
        'specific. Check the balance first if you are unsure they can afford it.',
      parameters: {
        type: 'object',
        properties: {
          item_id: { type: 'string', description: 'The exact item_id from the catalogue.' },
          quantity: { type: 'integer', description: 'How many. Defaults to 1.' },
        },
        required: ['item_id'],
      },
    },
  },
]

const SYSTEM_PROMPT = `You are the shopping assistant inside a furniture buying app.

You help one person browse a real catalogue and spend a real, limited budget.

How to work:
- The catalogue search only matches exact category names. Any reasoning about price, colour, size or style is YOUR job, applied to the results you get back — never assume the API can do it.
- When the user gives a budget ("under $500"), search, then filter the results yourself and only show items that actually qualify.
- Recommend a small number of specific options with names and prices, not long lists.
- Prices you receive are in dollars. Always write them with a dollar sign.
- Before buying anything, be certain which specific item is meant. If the user says "buy the first one", that refers to the first item YOU listed in your previous message.
- Placing an order spends real money and always requires the human to confirm, so never claim an order is complete — say you have asked them to confirm.
- If something fails, explain it in plain language and suggest what to try instead.

Be brief and concrete. Two or three sentences is usually enough.`

type ToolResult = { output: string; pending?: PendingOrder }

/** Runs one tool. Never places an order — `place_order` only proposes one. */
async function runTool(
  name: string,
  args: Record<string, unknown>,
  toolCallId: string,
): Promise<ToolResult> {
  switch (name) {
    case 'list_categories': {
      const rows = await db.product.findMany({
        distinct: ['category'],
        select: { category: true },
        orderBy: { category: 'asc' },
      })
      return { output: JSON.stringify(rows.map((r) => r.category)) }
    }

    case 'search_catalogue': {
      const limit = Math.min(Number(args.limit ?? 30) || 30, 60)
      const category = typeof args.category === 'string' ? args.category : undefined
      const products = await searchCatalogue({ category, limit })

      // Swap in the readable names from our local copy — the API's
      // product_name is a generic descriptor like "Armchair".
      const local = await db.product.findMany({
        where: { itemId: { in: products.map((p) => p.itemId) } },
        select: { itemId: true, displayName: true },
      })
      const names = new Map(local.map((p) => [p.itemId, p.displayName]))

      return {
        output: JSON.stringify(
          products.map((p) => ({
            item_id: p.itemId,
            name: names.get(p.itemId) ?? p.productName,
            price: p.priceCents / 100,
            category: p.category,
            colours: p.colours,
          })),
        ),
      }
    }

    case 'check_balance': {
      const balance = await fetchBalance()
      return { output: JSON.stringify({ balance: balance.balanceCents / 100 }) }
    }

    case 'place_order': {
      const itemId = String(args.item_id ?? '')
      const quantity = Math.max(1, Number(args.quantity ?? 1) || 1)

      const local = await db.product.findUnique({
        where: { itemId },
        select: { displayName: true, productName: true, priceCents: true },
      })

      // Fall back to the shop if we don't hold the item locally.
      const priceCents = local?.priceCents ?? (await fetchProduct(itemId)).priceCents
      const name = local?.displayName ?? local?.productName ?? itemId

      return {
        output: JSON.stringify({
          status: 'awaiting_human_confirmation',
          item: name,
          total: (priceCents * quantity) / 100,
          note: 'The human has been asked to confirm. Do not claim the order is placed.',
        }),
        pending: { toolCallId, itemId, name, priceCents, quantity },
      }
    }

    default:
      return { output: JSON.stringify({ error: `Unknown tool ${name}` }) }
  }
}

async function callModel(messages: ChatMessage[]) {
  const url = `${ENDPOINT}/openai/deployments/${DEPLOYMENT}/chat/completions?api-version=${API_VERSION}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
      // GPT-5 models take max_completion_tokens; max_tokens is rejected.
      max_completion_tokens: 4000,
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Azure ${response.status}: ${detail.slice(0, 300)}`)
  }

  return response.json()
}

/**
 * Runs the agent until it produces a reply, wants to spend money, or hits the
 * step limit. The limit exists so a confused model can't loop forever on the
 * user's budget and latency.
 */
export async function runAgent(
  history: ChatMessage[],
  userMessage: string,
): Promise<AgentTurn> {
  const seed: ChatMessage[] = history.length
    ? history
    : [{ role: 'system', content: SYSTEM_PROMPT }]

  const messages: ChatMessage[] = [
    ...seed,
    { role: 'user', content: userMessage },
  ]

  for (let step = 0; step < 6; step += 1) {
    const data = await callModel(messages)
    const choice = data.choices?.[0]?.message

    if (!choice) {
      return { messages, reply: "The assistant didn't respond. Try again." }
    }

    messages.push({
      role: 'assistant',
      content: choice.content ?? null,
      tool_calls: choice.tool_calls,
    })

    if (!choice.tool_calls?.length) {
      return {
        messages,
        reply: choice.content ?? "I'm not sure how to help with that.",
      }
    }

    let pending: PendingOrder | undefined

    for (const call of choice.tool_calls) {
      let output: string
      try {
        const args = JSON.parse(call.function.arguments || '{}')
        const result = await runTool(call.function.name, args, call.id)
        output = result.output
        if (result.pending) pending = result.pending
      } catch (error) {
        // Hand the failure back to the model rather than throwing — it can
        // explain it, or try a different approach.
        const message =
          error instanceof ApiError
            ? error.userMessage
            : error instanceof Error
              ? error.message
              : 'Unknown error'
        console.error(`[agent] tool ${call.function.name} failed:`, message)
        output = JSON.stringify({ error: message })
      }

      messages.push({ role: 'tool', tool_call_id: call.id, content: output })
    }

    if (pending) {
      return {
        messages,
        // Plain text: bubbles are rendered as text, not markdown, and the
        // confirmation card below already emphasises the name and price.
        reply: `Just to confirm — buy ${pending.name} for ${formatCents(
          pending.priceCents * pending.quantity,
        )}?`,
        pending,
      }
    }
  }

  return {
    messages,
    reply: "I got stuck working that out. Could you rephrase what you're after?",
  }
}

/** Completes an order the human confirmed, and lets the agent respond to it. */
export async function confirmOrder(
  history: ChatMessage[],
  pending: PendingOrder,
  idempotencyKey: string,
): Promise<AgentTurn> {
  const messages = [...history]

  try {
    const placed = await placeApiOrder(pending.itemId, pending.quantity, idempotencyKey)

    return {
      messages,
      reply:
        `Done — ${pending.name} for ${formatCents(placed.totalCents)}. ` +
        `You have ${formatCents(placed.remainingBalanceCents)} left.`,
    }
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.userMessage
        : "Couldn't reach the furniture shop just now."
    console.error('[agent] order failed:', error)
    return { messages, reply: message }
  }
}
