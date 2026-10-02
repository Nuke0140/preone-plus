import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth-server'
import { FrontOfficeClient } from './FrontOfficeClient'

export const metadata = {
  title: 'Front Office — PreOne Plus School OS',
  description: 'Visitor management, student gate passes and early-leave workflow',
}

export default async function FrontOfficePage() {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  return <FrontOfficeClient session={session as any} />
}
