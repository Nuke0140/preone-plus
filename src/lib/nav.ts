import {
  Home, LayoutDashboard, Users, ClipboardList, IndianRupee,
  Sparkles, Megaphone, Settings, ScrollText, Building2, Rocket,
  HeartPulse, UserCheck, CalendarCheck, Package, Bus, BarChart3,
  GraduationCap, FileCheck2, CalendarRange, BookOpen, BedDouble,
  NotebookPen, Stethoscope, DoorOpen, Trophy,
} from 'lucide-react'
import type { Role } from './auth'
import { can } from './auth'

export interface NavItem {
  key: string
  label: string
  href: string
  icon: React.ComponentType<{ size?: number | string; className?: string }>
  grad: string
  perm?: string
  roles?: Role[]
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Home', href: '/app/home', icon: Home, grad: 'g-blue' },
  { key: 'dashboard', label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard, grad: 'g-blue' },
  { key: 'daily-diary', label: 'Daily Diary', href: '/app/daily-diary', icon: CalendarCheck, grad: 'g-emerald', perm: 'attendance:read' },
  { key: 'users', label: 'Users', href: '/app/users', icon: UserCheck, grad: 'g-violet', perm: 'users:read' },
  { key: 'hr', label: 'HR & Workforce', href: '/app/hr', icon: Users, grad: 'g-indigo', perm: 'users:read' },
  { key: 'setup', label: 'Setup', href: '/app/setup', icon: Rocket, grad: 'g-violet', perm: 'settings:read' },
  { key: 'admissions', label: 'Admissions', href: '/app/admissions', icon: ClipboardList, grad: 'g-pink', perm: 'admissions:read' },
  { key: 'students', label: 'Students', href: '/app/students', icon: Users, grad: 'g-blue', perm: 'students:read' },
  { key: 'learning', label: 'PreO Learning', href: '/app/learning', icon: GraduationCap, grad: 'g-violet' },
  { key: 'exams', label: 'Exams & Results', href: '/app/exams', icon: FileCheck2, grad: 'g-rose', perm: 'exams:read' },
  { key: 'timetable', label: 'Timetable', href: '/app/timetable', icon: CalendarRange, grad: 'g-cyan', perm: 'timetable:read' },
  { key: 'library', label: 'Library', href: '/app/library', icon: BookOpen, grad: 'g-amber', perm: 'library:read' },
  { key: 'hostel', label: 'Hostel', href: '/app/hostel', icon: BedDouble, grad: 'g-lime', perm: 'hostel:read' },
  { key: 'homework', label: 'Homework', href: '/app/homework', icon: NotebookPen, grad: 'g-pink', perm: 'homework:read' },
  { key: 'health', label: 'Health & Medical', href: '/app/health', icon: Stethoscope, grad: 'g-green', perm: 'health:read' },
  { key: 'front-office', label: 'Front Office', href: '/app/front-office', icon: DoorOpen, grad: 'g-sky', perm: 'frontoffice:read' },
  { key: 'events', label: 'Events & Activities', href: '/app/events', icon: Trophy, grad: 'g-yellow', perm: 'events:read' },
  { key: 'operations', label: 'Operations', href: '/app/operations', icon: HeartPulse, grad: 'g-red', perm: 'operations:read' },
  { key: 'transport', label: 'Transport', href: '/app/transport', icon: Bus, grad: 'g-orange', perm: 'transport:read' },
  { key: 'inventory', label: 'Inventory', href: '/app/inventory', icon: Package, grad: 'g-emerald', perm: 'inventory:read' },
  { key: 'finance', label: 'Fees', href: '/app/finance', icon: IndianRupee, grad: 'g-yellow', perm: 'finance:read' },
  { key: 'reports', label: 'Reports & Analytics', href: '/app/reports', icon: BarChart3, grad: 'g-purple', perm: 'reports:read' },
  { key: 'communication', label: 'Announcements', href: '/app/communication', icon: Megaphone, grad: 'g-orange', perm: 'communication:read' },
  { key: 'settings', label: 'Settings', href: '/app/settings', icon: Settings, grad: 'g-slate', perm: 'settings:read' },
  { key: 'audit', label: 'Audit Logs', href: '/app/audit', icon: ScrollText, grad: 'g-sky', perm: 'audit:read' },
  { key: 'platform', label: 'Platform Console', href: '/onboard', icon: Building2, grad: 'g-blue', roles: ['PLATFORM_ADMIN'] },
]

/** Role-filtered navigation (menuBuilder per Frontend Architecture — RBAC). */
export function navForRole(roleOrRoles: Role | Role[]): NavItem[] {
  const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles]
  return NAV_ITEMS.filter((n) => {
    if (n.roles && !n.roles.some((r) => roles.includes(r))) return false
    if (n.perm && !can(roles, n.perm)) return false
    return true
  })
}
