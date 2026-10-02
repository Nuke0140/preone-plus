import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth-server'
import { TransportClient } from './TransportClient'

export const metadata = {
  title: 'Transport & Safety Operations — PreOne Plus School OS',
  description: 'Preschool child safety, bus routes, fleet, driver assignment, live trips, and authorized guardian drop verification',
}

export default async function TransportPage() {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  return <TransportClient session={session as any} />
}
