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
    <header className="sticky top-0 z-20 bg-teal shadow-[0_2px_10px_rgba(43,168,162,0.3)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-6">
        <Link href="/catalogue" className="group flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid h-9 w-9 place-items-center rounded-xl bg-cream text-lg shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition-transform duration-200 group-hover:-rotate-6"
          >
            🛋️
          </span>
          <span className="headline text-h2 leading-none text-white">
            Furniture&nbsp;Buyer
          </span>
        </Link>

        <nav className="hidden sm:flex items-center gap-1">
          <HeaderLink href="/catalogue">Catalogue</HeaderLink>
          {user && <HeaderLink href="/orders">My orders</HeaderLink>}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {budget && (
            <span
              className="numerals inline-flex items-center gap-1.5 rounded-round bg-gold px-3.5 py-1.5 text-sm font-extrabold text-ink shadow-[0_2px_10px_rgba(255,210,63,0.4)]"
              title={
                budget.source === 'api'
                  ? 'Live balance from the furniture shop'
                  : 'Placeholder balance — no API key configured'
              }
            >
              <span aria-hidden>💰</span>
              {formatCents(budget.remainingCents)}
            </span>
          )}

          {user ? (
            <form action={logout}>
              <button className="pill pill-ghost text-sm">Log out</button>
            </form>
          ) : (
            <Link href="/login" className="pill pill-gold text-sm">
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

function HeaderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-round px-3.5 py-2 text-sm font-bold text-white/85 transition-colors duration-200 hover:bg-white/15 hover:text-white"
    >
      {children}
    </Link>
  )
}
