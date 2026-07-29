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
    <header className="sticky top-0 z-20">
      <div className="hazard h-2" />
      <div className="border-b-2 border-rule bg-deck/95 backdrop-blur">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8 h-20 flex items-center gap-8">
          <Link href="/catalogue" className="group shrink-0">
            <span className="display block text-2xl sm:text-3xl leading-none">
              Furniture
            </span>
            <span className="display block text-2xl sm:text-3xl leading-none text-blaze transition-colors group-hover:text-volt">
              Buyer
            </span>
          </Link>

          <nav className="hidden sm:flex items-center gap-6">
            <HeaderLink href="/catalogue">Catalogue</HeaderLink>
            {user && <HeaderLink href="/orders">Orders</HeaderLink>}
          </nav>

          <div className="ml-auto flex items-center gap-4 sm:gap-6">
            {budget && (
              <div
                className="text-right leading-none"
                title={
                  budget.source === 'api'
                    ? 'Live balance from the furniture shop'
                    : 'Placeholder balance — no API key configured'
                }
              >
                <p className="stencil text-ash">
                  {budget.source === 'api' ? 'Live budget' : 'Budget (local)'}
                </p>
                <p className="numerals mt-1.5 text-xl sm:text-2xl font-bold text-volt">
                  {formatCents(budget.remainingCents)}
                </p>
              </div>
            )}

            {user ? (
              <form action={logout} className="flex items-center gap-4">
                <span className="stencil hidden text-ash md:block">{user.name}</span>
                <button className="stencil press border-2 border-rule bg-plate px-4 py-2.5 text-bone hover:border-blood hover:text-blood">
                  Log out
                </button>
              </form>
            ) : (
              <Link
                href="/login"
                className="stencil press border-2 border-blaze bg-blaze px-5 py-2.5 text-black shadow-[4px_4px_0_0_#000]"
              >
                Log in
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function HeaderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="stencil relative text-ash transition-colors hover:text-bone after:absolute after:-bottom-2 after:left-0 after:h-0.5 after:w-0 after:bg-blaze after:transition-all hover:after:w-full"
    >
      {children}
    </Link>
  )
}
