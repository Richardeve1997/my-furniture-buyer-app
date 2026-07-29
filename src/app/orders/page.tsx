import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getBudget } from '@/lib/budget'
import { formatCents } from '@/lib/money'

export default async function OrdersPage() {
  const user = await getCurrentUser()
  if (!user?.userId) redirect('/login')

  const [orders, budget] = await Promise.all([
    db.order.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { product: true } } },
    }),
    getBudget(user.userId),
  ])

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">My orders</h1>

      <dl className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Stat label="Starting balance" value={formatCents(budget.startingCents)} />
        <Stat label="Total spent" value={formatCents(budget.spentCents)} />
        <Stat
          label="Remaining"
          value={formatCents(budget.remainingCents)}
          emphasis
        />
      </dl>

      {orders.length === 0 ? (
        <p className="mt-10 text-stone-600">
          No orders yet.{' '}
          <Link
            href="/catalogue"
            className="underline underline-offset-2 hover:text-stone-900"
          >
            Browse the catalogue
          </Link>{' '}
          to place your first one.
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {orders.map((order) => (
            <li
              key={order.id}
              className="rounded-lg border border-stone-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-stone-500">
                  {order.createdAt.toLocaleString('en-AU', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
                <p className="font-semibold tabular-nums">
                  {formatCents(order.totalCents)}
                </p>
              </div>
              <ul className="mt-2 text-sm text-stone-700">
                {order.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-4">
                    <span>
                      {item.quantity} × {item.product.productName}
                    </span>
                    <span className="tabular-nums text-stone-500">
                      {formatCents(item.unitPriceCents * item.quantity)}
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
        emphasis
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-stone-200 bg-white'
      }`}
    >
      <dt className="text-sm text-stone-600">{label}</dt>
      <dd
        className={`mt-1 text-xl font-semibold tabular-nums ${
          emphasis ? 'text-emerald-900' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  )
}
