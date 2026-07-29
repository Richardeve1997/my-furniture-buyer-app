'use client'

import { useActionState } from 'react'
import { placeOrder, type OrderResult } from '@/lib/orders'
import { formatCents } from '@/lib/money'

export type ProductCardProduct = {
  itemId: string
  productName: string
  priceCents: number
  category: string
  imageUrl: string | null
  colours: string[]
}

export function ProductCard({
  product,
  canOrder,
}: {
  product: ProductCardProduct
  canOrder: boolean
}) {
  const [result, formAction, pending] = useActionState<OrderResult | null, FormData>(
    placeOrder,
    null,
  )

  return (
    <article className="flex flex-col rounded-lg border border-stone-200 bg-white overflow-hidden">
      <div className="aspect-4/3 bg-stone-100 flex items-center justify-center">
        {product.imageUrl ? (
          // Plain <img> rather than next/image: the catalogue images come from
          // a host we don't control, and Next 16 requires each remote host be
          // declared in images.remotePatterns before next/image will load it.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.productName}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-xs text-stone-400 uppercase tracking-wide">
            No image
          </span>
        )}
      </div>

      <div className="flex flex-col flex-1 p-4">
        <p className="text-xs uppercase tracking-wide text-stone-500">
          {product.category}
        </p>
        <h2 className="mt-1 font-medium leading-snug">{product.productName}</h2>

        {product.colours.length > 0 && (
          <p className="mt-1 text-xs text-stone-500">
            {product.colours.join(', ')}
          </p>
        )}

        <p className="mt-2 text-lg font-semibold tabular-nums">
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
                className="w-full rounded-md bg-stone-900 text-white py-2 text-sm font-medium hover:bg-stone-700 disabled:opacity-60"
              >
                {pending ? 'Placing…' : 'Buy'}
              </button>
            </form>
          ) : (
            <p className="text-sm text-stone-500">Log in to order</p>
          )}

          {result && (
            <p
              role="status"
              className={`mt-2 rounded-md px-3 py-2 text-sm ${
                result.ok
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-amber-50 text-amber-900'
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
