'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { canAfford } from '@/lib/budget'
import { getCurrentUser } from '@/lib/session'
import { formatCents } from '@/lib/money'

export type OrderResult = {
  ok: boolean
  message: string
  /** Set when the order succeeded, so the page can show a receipt. */
  orderId?: string
}

/**
 * Places an order for one product.
 *
 * In Lab 2 this stops writing only to our own database and starts calling
 * POST /orders on the real furniture-shop API, which really debits a real
 * balance. The overspend check below is what stops us getting a 402 back.
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
    // Excludes imageBase64 — ~65KB we'd never use here.
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

  // Match what the catalogue card shows, so the confirmation names the same
  // thing the user thought they clicked.
  const name = product.displayName ?? product.productName
  const totalCents = product.priceCents * quantity

  const { ok, remainingCents, shortfallCents } = await canAfford(
    user.userId,
    totalCents,
  )

  if (!ok) {
    return {
      ok: false,
      message:
        `Not enough balance. ${name} costs ${formatCents(totalCents)}, ` +
        `but you have ${formatCents(remainingCents)} left — ` +
        `${formatCents(shortfallCents)} short.`,
    }
  }

  const order = await db.order.create({
    data: {
      userId: user.userId,
      totalCents,
      items: {
        create: [
          {
            itemId: product.itemId,
            quantity,
            unitPriceCents: product.priceCents,
          },
        ],
      },
    },
  })

  // Refresh anything showing a balance or an order list.
  revalidatePath('/catalogue')
  revalidatePath('/orders')

  return {
    ok: true,
    orderId: order.id,
    message: `Ordered ${name} for ${formatCents(totalCents)}.`,
  }
}
