import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth-server'
import { ExamsClient } from './ExamsClient'

export const metadata = {
  title: 'Exams & Results — PreOne Plus School OS',
  description: 'Exam scheduling, marks entry, report card generation and result publication',
}

export default async function ExamsPage() {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  return <ExamsClient session={session as any} />
}
