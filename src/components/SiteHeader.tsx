import Link from 'next/link'
import { getCurrentUser } from '@/lib/session'
import { getBudget } from '@/lib/budget'
import { formatCents } from '@/lib/money'
import { logout } from '@/lib/auth'

export async function SiteHeader() {
  const user = await getCurrentUser()

  // A failing balance lookup must not take the whole site's header down —
  // every page renders through here, including the catalogue.
  let budget = null
  if (user?.userId) {
    try {
      budget = await getBudget(user.userId)
    } catch (error) {
      console.error('[header] could not load balance', error)
    }
  }

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="w-full max-w-6xl mx-auto px-4 h-16 flex items-center gap-6">
        <Link href="/catalogue" className="font-semibold tracking-tight">
          Furniture Buyer
        </Link>

        <nav className="flex items-center gap-4 text-sm text-stone-600">
          <Link href="/catalogue" className="hover:text-stone-900">
            Catalogue
          </Link>
          {user && (
            <Link href="/orders" className="hover:text-stone-900">
              My orders
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-4 text-sm">
          {budget && (
            <span
              className="tabular-nums rounded-full bg-emerald-50 text-emerald-800 px-3 py-1 font-medium"
              title={
                budget.source === 'api'
                  ? 'Live balance from the furniture shop'
                  : 'Placeholder balance — no API key configured'
              }
            >
              {formatCents(budget.remainingCents)} left
            </span>
          )}
          {user ? (
            <form action={logout}>
              <span className="text-stone-500 mr-3">{user.name}</span>
              <button className="text-stone-600 hover:text-stone-900 underline underline-offset-2">
                Log out
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-stone-900 text-white px-3 py-1.5 hover:bg-stone-700"
            >
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
