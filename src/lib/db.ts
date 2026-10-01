import { PrismaClient } from '@prisma/client'

const rawUrl =
  process.env.PREONE_PG_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  'postgresql://preone:preone@127.0.0.1:54329/preone'

// Prisma Postgres: direct host (db.prisma.io) has ~5 usable connections;
// pooled host (pooled.db.prisma.io) supports 50+. Auto-upgrade the direct
// host for runtime traffic so the app never exhausts the migration pool.
function runtimeUrl(raw: string): string {
  const upgraded = raw.replace(/@db\.prisma\.io(?=:?\d*\/)/, '@pooled.db.prisma.io')
  const prefix = upgraded.includes('?') ? '&' : '?'
  return upgraded.includes('connection_limit=') ? upgraded : `${upgraded}${prefix}connection_limit=20`
}

const RUNTIME_DB_URL = runtimeUrl(rawUrl)

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: RUNTIME_DB_URL } },
    log: ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
