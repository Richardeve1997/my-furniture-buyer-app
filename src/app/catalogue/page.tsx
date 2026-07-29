import Link from 'next/link'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { ProductCard } from '@/components/ProductCard'
import { AgentChat } from '@/components/AgentChat'
import {
  ApiError,
  fetchCategories,
  isApiConfigured,
  searchCatalogue,
  type CatalogueProduct,
} from '@/lib/api'

const PAGE_SIZE = 24

export default async function CataloguePage(props: {
  // Next.js 16: searchParams is async and must be awaited.
  searchParams: Promise<{ category?: string; page?: string }>
}) {
  const { category, page } = await props.searchParams
  const user = await getCurrentUser()
  const currentPage = Math.max(1, Number(page ?? 1))

  // Only the data fetching is guarded. Building the JSX inside a try/catch
  // would look like it caught render errors, and it wouldn't — React renders
  // components after this function returns.
  let loaded: Awaited<ReturnType<typeof loadCatalogue>>
  let enrichment: Map<
    string,
    { itemId: string; displayName: string | null; imageMimeType: string | null }
  >

  try {
    loaded = await loadCatalogue(category, currentPage)

    // Names and images come from our local copy of the catalogue. The API's
    // browse endpoint returns neither: product_name is a generic descriptor
    // ("Armchair"), and image_url is null on search-index by design.
    const local = await db.product.findMany({
      where: { itemId: { in: loaded.products.map((p) => p.itemId) } },
      select: { itemId: true, displayName: true, imageMimeType: true },
    })
    enrichment = new Map(local.map((p) => [p.itemId, p]))
  } catch (error) {
    return <CatalogueUnavailable error={error} />
  }

  const { products, categories, hasNextPage, source } = loaded

  return (
    <div>
      <div className="section-title">
        <span aria-hidden className="text-h1">🛒</span>
        <div>
          <p className="eyebrow text-teal">
            {source === 'api' ? 'Live from the furniture shop' : 'Local copy'}
          </p>
          <h1 className="headline text-h1 leading-tight">
            {category ?? 'Everything in store'}
          </h1>
        </div>
      </div>

      {user && (
        <div className="mt-6">
          <AgentChat />
        </div>
      )}

      <nav className="mt-6 flex flex-wrap gap-2">
        <CategoryChip label="All" href="/catalogue" active={!category} />
        {categories.map((name) => (
          <CategoryChip
            key={name}
            label={name}
            href={`/catalogue?category=${encodeURIComponent(name)}`}
            active={category === name}
          />
        ))}
      </nav>

      {products.length === 0 ? (
        <p className="eyebrow mt-16 text-center text-ink-soft">Nothing here yet</p>
      ) : (
        <div className="mt-8 grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product, index) => {
            const extra = enrichment.get(product.itemId)
            return (
              <ProductCard
                key={product.itemId}
                index={index}
                canOrder={Boolean(user)}
                product={{
                  itemId: product.itemId,
                  productName: extra?.displayName ?? product.productName,
                  priceCents: product.priceCents,
                  category: product.category,
                  hasImage: Boolean(extra?.imageMimeType),
                  colours: product.colours,
                }}
              />
            )
          })}
        </div>
      )}

      {(currentPage > 1 || hasNextPage) && (
        <div className="mt-12 flex items-center justify-center gap-8">
          <PageLink
            page={currentPage - 1}
            category={category}
            disabled={currentPage === 1}
          >
            ← Prev
          </PageLink>
          <span className="numerals eyebrow text-ink-soft">
            Page {currentPage}
          </span>
          <PageLink
            page={currentPage + 1}
            category={category}
            disabled={!hasNextPage}
          >
            Next →
          </PageLink>
        </div>
      )}
    </div>
  )
}

/**
 * Products from the shop's API when it's configured, otherwise from our local
 * copy so the page still works.
 *
 * We ask for one more product than we show: that's how we know whether there's
 * a next page, since search-index reports no total count.
 */
async function loadCatalogue(
  category: string | undefined,
  currentPage: number,
) {
  const skip = (currentPage - 1) * PAGE_SIZE

  if (isApiConfigured()) {
    const [batch, categories] = await Promise.all([
      searchCatalogue({ category, limit: PAGE_SIZE + 1, skip }),
      fetchCategories(),
    ])
    return {
      products: batch.slice(0, PAGE_SIZE),
      categories,
      hasNextPage: batch.length > PAGE_SIZE,
      source: 'api' as const,
    }
  }

  const where = category ? { category } : {}
  const [rows, categoryRows, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { productName: 'asc' },
      skip,
      take: PAGE_SIZE,
      select: {
        itemId: true,
        productName: true,
        priceCents: true,
        category: true,
        coloursJson: true,
      },
    }),
    db.product.findMany({
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    }),
    db.product.count({ where }),
  ])

  const products: CatalogueProduct[] = rows.map((r) => ({
    itemId: r.itemId,
    productName: r.productName,
    priceCents: r.priceCents,
    category: r.category,
    colours: safeColours(r.coloursJson),
    width: null,
    height: null,
    depth: null,
    link: null,
  }))

  return {
    products,
    categories: categoryRows.map((c) => c.category),
    hasNextPage: skip + PAGE_SIZE < total,
    source: 'local' as const,
  }
}

function CatalogueUnavailable({ error }: { error: unknown }) {
  const message =
    error instanceof ApiError
      ? error.userMessage
      : "Couldn't reach the furniture shop just now."

  return (
    <div className="mx-auto mt-16 max-w-xl">
      <div className="game-card game-card-coral p-8 text-center">
        <p aria-hidden className="text-display leading-none">🪑</p>
        <h1 className="headline mt-4 text-h1">The catalogue isn&apos;t loading</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">{message}</p>
        <Link href="/catalogue" className="pill pill-gold mt-7">
          Try again
        </Link>
      </div>
    </div>
  )
}

function CategoryChip({
  label,
  href,
  active,
}: {
  label: string
  href: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={`pill text-sm ${active ? 'pill-teal' : 'pill-ghost'}`}
    >
      {label}
    </Link>
  )
}

function PageLink({
  page,
  category,
  disabled,
  children,
}: {
  page: number
  category?: string
  disabled: boolean
  children: React.ReactNode
}) {
  if (disabled)
    return <span className="eyebrow text-ink-soft/40">{children}</span>

  const params = new URLSearchParams()
  if (category) params.set('category', category)
  params.set('page', String(page))

  return (
    <Link
      href={`/catalogue?${params}`}
      className="pill pill-ghost text-sm"
    >
      {children}
    </Link>
  )
}

/** Colours are stored as JSON text locally because SQLite has no array type. */
function safeColours(json: string): string[] {
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}
