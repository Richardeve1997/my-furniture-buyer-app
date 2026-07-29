import { db } from '@/lib/db'
import { fetchBalance, isApiConfigured } from '@/lib/api'

/**
 * How much the current user has left to spend.
 *
 * Once an organiser's key is in .env this comes from the furniture shop's API,
 * which is the only thing that actually knows the balance — it's decremented by
 * the shop when an order is placed, not by us.
 *
 * Before the key exists (and if it's ever removed) we fall back to the local
 * placeholder balance, so the app still runs rather than showing an error page.
 * That fallback is what Level 1 used.
 */

export type Budget = {
  remainingCents: number
  /** Where the number came from, so the UI can be honest about it. */
  source: 'api' | 'placeholder'
  /** Only known in placeholder mode — the API reports a balance, not a history. */
  startingCents?: number
  spentCents?: number
}

export async function getBudget(userId: string): Promise<Budget> {
  if (isApiConfigured()) {
    const balance = await fetchBalance()
    return { remainingCents: balance.balanceCents, source: 'api' }
  }
  return getPlaceholderBudget(userId)
}

async function getPlaceholderBudget(userId: string): Promise<Budget> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { placeholderBalanceCents: true },
  })

  if (!user) throw new Error(`No user with id ${userId}`)

  const spent = await db.order.aggregate({
    where: { userId, status: 'placed' },
    _sum: { totalCents: true },
  })

  const startingCents = user.placeholderBalanceCents
  const spentCents = spent._sum.totalCents ?? 0

  return {
    remainingCents: Math.max(0, startingCents - spentCents),
    source: 'placeholder',
    startingCents,
    spentCents,
  }
}

/**
 * Can this user afford this?
 *
 * Checked before we call the shop so the user gets a clear message instead of
 * a raw 402. The shop still enforces it independently — this is a courtesy,
 * not the actual guard.
 */
export async function canAfford(
  userId: string,
  costCents: number,
): Promise<{ ok: boolean; remainingCents: number; shortfallCents: number }> {
  const { remainingCents } = await getBudget(userId)
  const shortfallCents = Math.max(0, costCents - remainingCents)
  return { ok: shortfallCents === 0, remainingCents, shortfallCents }
}
