import { getSession } from '@/lib/auth-server'
import { OperationsClient } from './OperationsClient'

export default async function OperationsPage() {
  const session = await getSession()
  if (!session?.tenantId) return null
  return <OperationsClient />
}
