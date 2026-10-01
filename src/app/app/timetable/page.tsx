import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth-server'
import { TimetableClient } from './TimetableClient'

export const metadata = {
  title: 'Timetable — PreOne Plus School OS',
  description: 'Class-wise and teacher-wise weekly schedule management',
}

export default async function TimetablePage() {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  return <TimetableClient session={session as any} />
}
