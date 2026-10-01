import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  const users = await db.user.findMany({
    where: {
      OR: [
        { email: { contains: 'sunshine' } },
        { email: { contains: 'preone' } },
        { email: { contains: 'demo' } },
      ],
    },
    select: {
      email: true,
      username: true,
      fullName: true,
      passwordHash: true,
      status: true,
      memberships: {
        select: {
          role: true,
          roles: true,
          tenant: { select: { name: true, code: true } },
        },
      },
    },
  })

  console.log(`Found ${users.length} demo users:`)
  for (const u of users) {
    const isPreone123 = await bcrypt.compare('Preone@123', u.passwordHash)
    console.log(`- Role: ${u.memberships[0]?.role || 'PLATFORM_ADMIN'} | Email: ${u.email} | Username: ${u.username} | Name: ${u.fullName} | Password valid (Preone@123): ${isPreone123}`)
  }
}

main().finally(() => db.$disconnect())
