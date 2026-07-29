import { db } from '@/lib/db'

/**
 * Serves one product's photo.
 *
 * The catalogue stores images as base64 (roughly 65KB each). Inlining those
 * into the page would mean a megabyte-plus of HTML per grid of products, so
 * they're served here instead, where the browser can cache them normally.
 *
 * Deliberately shaped like the real API's GET /catalogue/{item_id}/image,
 * which returns already-decoded bytes — so pointing at the real thing later
 * is a one-line change.
 */
export async function GET(
  _request: Request,
  // Next.js 16: route params are async and must be awaited.
  context: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await context.params

  const product = await db.product.findUnique({
    where: { itemId },
    select: { imageBase64: true, imageMimeType: true },
  })

  if (!product?.imageBase64) {
    return new Response('Not found', { status: 404 })
  }

  const bytes = Buffer.from(product.imageBase64, 'base64')

  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': product.imageMimeType ?? 'image/jpeg',
      'Content-Length': String(bytes.byteLength),
      // The catalogue is static for the day; let the browser keep these.
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  })
}
