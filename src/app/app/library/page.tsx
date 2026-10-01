import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth-server'
import { LibraryClient } from './LibraryClient'

export const metadata = {
  title: 'Library — PreOne Plus School OS',
  description: 'Book catalog, issue & return workflow, overdue fines',
}

export default async function LibraryPage() {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  return <LibraryClient session={session as any} />
}
