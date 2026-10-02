import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { OnboardClient } from './OnboardClient'
import { ToastProvider } from '@/components/preone/Toast'

export default async function OnboardPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'PLATFORM_ADMIN') redirect('/app/dashboard')

  const tenants = await db.tenant.findMany({
    include: { _count: { select: { students: true, branches: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <ToastProvider>
      <OnboardClient
        user={{ name: session.name, email: session.email }}
        tenants={tenants.map((t) => ({
          id: t.id,
          name: t.name,
          code: t.code,
          city: t.city,
          status: t.status,
          plan: t.subscriptionPlan,
          students: t._count.students,
          branches: t._count.branches,
          onboardedAt: t.onboardedAt ? t.onboardedAt.toISOString() : null,
          createdAt: t.createdAt.toISOString(),
        }))}
      />
    </ToastProvider>
  )
}
