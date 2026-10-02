import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth-server'
import { HomeworkClient } from './HomeworkClient'

export const metadata = {
  title: 'Homework — PreOne Plus School OS',
  description: 'Assignments, submissions, grading and completion tracking',
}

export default async function HomeworkPage() {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  return <HomeworkClient session={session as any} />
}
