'use client'

import React from 'react'
import Link from 'next/link'
import { TactileButton } from './TactileMotion'
import {
  EnquiriesIllustration,
  FollowupsIllustration,
  ApplicationsIllustration,
  WaitingListIllustration,
  ClassroomsIllustration,
  StudentsIllustration,
  CurriculumIllustration,
  AttendanceIllustration,
  HealthIllustration,
  FinanceIllustration,
  PaymentsIllustration,
  InvoicesIllustration,
  CommunicationsIllustration,
  UsersIllustration,
  SetupIllustration,
  BrandingIllustration,
  ReportsIllustration,
  SearchIllustration,
  FilterIllustration,
  NotificationsIllustration,
  DocumentsIllustration,
  PermissionIllustration,
  DependencyIllustration,
  ErrorStateIllustration,
} from './EmptyStateIllustrations'

// ── 1. Type Definitions ─────────────────────────────────────────────────────

export type EmptyStateIllustration =
  | 'enquiries'
  | 'followups'
  | 'applications'
  | 'waitinglist'
  | 'classrooms'
  | 'placements'
  | 'students'
  | 'curriculum'
  | 'attendance'
  | 'health'
  | 'finance'
  | 'payments'
  | 'invoices'
  | 'communications'
  | 'users'
  | 'setup'
  | 'branding'
  | 'reports'
  | 'search'
  | 'filter'
  | 'notifications'
  | 'documents'
  | 'permission'
  | 'dependency'
  | 'error'

export interface EmptyStateAction {
  label: string
  onClick?: () => void
  href?: string
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
}

export interface EmptyStateProps {
  /** Canonical illustration key or custom ReactNode */
  illustration?: EmptyStateIllustration | React.ReactNode
  /** Backward compatibility icon support */
  icon?: React.ReactNode
  /** Module eyebrow label (e.g. 'Admissions') */
  eyebrow?: string
  /** Backward compatibility kicker support */
  kicker?: string
  /** Primary headline */
  title: string
  /** Descriptive guidance */
  description?: string
  /** Backward compatibility message */
  message?: string
  /** Backward compatibility why */
  why?: string
  /** Primary actionable step (object or custom ReactNode) */
  action?: EmptyStateAction | React.ReactNode
  /** Optional secondary action */
  secondaryAction?: EmptyStateAction | React.ReactNode
  /** Compact presentation for table rows, popovers, and widgets */
  compact?: boolean
  className?: string
  style?: React.CSSProperties
}

// ── 2. Canonical Module Configuration Mapping ───────────────────────────────

