import { Metadata } from 'next'
import ReportsClient from './ReportsClient'

export const metadata: Metadata = {
  title: 'Reports & Analytics | PreOne',
  description: 'Executive MIS, operational dashboards, exports, and custom report builder',
}

export default function ReportsPage() {
  return <ReportsClient />
}
