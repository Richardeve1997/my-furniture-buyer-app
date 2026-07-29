import Link from 'next/link'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { ProductCard } from '@/components/ProductCard'

const PAGE_SIZE = 24

export default async function CataloguePage(props: {
  // Next.js 16: searchParams is async and must be awaited.
  searchParams: Promise<{ category?: string; page?: string }>
}) {
  const { category, page } = await props.searchParams
  const user = await getCurrentUser()

  const currentPage = Math.max(1, Number(page ?? 1))
  const where = category ? { category } : {}

  const [categories, products, total] = await Promise.all([
    db.product.findMany({
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    }),
    db.product.findMany({
      where,
      orderBy: { productName: 'asc' },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.product.count({ where }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Catalogue</h1>
        <p className="text-sm text-stone-500">
          {total} {total === 1 ? 'product' : 'products'}
          {category ? ` in ${category}` : ''}
        </p>
      </div>

      <nav className="mt-4 flex flex-wrap gap-2">
        <CategoryChip label="All" href="/catalogue" active={!category} />
        {categories.map(({ category: name }) => (
          <CategoryChip
            key={name}
            label={name}
            href={`/catalogue?category=${encodeURIComponent(name)}`}
            active={category === name}
          />
        ))}
      </nav>

      {products.length === 0 ? (
        <p className="mt-10 text-stone-600">
          No products yet. Run <code>npm run import:catalogue</code> to load the
          real catalogue.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard
              key={product.itemId}
              canOrder={Boolean(user)}
              product={{
                itemId: product.itemId,
                productName: product.productName,
                priceCents: product.priceCents,
                category: product.category,
                imageUrl: product.imageUrl,
                colours: safeColours(product.coloursJson),
              }}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4 text-sm">
          <PageLink
            page={currentPage - 1}
            category={category}
            disabled={currentPage === 1}
          >
            Previous
          </PageLink>
          <span className="text-stone-500">
            Page {currentPage} of {totalPages}
          </span>
          <PageLink
            page={currentPage + 1}
            category={category}
            disabled={currentPage === totalPages}
          >
            Next
          </PageLink>
        </div>
      )}
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
  if (disabled) {
    return <span className="text-stone-300">{children}</span>
  }
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

/** Colours are stored as JSON text because SQLite has no array type. */
function safeColours(json: string): string[] {
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}
