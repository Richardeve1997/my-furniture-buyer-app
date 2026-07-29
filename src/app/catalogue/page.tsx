import Link from 'next/link'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { ProductCard } from '@/components/ProductCard'
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

  try {
    const { products, categories, hasNextPage, source } = await loadCatalogue(
      category,
      currentPage,
    )

    // Names and images come from our local copy of the catalogue. The API's
    // browse endpoint returns neither: product_name is a generic descriptor
    // ("Armchair"), and image_url is null on search-index by design.
    const local = await db.product.findMany({
      where: { itemId: { in: products.map((p) => p.itemId) } },
      select: { itemId: true, displayName: true, imageMimeType: true },
    })
    const enrichment = new Map(local.map((p) => [p.itemId, p]))

    return (
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Catalogue</h1>
          <p className="text-sm text-stone-500">
            {category ? category : 'All products'}
            {source === 'api' ? ' · live from the furniture shop' : ' · local copy'}
          </p>
        </div>

        <nav className="mt-4 flex flex-wrap gap-2">
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
          <p className="mt-10 text-stone-600">No products found here.</p>
        ) : (
          <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => {
              const extra = enrichment.get(product.itemId)
              return (
                <ProductCard
                  key={product.itemId}
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
          <div className="mt-8 flex items-center justify-center gap-4 text-sm">
            <PageLink page={currentPage - 1} category={category} disabled={currentPage === 1}>
              Previous
            </PageLink>
            <span className="text-stone-500">Page {currentPage}</span>
            <PageLink page={currentPage + 1} category={category} disabled={!hasNextPage}>
              Next
            </PageLink>
          </div>
        )}
      </div>
    )
  } catch (error) {
    return <CatalogueUnavailable error={error} />
  }
}

/**
 * Products from the shop's API when it's configured, otherwise from our local
 * copy so the page still works.
 *
 * We ask for one more product than we show: that's how we know whether there's
 * a next page, since search-index reports no total count.
 */
async function loadCatalogue(category: string | undefined, currentPage: number) {
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
    <div className="mx-auto mt-16 max-w-lg text-center">
      <h1 className="text-xl font-semibold">The catalogue isn&apos;t loading</h1>
      <p className="mt-3 text-stone-600">{message}</p>
      <Link
        href="/catalogue"
        className="mt-6 inline-block rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
      >
        Try again
      </Link>
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
      className={`rounded-full px-3 py-1 text-sm border ${
        active
          ? 'bg-stone-900 text-white border-stone-900'
          : 'bg-white text-stone-700 border-stone-300 hover:border-stone-400'
      }`}
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
  if (disabled) return <span className="text-stone-300">{children}</span>

  const params = new URLSearchParams()
  if (category) params.set('category', category)
  params.set('page', String(page))

  return (
    <Link
      href={`/catalogue?${params}`}
      className="text-stone-700 hover:text-stone-900 underline underline-offset-2"
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
