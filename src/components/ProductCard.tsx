'use client'

import { useActionState } from 'react'
import { placeOrder, type OrderResult } from '@/lib/orders'
import { formatCents } from '@/lib/money'

export type ProductCardProduct = {
  itemId: string
  productName: string
  priceCents: number
  category: string
  hasImage: boolean
  colours: string[]
}

export function ProductCard({
  product,
  canOrder,
  index = 0,
}: {
  product: ProductCardProduct
  canOrder: boolean
  /** Position in the grid, used to stagger the load-in. */
  index?: number
}) {
  const [result, formAction, pending] = useActionState<OrderResult | null, FormData>(
    placeOrder,
    null,
  )

  // The left accent bar carries state: teal by default, gold on a successful
  // order, coral when the shop said no.
  const stateClass = result
    ? result.ok
      ? 'game-card-gold'
      : 'game-card-coral'
    : ''

  return (
    <article
      className={`game-card pop-in group flex flex-col overflow-hidden ${stateClass}`}
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      <div className="relative aspect-square shrink-0 overflow-hidden bg-cream">
        {product.hasImage ? (
          // Plain <img>: served by our own route from base64 in the database,
          // already sized sensibly, so there's nothing to optimise.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/products/${product.itemId}/image`}
            alt={product.productName}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full place-items-center">
            <span className="eyebrow text-ink-soft">No image</span>
          </div>
        )}

        <span className="eyebrow absolute left-2.5 top-2.5 rounded-round bg-teal px-2.5 py-1 text-white shadow-[0_2px_8px_rgba(43,168,162,0.3)]">
          {product.category}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h2 className="headline line-clamp-2 min-h-[2.6em] text-h3 leading-snug">
          {product.productName}
        </h2>

        <p className="min-h-[1.3em] text-sm text-ink-soft">
          {product.colours.join(' · ')}
        </p>

        <p className="numerals mt-2.5 text-h1 font-extrabold leading-none text-teal-dark">
          {formatCents(product.priceCents)}
        </p>

        <div className="mt-auto pt-4">
          {canOrder ? (
            <form action={formAction}>
              <input type="hidden" name="itemId" value={product.itemId} />
              <input type="hidden" name="quantity" value={1} />
              <button
                type="submit"
                disabled={pending}
                className="pill pill-gold w-full disabled:cursor-wait disabled:opacity-60"
              >
                {pending ? 'Placing…' : 'Buy it'}
              </button>
            </form>
          ) : (
            <p className="eyebrow rounded-round border-2 border-dashed border-teal/30 py-2.5 text-center text-ink-soft">
              Log in to order
            </p>
          )}

          {result && (
            <p
              role="status"
              className={`mt-3 rounded-md px-3 py-2.5 text-sm leading-snug ${
                result.ok
                  ? 'bg-gold-light/50 text-ink'
                  : 'bg-coral/10 text-coral-dark'
              }`}
            >
              {result.ok ? '🎉 ' : '⚠️ '}
              {result.message}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
