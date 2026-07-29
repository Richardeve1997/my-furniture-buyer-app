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
      <div className="section-title">
        <span aria-hidden className="text-h1">🧾</span>
        <div>
          <p className="eyebrow text-teal">
            {budget?.source === 'api'
              ? 'Straight from the furniture shop'
              : 'Local placeholder balance'}
          </p>
          <h1 className="headline text-h1 leading-tight">My orders</h1>
        </div>
      </div>

      <dl className="mt-7 grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Stat label="Orders placed" value={String(orders.length)} />
        <Stat label="Total spent" value={formatCents(spentCents)} />
        <Stat
          label="Remaining"
          value={budget ? formatCents(budget.remainingCents) : '—'}
          emphasis
        />
      </dl>

      {error && (
        <p role="alert" className="mt-8 rounded-md bg-coral/10 px-4 py-3 text-sm text-coral-dark">
          ⚠️ {error}
        </p>
      )}

      {orders.length === 0 && !error ? (
        <div className="mt-10 rounded-lg border-2 border-dashed border-teal/30 p-12 text-center">
          <p aria-hidden className="text-display leading-none">🪑</p>
          <p className="headline mt-3 text-h2">Nothing bought yet</p>
          <Link href="/catalogue" className="pill pill-gold mt-6">
            Go shopping
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {orders.map((order, index) => (
            <li
              key={order.id}
              className="game-card pop-in p-5"
              style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-dashed border-teal/25 pb-3">
                <p className="eyebrow text-ink-soft">
                  {order.placedAt
                    ? order.placedAt.toLocaleString('en-AU', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : 'Recently'}
                </p>
                <p className="numerals text-h2 font-extrabold text-teal-dark">
                  {formatCents(order.totalCents)}
                </p>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {order.lines.map((line, index) => (
                  <li key={`${order.id}-${index}`} className="flex justify-between gap-4">
                    <span>
                      {line.quantity} × {line.name}
                    </span>
                    <span className="numerals text-ink-soft">
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
      className={`game-card p-5 ${emphasis ? 'game-card-gold' : ''}`}
    >
      <dt className="eyebrow text-ink-soft">{label}</dt>
      <dd
        className={`numerals mt-2.5 text-h1 font-extrabold leading-none ${
          emphasis ? 'text-gold-dark' : 'text-teal-dark'
        }`}
      >
        {value}
      </dd>
    </div>
  )
}
