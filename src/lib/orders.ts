'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { canAfford } from '@/lib/budget'
import { getCurrentUser } from '@/lib/session'
import { formatCents } from '@/lib/money'
import { ApiError, isApiConfigured, placeApiOrder } from '@/lib/api'

export type OrderResult = {
  ok: boolean
  message: string
  orderId?: string
  /** Shown after a successful order so the user sees the new balance immediately. */
  remainingCents?: number
}

/**
 * Places an order for one product.
 *
 * When the API is configured this really spends real (event) money — the shop
 * debits the balance. Every failure the participant guide lists is turned into
 * a sentence a person can act on, rather than a status code or a blank screen.
 */
export async function placeOrder(
  _previous: OrderResult | null,
  formData: FormData,
): Promise<OrderResult> {
  const user = await getCurrentUser()
  if (!user?.userId) {
    return { ok: false, message: 'Please log in before ordering.' }
  }

  const itemId = String(formData.get('itemId') ?? '')
  const quantity = Math.max(1, Number(formData.get('quantity') ?? 1))

  const product = await db.product.findUnique({
    where: { itemId },
    select: {
      itemId: true,
      productName: true,
      displayName: true,
      priceCents: true,
    },
  })
  if (!product) {
    return { ok: false, message: 'This item is no longer available.' }
  }

  const name = product.displayName ?? product.productName
  const expectedCents = product.priceCents * quantity

  // Courtesy check so the user gets a clear message instead of a raw 402.
  // The shop enforces this independently; this just gets in first.
  const { ok, remainingCents, shortfallCents } = await canAfford(
    user.userId,
    expectedCents,
  )

  if (!ok) {
    return {
      ok: false,
      message:
        `Not enough balance. ${name} costs ${formatCents(expectedCents)}, ` +
        `but you have ${formatCents(remainingCents)} left — ` +
        `${formatCents(shortfallCents)} short.`,
    }
  }

  if (!isApiConfigured()) {
    return placeLocalOrder(user.userId, product.itemId, quantity, expectedCents, name)
  }

  try {
    // A fresh key per submission. If the user double-clicks Buy, the browser
    // sends the same key twice and the shop treats the second as a retry
    // rather than a second purchase.
    const placed = await placeApiOrder(product.itemId, quantity, randomUUID())

    // Mirror the order locally so our own reports and history still work.
    await db.order.create({
      data: {
        userId: user.userId,
        totalCents: placed.totalCents,
        externalOrderId: placed.orderId,
        items: {
          create: [
            {
              itemId: product.itemId,
              quantity,
              unitPriceCents: Math.round(placed.totalCents / quantity),
            },
          ],
        },
      },
    })

    revalidatePath('/catalogue')
    revalidatePath('/orders')

    return {
      ok: true,
      orderId: placed.orderId,
      remainingCents: placed.remainingBalanceCents,
      message:
        `Ordered ${name} for ${formatCents(placed.totalCents)}. ` +
        `${formatCents(placed.remainingBalanceCents)} left.`,
    }
  } catch (error) {
    if (error instanceof ApiError) {
      // The shop rejected it. Say what happened in plain language; the raw
      // detail goes to the terminal, not to the person using the app.
      console.error(`[order] ${error.message}`)
      return { ok: false, message: error.userMessage }
    }
    console.error('[order] unexpected failure', error)
    return {
      ok: false,
      message:
        "Couldn't reach the furniture shop just now. Check your connection and try again.",
    }
  }
}

/** Level 1 behaviour, kept so the app still works without an API key. */
async function placeLocalOrder(
  userId: string,
  itemId: string,
  quantity: number,
  totalCents: number,
  name: string,
): Promise<OrderResult> {
  const order = await db.order.create({
    data: {
      userId,
      totalCents,
      items: {
        create: [{ itemId, quantity, unitPriceCents: totalCents / quantity }],
      },
    },
  })

  revalidatePath('/catalogue')
  revalidatePath('/orders')

  return {
    ok: true,
    orderId: order.id,
    message: `Ordered ${name} for ${formatCents(totalCents)}.`,
  }
}
