import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '@/generated/prisma/client'

// Prisma 7 requires an explicit driver adapter rather than connecting itself.
function createClient() {
  const url = process.env.DATABASE_URL ?? 'file:./dev.db'
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url }),
  })
}

// Next.js reloads modules on every edit in development. Without caching the
// client on globalThis we'd open a new database connection on every reload
// and eventually run out.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
