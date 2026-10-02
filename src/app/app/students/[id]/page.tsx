import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth-server'
import { StudentService } from '@/lib/students/student-service'
import { StudentDetailClient } from './StudentDetailClient'

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/')
  if (!session.tenantId) notFound()

  const { id } = await params

  try {
    const profile = await StudentService.getStudentProfile(
      {
        tenantId: session.tenantId,
        branchId: session.branchId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
      },
      id
    )

    return <StudentDetailClient profile={profile} />
  } catch (error) {
    notFound()
  }
}

