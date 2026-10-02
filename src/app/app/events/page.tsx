import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth-server'
import { EventsClient } from './EventsClient'

export const metadata = {
  title: 'Events & Activities — PreOne Plus School OS',
  description: 'Sports day, cultural fests, trips, competitions and workshops with registrations',
}

export default async function EventsPage() {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  return <EventsClient session={session as any} />
}
