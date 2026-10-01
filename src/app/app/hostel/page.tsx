import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth-server'
import { HostelClient } from './HostelClient'

export const metadata = {
  title: 'Hostel — PreOne Plus School OS',
  description: 'Hostel rooms, blocks, student allocations and occupancy',
}

export default async function HostelPage() {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  return <HostelClient session={session as any} />
}