export const EMPTY_STATE_CONFIG = {
  enquiries: {
    illustration: 'enquiries' as const,
    eyebrow: 'Admissions',
    title: 'No enquiries yet',
    description: 'Your admissions pipeline is ready. Register your first parent enquiry to begin tracking prospective families.',
    actionLabel: '+ Register First Enquiry',
    actionHref: '/app/admissions/enquiries/new',
  },
  followups: {
    illustration: 'followups' as const,
    eyebrow: 'Admissions',
    title: 'No follow-ups due',
    description: "You're all caught up for now. Upcoming scheduled parent interactions will appear here.",
  },
  applications: {
    illustration: 'applications' as const,
    eyebrow: 'Admissions',
    title: 'No applications yet',
    description: 'Applications will appear here when prospective parents progress from enquiry to registration.',
    actionLabel: 'View Enquiries',
    actionHref: '/app/admissions',
  },
  waitinglist: {
    illustration: 'waitinglist' as const,
    eyebrow: 'Admissions',
    title: 'Waiting list is empty',
    description: 'Students who cannot immediately be allocated to a classroom division will be organized here.',
  },
  classrooms: {
    illustration: 'classrooms' as const,
    eyebrow: 'Operations',
    title: 'No classroom divisions yet',
    description: 'Add your first classroom division to begin student placement and daily attendance tracking.',
    actionLabel: '+ Add Classroom Division',
    actionHref: '/app/setup/classroom',
  },
  placements: {
    illustration: 'classrooms' as const,
    eyebrow: 'Admissions',
    title: 'No students ready for placement',
    description: 'Approved students will appear here once they are confirmed and ready for classroom allocation.',
  },
  students: {
    illustration: 'students' as const,
    eyebrow: 'Students',
    title: 'No students yet',
    description: 'Students enrolled through Admissions or imported directly will appear here.',
    actionLabel: '+ Add Student',
    actionHref: '/app/students/new',
  },
  curriculum: {
    illustration: 'curriculum' as const,
    eyebrow: 'Learning',
    title: 'No curriculum units yet',
    description: 'Create your first learning unit to start planning classroom milestones and daily experiences.',
    actionLabel: '+ Add Learning Unit',
  },
  attendance: {
    illustration: 'attendance' as const,
    eyebrow: 'Daily Care',
    title: 'No attendance recorded yet',
    description: 'Mark attendance for active classroom divisions to track daily preschool check-ins.',
    actionLabel: 'Open Attendance Register',
    actionHref: '/app/daily/attendance',
  },
  health: {
    illustration: 'health' as const,
    eyebrow: 'Health & Safety',
    title: 'No health records yet',
    description: 'Immunization tracking, allergy notes, and incident reports will be centralized here.',
  },
  finance: {
    illustration: 'finance' as const,
    eyebrow: 'Finance',
    title: 'No fee plans configured',
    description: 'Configure fee structures to automate term invoices, admission fees, and installment schedules.',
    actionLabel: '+ Create Fee Plan',
    actionHref: '/app/finance/plans',
  },
  payments: {
    illustration: 'payments' as const,
    eyebrow: 'Finance',
    title: 'No payments recorded yet',
    description: 'Collected fee payments and digital receipts will be organized in this transaction ledger.',
    actionLabel: '+ Record Payment',
  },
  invoices: {
    illustration: 'invoices' as const,
    eyebrow: 'Finance',
    title: 'No invoices generated yet',
    description: 'Invoices created for enrolled students will appear here for collection tracking.',
    actionLabel: '+ Generate Invoices',
  },
  communications: {
    illustration: 'communications' as const,
    eyebrow: 'Communication',
    title: 'No messages yet',
    description: 'Broadcast school announcements or share daily updates directly with enrolled families.',
    actionLabel: '+ New Announcement',
  },
  users: {
    illustration: 'users' as const,
    eyebrow: 'Users & Access',
    title: 'No staff users yet',
    description: 'Invite educators, administrators, and coordinators to collaborate in PreOne OS.',
    actionLabel: '+ Add User',
    actionHref: '/app/users',
  },
  setup: {
    illustration: 'setup' as const,
    eyebrow: 'Setup Engine',
    title: 'Ready for initialization',
    description: 'Complete foundational school configurations to activate operational modules.',
    actionLabel: 'Open Setup Checklist',
    actionHref: '/app/setup',
  },
  branding: {
    illustration: 'branding' as const,
    eyebrow: 'Branding Center',
    title: 'No brand identity customized',
    description: 'Upload your school crest and personalize UI colors to reflect your preschool identity.',
    actionLabel: 'Customize Branding',
    actionHref: '/app/setup/branding',
  },
  reports: {
    illustration: 'reports' as const,
    eyebrow: 'Analytics',
    title: 'No report data available',
    description: 'Operational analytics will populate as classroom, admission, and fee records accumulate.',
  },
  search: {
    illustration: 'search' as const,
    title: 'No results match your search',
    description: 'Try checking for spelling errors, using fewer keywords, or searching by a different term.',
  },
  filter: {
    illustration: 'filter' as const,
    title: 'Nothing matches these filters',
    description: 'Try adjusting or clearing one or more active filters to widen your results.',
  },
  permission: {
    illustration: 'permission' as const,
    title: 'No records available',
    description: 'There are currently no records available within your assigned scope. Contact an administrator to request access.',
  },
  dependency: {
    illustration: 'dependency' as const,
    title: 'Prerequisite setup incomplete',
    description: 'Complete the foundational setup configuration before proceeding with this operational module.',
  },
  error: {
    illustration: 'error' as const,
    title: "We couldn't load this data",
    description: 'A temporary network or server error occurred while retrieving this content. Please try again.',
  },
} as const

// ── 3. Helper: Render Illustration by Key ───────────────────────────────────

function renderIllustration(key: EmptyStateIllustration | React.ReactNode, size: number) {
  if (React.isValidElement(key)) {
    return key
  }

  switch (key) {
    case 'enquiries':
      return <EnquiriesIllustration size={size} />
    case 'followups':
      return <FollowupsIllustration size={size} />
    case 'applications':
      return <ApplicationsIllustration size={size} />
    case 'waitinglist':
      return <WaitingListIllustration size={size} />
    case 'classrooms':
    case 'placements':
      return <ClassroomsIllustration size={size} />
    case 'students':
      return <StudentsIllustration size={size} />
    case 'curriculum':
      return <CurriculumIllustration size={size} />
    case 'attendance':
      return <AttendanceIllustration size={size} />
    case 'health':
      return <HealthIllustration size={size} />
    case 'finance':
      return <FinanceIllustration size={size} />
    case 'payments':
      return <PaymentsIllustration size={size} />
    case 'invoices':
      return <InvoicesIllustration size={size} />
    case 'communications':
      return <CommunicationsIllustration size={size} />
    case 'users':
      return <UsersIllustration size={size} />
    case 'setup':
      return <SetupIllustration size={size} />
    case 'branding':
      return <BrandingIllustration size={size} />
    case 'reports':
      return <ReportsIllustration size={size} />
    case 'search':
      return <SearchIllustration size={size} />
    case 'filter':
      return <FilterIllustration size={size} />
    case 'notifications':
      return <NotificationsIllustration size={size} />
    case 'documents':
      return <DocumentsIllustration size={size} />
    case 'permission':
      return <PermissionIllustration size={size} />
    case 'dependency':
      return <DependencyIllustration size={size} />
    case 'error':
      return <ErrorStateIllustration size={size} />
    default:
      return <SearchIllustration size={size} />
  }
}

// ── 4. Helper: Render Action Buttons ────────────────────────────────────────

