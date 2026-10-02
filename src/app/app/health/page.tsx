import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth-server'
import { HealthClient } from './HealthClient'

export const metadata = {
  title: 'Health & Medical — PreOne Plus School OS',
  description: 'Student health records, sick bay visits, allergy and chronic-condition alerts',
}

export default async function HealthPage() {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  return <HealthClient session={session as any} />
}
