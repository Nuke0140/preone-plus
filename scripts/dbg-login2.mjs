import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
const db = new PrismaClient()
const email = (process.argv[2] || '').toLowerCase().trim()
console.log('arg bytes:', Buffer.from(email).toString('hex').slice(0, 80))
const byUnique = await db.user.findUnique({ where: { email } })
console.log('findUnique:', byUnique?.email ?? 'NOT FOUND')
const byFirst = await db.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })
console.log('findFirst insensitive:', byFirst?.email ?? 'NOT FOUND')
const rows = await db.$queryRawUnsafe(`SELECT email, "passwordHash", status, "deletedAt" FROM users WHERE email LIKE 'parent-M012307%'`)
console.log('raw:', rows.map(r => ({ email: r.email, status: r.status, del: r.deletedAt })))
if (rows[0]) console.log('compare:', await bcrypt.compare(process.argv[3], rows[0].passwordHash))
await db.$disconnect()
