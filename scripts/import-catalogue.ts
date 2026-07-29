/**
 * Imports the real furniture catalogue from the event's shared, read-only
 * MongoDB into our local SQLite database.
 *
 * Run with: npm run import:catalogue
 *
 * Two things worth knowing about the source data:
 *
 * 1. `price` is a number of dollars (e.g. 398, or 1.2 for the cheapest item).
 *    We store integer cents, so it's multiplied on the way in.
 *
 * 2. `image_url` is described in the lab guide as "a direct link to the product
 *    image - not a base64 blob". In the actual data it IS a base64 blob,
 *    roughly 40-90KB per product. We keep it, but serve it through
 *    /api/products/{itemId}/image so the catalogue HTML stays small.
 */
import 'dotenv/config'
import { MongoClient } from 'mongodb'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../src/generated/prisma/client'

type CatalogueDoc = {
  item_id: string
  product_name: string
  price: number
  category: string
  colours?: string[]
  colour_count?: number
  image_url?: string | null
  image_mime_type?: string | null
  link?: string | null
  depth?: number | null
  height?: number | null
  width?: number | null
}

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
  }),
})

/**
 * Pulls a readable product name out of the product page URL.
 *
 * The source data's `product_name` is a generic descriptor ("1 section",
 * "Bar table"). The actual name only appears in the link:
 *   https://www.ikea.com/sa/en/p/nordviken-bar-table-black-00368814/
 *                                 ^-------------------------^
 * Returns null when the link is missing or doesn't fit that shape, so the
 * caller can fall back to the raw name rather than showing something wrong.
 */
export function displayNameFromLink(
  link: string | null | undefined,
  itemId: string,
): string | null {
  if (!link) return null

  const match = link.match(/\/p\/([^/?#]+)/)
  if (!match) return null

  // The item id is appended to the slug — drop it before prettifying.
  const slug = match[1].replace(new RegExp(`-?${itemId}$`), '')
  if (!slug) return null

  const words = slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))

  return words.length > 0 ? words.join(' ') : null
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env and fill it in.`,
    )
  }
  return value
}

async function main() {
  const client = new MongoClient(requireEnv('MONGODB_URI'), {
    serverSelectionTimeoutMS: 20_000,
  })

  console.log('Connecting to the shared catalogue database…')
  await client.connect()

  const collection = client.db('catalog').collection<CatalogueDoc>('catalog')
  const docs = await collection.find({}).toArray()
  console.log(`Found ${docs.length} products.`)

  const incomingIds = new Set(docs.map((d) => d.item_id))

  // The placeholder products from the seed aren't in the real catalogue.
  // Any order pointing at one would be left dangling, so clear those first
  // and say so plainly rather than failing on a foreign key later.
  const stale = await db.product.findMany({
    where: { itemId: { notIn: [...incomingIds] } },
    select: { itemId: true },
  })

  if (stale.length > 0) {
    const staleIds = stale.map((p) => p.itemId)
    const affectedOrders = await db.order.findMany({
      where: { items: { some: { itemId: { in: staleIds } } } },
      select: { id: true },
    })

    if (affectedOrders.length > 0) {
      await db.order.deleteMany({
        where: { id: { in: affectedOrders.map((o) => o.id) } },
      })
      console.log(
        `Removed ${affectedOrders.length} test order(s) that referenced placeholder products.`,
      )
    }

    await db.product.deleteMany({ where: { itemId: { in: staleIds } } })
    console.log(`Removed ${stale.length} placeholder product(s).`)
  }

  let imported = 0
  for (const doc of docs) {
    const data = {
      productName: doc.product_name,
      displayName: displayNameFromLink(doc.link, doc.item_id),
      priceCents: Math.round(doc.price * 100),
      category: doc.category,
      coloursJson: JSON.stringify(doc.colours ?? []),
      colourCount: doc.colour_count ?? (doc.colours?.length ?? 0),
      imageBase64: doc.image_url ?? null,
      imageMimeType: doc.image_mime_type ?? null,
      link: doc.link ?? null,
      depth: doc.depth ?? null,
      height: doc.height ?? null,
      width: doc.width ?? null,
    }

    await db.product.upsert({
      where: { itemId: doc.item_id },
      update: data,
      create: { itemId: doc.item_id, ...data },
    })

    imported += 1
    if (imported % 100 === 0) {
      console.log(`  …${imported}/${docs.length}`)
    }
  }

  const categories = await db.product.findMany({
    distinct: ['category'],
    select: { category: true },
  })

  console.log(
    `Imported ${imported} products across ${categories.length} categories.`,
  )

  await client.close()
}

main()
  .catch((error) => {
    console.error('\nImport failed:', error.message)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
