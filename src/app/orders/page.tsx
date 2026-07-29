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
      <div className="border-b-2 border-rule pb-6">
        <p className="stencil text-blaze">
          {budget?.source === 'api'
            ? '/ Straight from the furniture shop'
            : '/ Local placeholder balance'}
        </p>
        <h1 className="display mt-3 text-6xl leading-[0.86] sm:text-8xl">The Haul</h1>
      </div>

      <dl className="mt-8 grid gap-5 grid-cols-1 sm:grid-cols-3">
        <Stat label="Orders placed" value={String(orders.length)} />
        <Stat label="Total spent" value={formatCents(spentCents)} />
        <Stat
          label="Remaining"
          value={budget ? formatCents(budget.remainingCents) : '—'}
          emphasis
        />
      </dl>

      {error && (
        <p role="alert" className="mt-8 border-l-4 border-blood bg-blood/10 px-4 py-3 text-sm text-[#ff8080]">
          {error}
        </p>
      )}

      {orders.length === 0 && !error ? (
        <div className="mt-12 border-2 border-dashed border-rule p-12 text-center">
          <p className="display text-3xl text-ash">Nothing bought yet</p>
          <Link
            href="/catalogue"
            className="stencil press mt-7 inline-block border-2 border-blaze bg-blaze px-6 py-3.5 text-black shadow-[4px_4px_0_0_#000]"
          >
            Go shopping
          </Link>
        </div>
      ) : (
        <ul className="mt-10 space-y-4">
          {orders.map((order, index) => (
            <li
              key={order.id}
              className="rack-in border-2 border-rule bg-plate p-5 transition-colors hover:border-rule-hot"
              style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-rule pb-3">
                <p className="stencil text-ash">
                  {order.placedAt
                    ? order.placedAt.toLocaleString('en-AU', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : 'Recently'}
                </p>
                <p className="numerals text-2xl font-bold text-volt">
                  {formatCents(order.totalCents)}
                </p>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm text-bone">
                {order.lines.map((line, index) => (
                  <li key={`${order.id}-${index}`} className="flex justify-between gap-4">
                    <span>
                      {line.quantity} × {line.name}
                    </span>
                    <span className="numerals text-ash">
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
      className={`border-2 p-5 ${
        emphasis
          ? 'border-volt bg-volt/5 shadow-[6px_6px_0_0_#000]'
          : 'border-rule bg-plate'
      }`}
    >
      <dt className="stencil text-ash">{label}</dt>
      <dd
        className={`numerals mt-3 text-3xl font-bold leading-none ${
          emphasis ? 'text-volt' : 'text-bone'
        }`}
      >
        {value}
      </dd>
    </div>
  )
}
