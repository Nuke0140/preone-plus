import { navForRole, type NavItem } from './nav'
import type { Role } from './auth'
import { can } from './auth'

export type TileSize = 'sm' | 'md' | 'lg'
export type SemanticTheme = 'lavender' | 'blue' | 'teal' | 'orange' | 'pink' | 'green' | 'purple'

export interface QuickAction {
  label: string
  href: string
  perm?: string
}

export interface ModuleMeta {
  description: string
  tileSize: TileSize
  semanticTheme?: SemanticTheme
  quickActions?: QuickAction[]
  animation?: string
}

export interface SemanticThemeTokens {
  iconBg: string
  iconColor: string
  iconBorder: string
  hoverBorder: string
  accentGlow: string
}

export interface HomeModule extends NavItem {
  description: string
  tileSize: TileSize
  semanticTheme: SemanticTheme
  quickActions: QuickAction[]
  animation?: string
}

export const SEMANTIC_THEME_TOKENS: Record<SemanticTheme, SemanticThemeTokens> = {
  lavender: {
    iconBg: 'var(--primary-light, #F3EEFF)',
    iconColor: 'var(--primary, #7C3AED)',
    iconBorder: 'color-mix(in srgb, var(--primary, #7C3AED) 20%, transparent)',
    hoverBorder: 'var(--primary, #7C3AED)',
    accentGlow: 'color-mix(in srgb, var(--primary, #7C3AED) 8%, transparent)',
  },
  blue: {
    iconBg: 'var(--info-soft, #EBF5FF)',
    iconColor: 'var(--info, #2563EB)',
    iconBorder: 'color-mix(in srgb, var(--info, #2563EB) 20%, transparent)',
    hoverBorder: 'var(--info, #2563EB)',
    accentGlow: 'color-mix(in srgb, var(--info, #2563EB) 8%, transparent)',
  },
  teal: {
    iconBg: 'var(--secondary-light, #E6FFFA)',
    iconColor: 'var(--secondary, #0D9488)',
    iconBorder: 'color-mix(in srgb, var(--secondary, #0D9488) 20%, transparent)',
    hoverBorder: 'var(--secondary, #0D9488)',
    accentGlow: 'color-mix(in srgb, var(--secondary, #0D9488) 8%, transparent)',
  },
  orange: {
    iconBg: 'var(--accent-light, #FFF7ED)',
    iconColor: 'var(--warning, #D97706)',
    iconBorder: 'color-mix(in srgb, var(--warning, #D97706) 20%, transparent)',
    hoverBorder: 'var(--warning, #D97706)',
    accentGlow: 'color-mix(in srgb, var(--warning, #D97706) 8%, transparent)',
  },
  pink: {
    iconBg: 'var(--pink-soft, #FDF2F8)',
    iconColor: 'var(--pink, #DB2777)',
    iconBorder: 'color-mix(in srgb, var(--pink, #DB2777) 20%, transparent)',
    hoverBorder: 'var(--pink, #DB2777)',
    accentGlow: 'color-mix(in srgb, var(--pink, #DB2777) 8%, transparent)',
  },
  green: {
    iconBg: 'var(--success-soft, #ECFDF5)',
    iconColor: 'var(--success, #16A34A)',
    iconBorder: 'color-mix(in srgb, var(--success, #16A34A) 20%, transparent)',
    hoverBorder: 'var(--success, #16A34A)',
    accentGlow: 'color-mix(in srgb, var(--success, #16A34A) 8%, transparent)',
  },
  purple: {
    iconBg: 'var(--primary-soft, #EDE9FE)',
    iconColor: 'var(--primary, #7C3AED)',
    iconBorder: 'color-mix(in srgb, var(--primary, #7C3AED) 20%, transparent)',
    hoverBorder: 'var(--primary, #7C3AED)',
    accentGlow: 'color-mix(in srgb, var(--primary, #7C3AED) 8%, transparent)',
  },
}

const DEFAULT_META: ModuleMeta = {
  description: '',
  tileSize: 'sm',
  semanticTheme: 'lavender',
}

