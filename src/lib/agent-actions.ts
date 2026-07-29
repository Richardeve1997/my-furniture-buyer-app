'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/session'
import {
  confirmOrder,
  isAgentConfigured,
  runAgent,
  type ChatMessage,
  type PendingOrder,
} from '@/lib/agent'

export type AgentResponse = {
  messages: ChatMessage[]
  reply: string
  pending?: PendingOrder
  error?: string
}

export async function askAgent(
  history: ChatMessage[],
  userMessage: string,
): Promise<AgentResponse> {
  const user = await getCurrentUser()
  if (!user?.userId) {
    return { messages: history, reply: '', error: 'Please log in first.' }
  }
  if (!isAgentConfigured()) {
    return {
      messages: history,
      reply: '',
      error: 'The assistant is not configured — no LLM endpoint in .env.',
    }
  }

  try {
    return await runAgent(history, userMessage)
  } catch (error) {
    console.error('[agent] turn failed:', error)
    return {
      messages: history,
      reply: '',
      error: "The assistant isn't responding right now. Try again in a moment.",
    }
  }
}

export async function confirmAgentOrder(
  history: ChatMessage[],
  pending: PendingOrder,
): Promise<AgentResponse> {
  const user = await getCurrentUser()
  if (!user?.userId) {
    return { messages: history, reply: '', error: 'Please log in first.' }
  }

  try {
    const turn = await confirmOrder(history, pending, randomUUID())
    revalidatePath('/catalogue')
    revalidatePath('/orders')
    return turn
  } catch (error) {
    console.error('[agent] confirm failed:', error)
    return {
      messages: history,
      reply: '',
      error: "Couldn't complete that order. Nothing was charged.",
    }
  }
}
