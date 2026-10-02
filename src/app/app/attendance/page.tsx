import { redirect } from 'next/navigation'

export default function AttendancePage() {
  redirect('/app/daily-diary?tab=attendance')
}