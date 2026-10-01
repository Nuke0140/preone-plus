import { getSession } from '@/lib/auth-server'
import { redirect } from 'next/navigation'
import { LearningClient } from './LearningClient'

export default async function LearningPage() {
  const session = await getSession()
  if (!session?.tenantId) redirect('/')
  return <LearningClient />
}
