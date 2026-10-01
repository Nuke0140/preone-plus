import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
const db = new PrismaClient()
const email = process.argv[2]
const password = process.argv[3]
const user = await db.user.findUnique({
  where: { email: email.toLowerCase().trim() },
  include: { memberships: { include: { tenant: true }, where: { deletedAt: null } } },
})
console.log('user found:', !!user, user && { status: user.status, deleted: user.deletedAt, memberships: user.memberships.length })
if (user) {
  console.log('compare:', await bcrypt.compare(password, user.passwordHash))
}
await db.$disconnect()
