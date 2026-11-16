import type { Role } from '@/lib/auth'
import type { HRTabKey } from '@/components/hr/types'
import { normalizeRole } from '@/lib/roles'

const ROLE_TABS: Record<string, HRTabKey[]> = {
  OWNER: ['dashboard', 'employees', 'attendance', 'leave', 'schedule', 'payroll', 'performance', 'training', 'requests', 'reports'],
  PRINCIPAL: ['dashboard', 'employees', 'attendance', 'leave', 'schedule', 'performance', 'training', 'requests', 'reports'],
  RECEPTIONIST: ['dashboard', 'employees', 'attendance', 'leave', 'reports'],
  COORDINATOR: ['dashboard', 'employees', 'attendance', 'leave', 'schedule', 'performance', 'training', 'requests', 'reports'],
  ACCOUNTS: ['dashboard', 'payroll', 'reports'],
  ACCOUNTANT: ['dashboard', 'payroll', 'reports'],
  // Teacher and general staff must use dedicated self-service screens.
  // Existing HR tables are organization-wide and must never be exposed to them.
  TEACHER: [],
  STAFF: [],
}

export function getVisibleHRTabs(roles: Array<Role | string> = []): HRTabKey[] {
  const visible = new Set<HRTabKey>()
  for (const rawRole of roles) {
    const role = normalizeRole(String(rawRole))
    for (const tab of ROLE_TABS[role] || []) visible.add(tab)
  }
  return Array.from(visible)
}

export function canViewHRTab(roles: Array<Role | string> = [], tab: HRTabKey): boolean {
  return getVisibleHRTabs(roles).includes(tab)
}
