import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth-server'
import { InventoryClient } from './InventoryClient'

export const metadata = {
  title: 'Inventory & Procurement — PreOne Plus School OS',
  description: 'Enterprise material management, purchase requests, orders, GRN receiving, stock issues and vendor bills',
}

export default async function InventoryPage() {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  return <InventoryClient session={session as any} />
}