function renderActionNode(
  act: EmptyStateAction | React.ReactNode | undefined,
  isSecondary = false
) {
  if (!act) return null
  if (React.isValidElement(act)) return act

  const actionObj = act as EmptyStateAction
  const variant = actionObj.variant || (isSecondary ? 'secondary' : 'primary')
  const btnClass = `btn btn-${variant} tactile-btn ${actionObj.disabled ? 'is-disabled' : ''}`

  if (actionObj.href && !actionObj.disabled) {
    return (
      <Link href={actionObj.href} className={btnClass}>
        {actionObj.label}
      </Link>
    )
  }

  return (
    <TactileButton
      variant={variant}
      disabled={actionObj.disabled}
      onClick={actionObj.onClick}
    >
      {actionObj.label}
    </TactileButton>
  )
}

// ── 5. Main EmptyState Component ────────────────────────────────────────────

export function EmptyState({
  illustration,
  icon,
  eyebrow,
  kicker,
  title,
  description,
  message,
  why,
  action,
  secondaryAction,
  compact = false,
  className = '',
  style,
}: EmptyStateProps) {
  const effectiveEyebrow = eyebrow || kicker
  const effectiveDescription = description || message || why
  const effectiveIllustration = illustration || icon

  const illustrationSize = compact ? 64 : 96

  return (
    <div
      className={`preone-empty-state empty ${compact ? 'is-compact' : ''} ${className}`.trim()}
      style={style}
    >
      {effectiveIllustration && (
        <div
          className="empty-art empty-illustration shrink-0"
          aria-hidden="true"
        >
          {renderIllustration(effectiveIllustration, illustrationSize)}
        </div>
      )}

      {effectiveEyebrow && (
        <span className="empty-eyebrow eyebrow">
          {effectiveEyebrow}
        </span>
      )}

      <h3 className="empty-title empty-what">
        {title}
      </h3>

      {effectiveDescription && (
        <p className="empty-description empty-why">
          {effectiveDescription}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="empty-actions empty-next">
          {renderActionNode(action)}
          {renderActionNode(secondaryAction, true)}
        </div>
      )}
    </div>
  )
}

// ── 6. Specialized Empty State Variants ─────────────────────────────────────

/**
 * Empty search results state with quick clear action
 */
export function SearchEmptyState({
  query,
  onClear,
  compact = false,
}: {
  query?: string
  onClear?: () => void
  compact?: boolean
}) {
  return (
    <EmptyState
      illustration="search"
      title={query ? `No results for "${query}"` : 'No results match your search'}
      description="Check for typos, try using broader keywords, or clear your query to see all records."
      action={
        onClear
          ? {
              label: 'Clear Search',
              onClick: onClear,
              variant: 'secondary',
            }
          : undefined
      }
      compact={compact}
    />
  )
}

/**
 * Filter results empty state with quick clear filters action
 */
export function FilterEmptyState({
  onClearFilters,
  compact = false,
}: {
  onClearFilters?: () => void
  compact?: boolean
}) {
  return (
    <EmptyState
      illustration="filter"
      title="Nothing matches these filters"
      description="Try adjusting or clearing one or more active filters to broaden your results."
      action={
        onClearFilters
          ? {
              label: 'Clear Filters',
              onClick: onClearFilters,
              variant: 'secondary',
            }
          : undefined
      }
      compact={compact}
    />
  )
}

/**
 * Informational state when user lacks authorization scope
 */
export function PermissionEmptyState({
  title = 'No records available',
  description = 'There are currently no records available within your assigned permission scope. Contact your school administrator if you require additional access.',
  compact = false,
}: {
  title?: string
  description?: string
  compact?: boolean
}) {
  return (
    <EmptyState
      illustration="permission"
      eyebrow="Access Scope"
      title={title}
      description={description}
      compact={compact}
    />
  )
}

/**
 * Setup dependency missing state explaining prerequisite action
 */
export function DependencyEmptyState({
  prerequisiteName,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  compact = false,
}: {
  prerequisiteName?: string
  title?: string
  description?: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  compact?: boolean
}) {
  return (
    <EmptyState
      illustration="dependency"
      eyebrow="Prerequisite"
      title={title || `${prerequisiteName || 'Setup step'} incomplete`}
      description={
        description ||
        `Please complete ${prerequisiteName || 'the required configuration'} before continuing with this module.`
      }
      action={
        actionLabel
          ? {
              label: actionLabel,
              href: actionHref,
              onClick: onAction,
            }
          : undefined
      }
      compact={compact}
    />
  )
}

/**
 * Error state (Empty ≠ Error) with retry capability
 */
export function ErrorState({
  title = "We couldn't load this data",
  message = 'A temporary network or server error occurred. Please try again.',
  onRetry,
  compact = false,
}: {
  title?: string
  message?: string
  onRetry?: () => void
  compact?: boolean
}) {
  return (
    <EmptyState
      illustration="error"
      eyebrow="Connection Issue"
      title={title}
      description={message}
      action={
        onRetry
          ? {
              label: 'Retry Connection',
              onClick: onRetry,
              variant: 'secondary',
            }
          : undefined
      }
      compact={compact}
    />
  )
}
