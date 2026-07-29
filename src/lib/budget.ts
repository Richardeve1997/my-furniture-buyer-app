import { db } from '@/lib/db'

/**
 * Budget calculation.
 *
 * The remaining balance is always *calculated* from the orders on record —
 * never stored as a running total. A stored total drifts out of sync after any
 * crash or bug, and then the number on screen is a lie you can't trace.
 *
 * In Lab 2 the starting balance stops coming from our own database and starts
 * coming from the furniture-shop API. Only `getBudget` needs to change.
 */

export type Budget = {
  /** What they started with, in cents. */
  startingCents: number
  /** What they've spent through this app, in cents. */
  spentCents: number
  /** What's left, in cents. Never negative. */
  remainingCents: number
}

export async function getBudget(userId: string): Promise<Budget> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { placeholderBalanceCents: true },
  })

  if (!user) {
    throw new Error(`No user with id ${userId}`)
  }

  const spent = await db.order.aggregate({
    where: { userId, status: 'placed' },
    _sum: { totalCents: true },
  })

  const startingCents = user.placeholderBalanceCents
  const spentCents = spent._sum.totalCents ?? 0

  return {
    startingCents,
    spentCents,
    remainingCents: Math.max(0, startingCents - spentCents),
  }
}

/** Can this user afford this? Used before an order is allowed through. */
export async function canAfford(
  userId: string,
  costCents: number,
): Promise<{ ok: boolean; remainingCents: number; shortfallCents: number }> {
  const { remainingCents } = await getBudget(userId)
  const shortfallCents = Math.max(0, costCents - remainingCents)
  return { ok: shortfallCents === 0, remainingCents, shortfallCents }
}
