import { dollarsToCents } from '@/lib/money'

/**
 * Client for the event's furniture-shop API.
 *
 * This is the only file that talks to the shop. Everything else in the app
 * calls these functions, so if the API changes shape, it changes here once.
 *
 * Two rules from the lab materials are enforced structurally rather than by
 * memory:
 *
 * 1. Browsing NEVER touches plain `GET /catalogue` — that endpoint embeds every
 *    product image as base64 (tens of MB, 20+ seconds, much stricter rate
 *    limit). There is deliberately no function here that calls it.
 * 2. We can only ever act as our own user, so `userId` is read from the
 *    environment rather than accepted as an argument. There is no way for a
 *    caller to ask about somebody else and get a 403.
 *
 * This module is server-side only. It isn't marked with the `server-only`
 * package because that makes it impossible to smoke-test from the terminal,
 * which is worth more today — and Next.js already refuses to expose any
 * environment variable to the browser unless it starts with NEXT_PUBLIC_,
 * so API_KEY cannot reach a client bundle regardless.
 */

const BASE_URL = process.env.API_BASE_URL ?? ''
const API_KEY = process.env.API_KEY ?? ''
const USER_ID = process.env.API_USER_ID ?? ''

/** True once an organiser's key is in .env. Lets pages degrade rather than crash. */
export function isApiConfigured(): boolean {
  return Boolean(BASE_URL && API_KEY && USER_ID)
}

export function currentApiUserId(): string {
  return USER_ID
}

/**
 * An API failure with the status attached, plus a message safe to show a user.
 *
 * The status codes come straight from the participant guide's error table.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    /** Wording intended for the person using the app, not for a log. */
    readonly userMessage: string,
    /** The raw detail from the API, for the terminal. */
    readonly detail?: string,
  ) {
    super(`${status}: ${detail ?? userMessage}`)
    this.name = 'ApiError'
  }
}