export const MODULE_META: Record<string, ModuleMeta> = {
  home: {
    description: 'Your control center',
    tileSize: 'md',
    semanticTheme: 'lavender',
  },
  dashboard: {
    description: 'Insights at a glance',
    tileSize: 'lg',
    semanticTheme: 'blue',
    animation: '/animations/home/dashboard.json',
  },
  'daily-diary': {
    description: 'Timetable, activities & attendance',
    tileSize: 'lg',
    semanticTheme: 'teal',
    animation: '/animations/home/daily_diary.json',
    quickActions: [
      { label: "Today's Schedule", href: '/app/daily-diary', perm: 'attendance:read' },
      { label: 'Mark Attendance', href: '/app/daily-diary?tab=attendance', perm: 'attendance:mark' },
      { label: 'Add Activity', href: '/app/daily-diary?tab=activities', perm: 'academics:write' },
    ],
  },
  users: {
    description: 'Manage access & roles',
    tileSize: 'md',
    semanticTheme: 'teal',
    animation: '/animations/home/users.json',
    quickActions: [{ label: 'Add user', href: '/app/users', perm: 'users:write' }],
  },
  hr: {
    description: 'Staff, leaves & payroll',
    tileSize: 'md',
    semanticTheme: 'orange',
    animation: '/animations/home/hr_workforce.json',
  },
  setup: {
    description: 'School configuration',
    tileSize: 'sm',
    semanticTheme: 'lavender',
    animation: '/animations/home/setup.json',
  },
  admissions: {
    description: 'Inquiries & enrollments',
    tileSize: 'lg',
    semanticTheme: 'pink',
    animation: '/animations/home/admissions.json',
    quickActions: [
      { label: 'Record enquiry', href: '/app/admissions', perm: 'admissions:write' },
      { label: 'New application', href: '/app/admissions', perm: 'admissions:write' },
    ],
  },
  students: {
    description: 'Student records & profiles',
    tileSize: 'lg',
    semanticTheme: 'green',
    animation: '/animations/home/students.json',
    quickActions: [{ label: 'Add student', href: '/app/students', perm: 'students:write' }],
  },
  learning: {
    description: 'Early childhood curriculum & activities',
    tileSize: 'lg',
    semanticTheme: 'lavender',
    animation: '/animations/home/preo_learning_mascot.json',
    quickActions: [{ label: 'Open workspace', href: '/app/learning' }],
  },
  'preo-learning': {
    description: 'Early childhood curriculum & activities',
    tileSize: 'lg',
    semanticTheme: 'lavender',
    animation: '/animations/home/preo_learning_mascot.json',
    quickActions: [{ label: 'Open workspace', href: '/app/learning' }],
  },
  preo_learning: {
    description: 'Early childhood curriculum & activities',
    tileSize: 'lg',
    semanticTheme: 'lavender',
    animation: '/animations/home/preo_learning_mascot.json',
    quickActions: [{ label: 'Open workspace', href: '/app/learning' }],
  },
  operations: {
    description: 'Daily school operations',
    tileSize: 'md',
    semanticTheme: 'lavender',
  },
  transport: {
    description: 'Routes & vehicle tracking',
    tileSize: 'lg',
    semanticTheme: 'blue',
    animation: '/animations/home/transport.json',
    quickActions: [
      { label: "Today's trips", href: '/app/transport?tab=trips', perm: 'transport:trip' },
      { label: 'Assign student', href: '/app/transport?tab=students', perm: 'transport:assign' },
    ],
  },
  inventory: {
    description: 'Supplies & assets',
    tileSize: 'lg',
    semanticTheme: 'orange',
    animation: '/animations/home/inventory.json',
    quickActions: [
      { label: 'Request materials', href: '/app/inventory?tab=requests', perm: 'inventory:request' },
      { label: 'Receive stock', href: '/app/inventory?tab=grn', perm: 'inventory:receive' },
    ],
  },
  finance: {
    description: 'Billing & payments',
    tileSize: 'lg',
    semanticTheme: 'green',
    animation: '/animations/home/fees.json',
    quickActions: [{ label: 'Create invoice', href: '/app/finance', perm: 'finance:write' }],
  },
  fees: {
    description: 'Billing & payments',
    tileSize: 'lg',
    semanticTheme: 'green',
    animation: '/animations/home/fees.json',
    quickActions: [{ label: 'Create invoice', href: '/app/finance', perm: 'finance:write' }],
  },
  reports: {
    description: 'Data-driven insights',
    tileSize: 'lg',
    semanticTheme: 'purple',
    animation: '/animations/home/reports_analytics.json',
    quickActions: [
      { label: 'Executive MIS', href: '/app/reports?tab=executive', perm: 'reports:read' },
      { label: 'Custom Builder', href: '/app/reports?tab=custom', perm: 'reports:custom' },
    ],
  },
  reports_analytics: {
    description: 'Data-driven insights',
    tileSize: 'lg',
    semanticTheme: 'purple',
    animation: '/animations/home/reports_analytics.json',
    quickActions: [
      { label: 'Executive MIS', href: '/app/reports?tab=executive', perm: 'reports:read' },
      { label: 'Custom Builder', href: '/app/reports?tab=custom', perm: 'reports:custom' },
    ],
  },
  communication: {
    description: 'Communicate with your community',
    tileSize: 'md',
    semanticTheme: 'pink',
    animation: '/animations/home/announcements.json',
    quickActions: [{ label: 'Send announcement', href: '/app/communication', perm: 'communication:write' }],
  },
  exams: {
    description: 'Exams, marks & report cards',
    tileSize: 'md',
    semanticTheme: 'pink',
    quickActions: [
      { label: 'Create exam', href: '/app/exams', perm: 'exams:write' },
      { label: 'Enter marks', href: '/app/exams?tab=marks', perm: 'exams:write' },
    ],
  },
  timetable: {
    description: 'Class & teacher schedules',
    tileSize: 'md',
    semanticTheme: 'teal',
    quickActions: [{ label: 'View timetable', href: '/app/timetable', perm: 'timetable:read' }],
  },
  library: {
    description: 'Books, issue & return',
    tileSize: 'md',
    semanticTheme: 'orange',
    quickActions: [
      { label: 'Add book', href: '/app/library?tab=catalog', perm: 'library:write' },
      { label: 'Issue book', href: '/app/library?tab=issues', perm: 'library:write' },
    ],
  },
  hostel: {
    description: 'Rooms & resident students',
    tileSize: 'sm',
    semanticTheme: 'green',
    quickActions: [{ label: 'Allocate room', href: '/app/hostel?tab=allocations', perm: 'hostel:write' }],
  },
  homework: {
    description: 'Assignments, submissions & grading',
    tileSize: 'md',
    semanticTheme: 'pink',
    quickActions: [
      { label: 'Assign homework', href: '/app/homework?tab=all', perm: 'homework:write' },
      { label: 'Review submissions', href: '/app/homework?tab=all', perm: 'homework:write' },
    ],
  },
  health: {
    description: 'Health records, sick bay & alerts',
    tileSize: 'md',
    semanticTheme: 'green',
    quickActions: [
      { label: 'Medical alerts', href: '/app/health?tab=alerts', perm: 'health:read' },
      { label: 'Sick bay log', href: '/app/health?tab=sickbay', perm: 'health:read' },
    ],
  },
  'front-office': {
    description: 'Visitors, gate passes & late slips',
    tileSize: 'sm',
    semanticTheme: 'blue',
    quickActions: [
      { label: 'Check in visitor', href: '/app/front-office?tab=visitors', perm: 'frontoffice:write' },
      { label: 'Issue gate pass', href: '/app/front-office?tab=gate-passes', perm: 'frontoffice:write' },
    ],
  },
  events: {
    description: 'Sports, cultural fests, trips & meets',
    tileSize: 'md',
    semanticTheme: 'purple',
    quickActions: [
      { label: 'Create event', href: '/app/events?tab=upcoming', perm: 'events:write' },
      { label: 'Registrations', href: '/app/events?tab=upcoming', perm: 'events:read' },
    ],
  },
  announcements: {
    description: 'Communicate with your community',
    tileSize: 'md',
    semanticTheme: 'pink',
    animation: '/animations/home/announcements.json',
    quickActions: [{ label: 'Send announcement', href: '/app/communication', perm: 'communication:write' }],
  },
  settings: {
    description: 'System preferences',
    tileSize: 'sm',
    semanticTheme: 'blue',
    animation: '/animations/home/settings.json',
  },
  audit: {
    description: 'Track system activities',
    tileSize: 'sm',
    semanticTheme: 'orange',
    animation: '/animations/home/audit_logs.json',
  },
  audit_logs: {
    description: 'Track system activities',
    tileSize: 'sm',
    semanticTheme: 'orange',
    animation: '/animations/home/audit_logs.json',
  },
  platform: {
    description: 'Multi-tenant platform console',
    tileSize: 'sm',
    semanticTheme: 'blue',
  },
}

export function homeModules(roleOrRoles: Role | Role[]): HomeModule[] {
  const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles]
  return navForRole(roles).map((n) => {
    const meta = MODULE_META[n.key] ?? DEFAULT_META
    const qas = (meta.quickActions ?? []).filter((qa) => !qa.perm || can(roles, qa.perm))
    return {
      ...n,
      description: meta.description,
      tileSize: meta.tileSize,
      semanticTheme: meta.semanticTheme ?? 'lavender',
      animation: meta.animation,
      quickActions: qas,
    }
  })
}
