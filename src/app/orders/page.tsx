import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getBudget } from '@/lib/budget'
import { formatCents } from '@/lib/money'
import { ApiError, fetchOrderHistory, isApiConfigured } from '@/lib/api'

type OrderLine = { itemId: string; name: string; quantity: number; totalCents: number }
type OrderView = { id: string; placedAt: Date | null; totalCents: number; lines: OrderLine[] }

export default async function OrdersPage() {
  const user = await getCurrentUser()
  if (!user?.userId) redirect('/login')

  const [orders, budget, error] = await loadOrders(user.userId)
  const spentCents = orders.reduce((total, order) => total + order.totalCents, 0)

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">My orders</h1>
      <p className="mt-1 text-sm text-stone-500">
        {budget?.source === 'api'
          ? 'Balance and history come straight from the furniture shop.'
          : 'Running on the local placeholder balance.'}
      </p>

      <dl className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Stat label="Orders placed" value={String(orders.length)} />
        <Stat label="Total spent" value={formatCents(spentCents)} />
        <Stat
          label="Remaining"
          value={budget ? formatCents(budget.remainingCents) : '—'}
          emphasis
        />
      </dl>

      {error && (
        <p role="alert" className="mt-6 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </p>
      )}

      {orders.length === 0 && !error ? (
        <p className="mt-10 text-stone-600">
          No orders yet.{' '}
          <Link href="/catalogue" className="underline underline-offset-2 hover:text-stone-900">
            Browse the catalogue
          </Link>{' '}
          to place your first one.
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {orders.map((order) => (
            <li key={order.id} className="rounded-lg border border-stone-200 bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-stone-500">
                  {order.placedAt
                    ? order.placedAt.toLocaleString('en-AU', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : 'Recently'}
                </p>
                <p className="font-semibold tabular-nums">{formatCents(order.totalCents)}</p>
              </div>
              <ul className="mt-2 text-sm text-stone-700">
                {order.lines.map((line, index) => (
                  <li key={`${order.id}-${index}`} className="flex justify-between gap-4">
                    <span>
                      {line.quantity} × {line.name}
                    </span>
                    <span className="tabular-nums text-stone-500">
                      {formatCents(line.totalCents)}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Order history, from the shop when it's configured, otherwise from our own
 * records. Returns any error as text rather than throwing, so a shop outage
 * still leaves the user with a readable page.
 */
async function loadOrders(
  userId: string,
): Promise<[OrderView[], Awaited<ReturnType<typeof getBudget>> | null, string | null]> {
  let budget = null
  let error: string | null = null

  try {
    budget = await getBudget(userId)
  } catch (e) {
    error = e instanceof ApiError ? e.userMessage : 'Could not load your balance.'
  }

  if (isApiConfigured()) {
    try {
      const apiOrders = await fetchOrderHistory()

      // The shop returns its own product ids; our local copy has the readable
      // names, so look them up in one query rather than per line.
      const itemIds = apiOrders.flatMap((o) => o.items.map((i) => i.itemId))
      const known = await db.product.findMany({
        where: { itemId: { in: itemIds } },
        select: { itemId: true, displayName: true, productName: true },
      })
      const names = new Map(
        known.map((p) => [p.itemId, p.displayName ?? p.productName]),
      )

      const orders: OrderView[] = apiOrders.map((o) => ({
        id: o.orderId,
        placedAt: o.placedAt ? new Date(o.placedAt) : null,
        totalCents: o.totalCents,
        lines: o.items.map((i) => ({
          itemId: i.itemId,
          name: names.get(i.itemId) ?? i.productName ?? i.itemId,
          quantity: i.quantity,
          totalCents: i.unitPriceCents * i.quantity,
        })),
      }))

      orders.sort((a, b) => (b.placedAt?.getTime() ?? 0) - (a.placedAt?.getTime() ?? 0))
      return [orders, budget, error]
    } catch (e) {
      error = e instanceof ApiError ? e.userMessage : 'Could not load your order history.'
    }
  }

  const localOrders = await db.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { items: { include: { product: true } } },
  })

  const orders: OrderView[] = localOrders.map((o) => ({
    id: o.id,
    placedAt: o.createdAt,
    totalCents: o.totalCents,
    lines: o.items.map((i) => ({
      itemId: i.itemId,
      name: i.product.displayName ?? i.product.productName,
      quantity: i.quantity,
      totalCents: i.unitPriceCents * i.quantity,
    })),
  }))

  return [orders, budget, error]
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        emphasis ? 'border-emerald-200 bg-emerald-50' : 'border-stone-200 bg-white'
      }`}
    >
      <dt className="text-sm text-stone-600">{label}</dt>
      <dd
        className={`mt-1 text-xl font-semibold tabular-nums ${emphasis ? 'text-emerald-900' : ''}`}
      >
        {value}
      </dd>
    </div>
  )
}
