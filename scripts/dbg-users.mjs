import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const all = await db.user.findMany({ select: { email: true }, take: 20, orderBy: { createdAt: 'desc' } })
console.log('prisma sees:', all.map(u => JSON.stringify(u.email)))
const raw = await db.$queryRawUnsafe(`SELECT email, length(email) AS len FROM users WHERE email LIKE 'parent-M01%'`)
console.log('raw sees:', raw)
await db.$disconnect()
