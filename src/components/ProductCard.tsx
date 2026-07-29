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

  return (
    <article
      className="rack-in group flex flex-col border-2 border-rule bg-plate transition-colors hover:border-rule-hot"
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
    >
      <div className="relative aspect-square shrink-0 overflow-hidden border-b-2 border-rule bg-[#e8e5de]">
        {product.hasImage ? (
          // Plain <img>: served by our own route from base64 in the database,
          // already sized sensibly, so there's nothing to optimise.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/products/${product.itemId}/image`}
            alt={product.productName}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="stencil text-[#a09c93]">No image</span>
          </div>
        )}

        <span className="stencil absolute left-0 top-0 bg-black px-2.5 py-1.5 text-volt">
          {product.category}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        {/* Two lines max, with room for descenders — these names are long and
            the display face is set very tight by default. */}
        <h2 className="display line-clamp-2 min-h-[2.3em] text-lg leading-[1.15] text-bone">
          {product.productName}
        </h2>

        <p className="stencil mt-1 min-h-[1.2em] text-ash">
          {product.colours.join(' · ')}
        </p>

        <p className="numerals mt-4 text-3xl font-bold leading-none text-bone">
          {formatCents(product.priceCents)}
        </p>

        <div className="mt-auto pt-5">
          {canOrder ? (
            <form action={formAction}>
              <input type="hidden" name="itemId" value={product.itemId} />
              <input type="hidden" name="quantity" value={1} />
              <button
                type="submit"
                disabled={pending}
                className="stencil press w-full border-2 border-blaze bg-blaze py-3.5 text-black shadow-[4px_4px_0_0_#000] hover:bg-volt hover:border-volt disabled:cursor-wait disabled:border-rule disabled:bg-plate disabled:text-ash disabled:shadow-none"
              >
                {pending ? 'Placing…' : 'Buy it'}
              </button>
            </form>
          ) : (
            <p className="stencil border-2 border-dashed border-rule py-3.5 text-center text-ash">
              Log in to order
            </p>
          )}

          {result && (
            <p
              role="status"
              className={`mt-3 border-l-4 px-3 py-2.5 text-sm leading-snug ${
                result.ok
                  ? 'border-volt bg-volt/10 text-volt'
                  : 'border-blood bg-blood/10 text-[#ff8080]'
              }`}
            >
              {result.message}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
