import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth-server'
import { getEffectiveBranding } from '@/lib/branding-service'
import { HomeClient } from './HomeClient'

export default async function HomePage() {
  const session = await getSession()
  if (!session?.tenantId) redirect('/')

  const branding = await getEffectiveBranding(session.tenantId)
  const tenantName = branding.schoolName || 'PreOne'

  return (
    <HomeClient
      role={session.role}
      branding={branding}
      user={{
        name: session.name,
        role: session.role,
        tenantName,
      }}
    />
  )
}