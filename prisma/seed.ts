/**
 * Seeds the database with demo users and a handful of placeholder products.
 *
 * The placeholder products exist only so the app renders before the real
 * catalogue is imported. `npm run import:catalogue` replaces them with the
 * 762 real products from the event's shared MongoDB.
 *
 * Run with: npm run db:seed
 */
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../src/generated/prisma/client'

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
  }),
})

const DEMO_PASSWORD = 'hackathon'

const demoUsers = [
  {
    email: 'buyer@demo.com',
    name: 'Asha Verma',
    apiUserId: 'u001',
    placeholderBalanceCents: 250_000,
  },
  {
    email: 'buyer2@demo.com',
    name: 'Tom Reilly',
    apiUserId: 'u002',
    placeholderBalanceCents: 500_000,
  },
]

const placeholderProducts = [
  {
    itemId: 'CHR-001',
    productName: 'Aria Accent Chair',
    priceCents: 39_900,
    category: 'Chairs',
    coloursJson: JSON.stringify(['mustard']),
    colourCount: 1,
  },
  {
    itemId: 'CHR-002',
    productName: 'Linden Lounge Chair',
    priceCents: 64_900,
    category: 'Chairs',
    coloursJson: JSON.stringify(['charcoal']),
    colourCount: 1,
  },
  {
    itemId: 'TBL-001',
    productName: 'Nordic Oak Dining Table',
    priceCents: 129_900,
    category: 'Tables',
    coloursJson: JSON.stringify(['oak']),
    colourCount: 1,
  },
  {
    itemId: 'SFA-001',
    productName: 'Halden Three-Seater Sofa',
    priceCents: 189_900,
    category: 'Sofas',
    coloursJson: JSON.stringify(['sage']),
    colourCount: 1,
  },
  {
    itemId: 'STG-001',
    productName: 'Kilda Bookshelf',
    priceCents: 44_900,
    category: 'Storage',
    coloursJson: JSON.stringify(['walnut']),
    colourCount: 1,
  },
  {
    itemId: 'LGT-001',
    productName: 'Orbit Floor Lamp',
    priceCents: 21_900,
    category: 'Lighting',
    coloursJson: JSON.stringify(['brass']),
    colourCount: 1,
  },
]

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)

  for (const user of demoUsers) {
    await db.user.upsert({
      where: { email: user.email },
      update: { name: user.name, apiUserId: user.apiUserId },
      create: { ...user, passwordHash },
    })
  }
  console.log(`Seeded ${demoUsers.length} demo users (password: ${DEMO_PASSWORD})`)

  const existingProducts = await db.product.count()
  if (existingProducts > placeholderProducts.length) {
    console.log(
      `Skipped placeholder products — ${existingProducts} products already present (real catalogue imported).`,
    )
  } else {
    for (const product of placeholderProducts) {
      await db.product.upsert({
        where: { itemId: product.itemId },
        update: product,
        create: product,
      })
    }
    console.log(`Seeded ${placeholderProducts.length} placeholder products`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