function friendlyMessage(status: number, detail?: string): string {
  switch (status) {
    case 401:
      return "The app isn't authenticated with the furniture shop. That's a setup problem on our side, not something you did."
    case 403:
      return "The app tried to act as a different account than the one it's allowed to use."
    case 404:
      return 'This item is no longer available.'
    case 402:
      return "That costs more than the balance left."
    case 429:
      return 'The furniture shop is asking us to slow down. Give it a few seconds and try again.'
    default:
      return detail
        ? `The furniture shop returned an error: ${detail}`
        : 'The furniture shop is not responding properly right now.'
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST'
  body?: unknown
  /** Extra headers, e.g. an Idempotency-Key. */
  headers?: Record<string, string>
  /** Next.js cache lifetime in seconds. 0 disables caching. */
  revalidate?: number
}

/**
 * One request, with a single automatic retry when the API asks us to back off.
 *
 * 429 is the only status worth retrying: the others are our mistake (401/403),
 * the user's situation (402), or a thing that doesn't exist (404), and retrying
 * any of those just makes the same call twice.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!isApiConfigured()) {
    throw new ApiError(
      401,
      friendlyMessage(401),
      'API_BASE_URL, API_KEY or API_USER_ID missing from .env',
    )
  }

  const { method = 'GET', body, headers = {}, revalidate = 0 } = options

  const send = () =>
    fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'X-Api-Key': API_KEY,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      next: { revalidate },
    })

  let response = await send()

  if (response.status === 429) {
    // The response tells us how long to wait; default to a small pause.
    const retryAfter = Number(response.headers.get('Retry-After') ?? 2)
    const waitMs = Math.min(Math.max(retryAfter, 1), 10) * 1000
    await new Promise((resolve) => setTimeout(resolve, waitMs))
    response = await send()
  }

  if (!response.ok) {
    let detail: string | undefined
    try {
      const parsed = await response.json()
      detail =
        typeof parsed?.detail === 'string'
          ? parsed.detail
          : JSON.stringify(parsed?.detail ?? parsed)
    } catch {
      detail = await response.text().catch(() => undefined)
    }
    throw new ApiError(response.status, friendlyMessage(response.status, detail), detail)
  }

  return (await response.json()) as T
}

// ---------------------------------------------------------------- catalogue

/** One product as the API returns it. Prices are dollars; we convert on the way in. */
type ApiProduct = {
  item_id: string
  product_name: string
  price: number
  category: string | null
  width: number | null
  height: number | null
  depth: number | null
  colours: string[] | null
  colour_count: number | null
  link: string | null
}

export type CatalogueProduct = {
  itemId: string
  productName: string
  priceCents: number
  category: string
  colours: string[]
  width: number | null
  height: number | null
  depth: number | null
  link: string | null
}

function toCatalogueProduct(p: ApiProduct): CatalogueProduct {
  return {
    itemId: p.item_id,
    productName: p.product_name,
    priceCents: dollarsToCents(p.price),
    category: p.category ?? 'Uncategorised',
    colours: p.colours ?? [],
    width: p.width,
    height: p.height,
    depth: p.depth,
    link: p.link,
  }
}

export async function fetchCategories(): Promise<string[]> {
  // The catalogue is static for the day, so this is worth caching.
  return request<string[]>('/catalogue/categories', { revalidate: 3600 })
}

/**
 * Browse products. This is the lightweight endpoint — no images.
 *
 * The category filter is an exact, case-insensitive string match. It cannot
 * do price, colour, or "something cheap for a kid's room"; that reasoning
 * happens over the results, in our code.
 */
export async function searchCatalogue(options: {
  category?: string
  limit?: number
  skip?: number
} = {}): Promise<CatalogueProduct[]> {
  const params = new URLSearchParams()
  if (options.category) params.set('category', options.category)
  params.set('limit', String(options.limit ?? 24))
  params.set('skip', String(options.skip ?? 0))

  const products = await request<ApiProduct[]>(
    `/catalogue/search-index?${params}`,
    { revalidate: 300 },
  )
  return products.map(toCatalogueProduct)
}

/**
 * Full detail for one product.
 *
 * Only call this for a product the user has already chosen — it's the heavy
 * endpoint that carries an image.
 */
export async function fetchProduct(itemId: string): Promise<CatalogueProduct> {
  const product = await request<ApiProduct>(
    `/catalogue/${encodeURIComponent(itemId)}`,
    { revalidate: 300 },
  )
  return toCatalogueProduct(product)
}

// ------------------------------------------------------------------ account

export type Balance = {
  userId: string
  name: string
  balanceCents: number
}

export async function fetchBalance(): Promise<Balance> {
  const user = await request<{ user_id: string; name: string; balance: number }>(
    `/users/${encodeURIComponent(USER_ID)}`,
  )
  return {
    userId: user.user_id,
    name: user.name,
    balanceCents: dollarsToCents(user.balance),
  }
}

export type PlacedOrder = {
  orderId: string
  status: string
  totalCents: number
  remainingBalanceCents: number
}

/**
 * Places a real order. This really spends real (event) money.
 *
 * Note the shape: the API takes an ARRAY of items. The participant guide's
 * example shows a single flat {user_id, item_id, quantity}, which the API
 * rejects — the OpenAPI spec is the accurate source here.
 *
 * `idempotencyKey` makes a repeated submission safe: if the user double-clicks
 * Buy, the shop recognises the retry instead of charging twice.
 */
export async function placeApiOrder(
  itemId: string,
  quantity: number,
  idempotencyKey: string,
): Promise<PlacedOrder> {
  const result = await request<{
    order_id: string
    status?: string
    total_price: number
    remaining_balance: number
  }>('/orders', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: {
      user_id: USER_ID,
      items: [{ item_id: itemId, quantity }],
    },
  })

  return {
    orderId: result.order_id,
    status: result.status ?? 'success',
    totalCents: dollarsToCents(result.total_price),
    remainingBalanceCents: dollarsToCents(result.remaining_balance),
  }
}

export type ApiOrderLine = {
  itemId: string
  productName: string | null
  quantity: number
  unitPriceCents: number
}

export type ApiOrder = {
  orderId: string
  totalCents: number
  placedAt: string | null
  items: ApiOrderLine[]
}

export async function fetchOrderHistory(): Promise<ApiOrder[]> {
  const orders = await request<
    Array<{
      order_id: string
      total_amount: number
      timestamp?: string | null
      items: Array<{
        product_id: string
        product_name?: string | null
        quantity: number
        unit_price: number
      }>
    }>
  >(`/orders/${encodeURIComponent(USER_ID)}`)

  return orders.map((o) => ({
    orderId: o.order_id,
    totalCents: dollarsToCents(o.total_amount),
    placedAt: o.timestamp ?? null,
    items: (o.items ?? []).map((i) => ({
      itemId: i.product_id,
      productName: i.product_name ?? null,
      quantity: i.quantity,
      unitPriceCents: dollarsToCents(i.unit_price),
    })),
  }))
}
