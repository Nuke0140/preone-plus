'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { initials, avatarClass, enumLabel } from '@/lib/format'

export function Avatar({
  name,
  src,
  size,
  className,
}: {
  name?: string | null
  src?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const [imgError, setImgError] = React.useState(false)
  const safeName = name || ''

  if (src && !imgError) {
    return (
      <span className={`avatar ${size || ''} ${className || ''}`} style={{ overflow: 'hidden', padding: 0 }} aria-hidden="true">
        <img
          src={src}
          alt={safeName}
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit', display: 'block' }}
        />
      </span>
    )
  }

  return (
    <span className={`avatar ${size || ''} ${avatarClass(safeName)} ${className || ''}`} aria-hidden="true">
      {initials(safeName)}
    </span>
  )
}

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode
  label: string
  title?: string
  variant?: 'ghost' | 'secondary' | 'outline' | 'primary'
  size?: 'sm' | 'md' | 'lg'
  danger?: boolean
}

export function IconButton({
  icon,
  label,
  onClick,
  title,
  variant = 'ghost',
  size = 'md',
  danger = false,
  disabled = false,
  className = '',
  type = 'button',
  ...rest
}: IconButtonProps) {
  const tooltipText = title || label
  return (
    <button
      type={type}
      className={`btn-icon btn-icon-${size} btn-icon-${variant}${danger ? ' btn-icon-danger' : ''} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={tooltipText}
      {...rest}
    >
      {icon}
    </button>
  )
}
export type SemanticStatusVariant =
  | 'success'
  | 'pending'
  | 'waiting'
  | 'urgent'
  | 'warning'
  | 'info'
  | 'neutral'
  | 'primary'
  | 'pink'

export interface StatusPillConfig {
  variant: SemanticStatusVariant
  cls: string
  dot?: boolean
  pulse?: boolean
  label?: string
}

export const STATUS_SEMANTIC_MAP: Record<string, StatusPillConfig> = {
  // students
  ACTIVE: { variant: 'success', cls: 'status-pill-success', dot: true },
  INACTIVE: { variant: 'neutral', cls: 'status-pill-neutral' },
  TRANSFERRED: { variant: 'info', cls: 'status-pill-info' },
  GRADUATED: { variant: 'primary', cls: 'status-pill-primary' },
  ARCHIVED: { variant: 'neutral', cls: 'status-pill-neutral' },
  // leads
  NEW: { variant: 'info', cls: 'status-pill-info', dot: true },
  CONTACTED: { variant: 'primary', cls: 'status-pill-primary' },
  QUALIFIED: { variant: 'pending', cls: 'status-pill-pending' },
  NURTURE: { variant: 'neutral', cls: 'status-pill-neutral' },
  APPLICATION_STARTED: { variant: 'warning', cls: 'status-pill-warning' },
  CONVERTED: { variant: 'success', cls: 'status-pill-success', dot: true },
  LOST: { variant: 'urgent', cls: 'status-pill-urgent' },
  DUPLICATE: { variant: 'neutral', cls: 'status-pill-neutral' },
  // applications
  SUBMITTED: { variant: 'info', cls: 'status-pill-info', dot: true },
  DOCUMENT_PENDING: { variant: 'pending', cls: 'status-pill-pending', dot: true, pulse: true },
  VERIFIED: { variant: 'primary', cls: 'status-pill-primary' },
  UNDER_REVIEW: { variant: 'pending', cls: 'status-pill-pending', dot: true, pulse: true },
  APPROVED: { variant: 'success', cls: 'status-pill-success', dot: true },
  REJECTED: { variant: 'urgent', cls: 'status-pill-urgent', dot: true },
  WAITLISTED: { variant: 'waiting', cls: 'status-pill-waiting', dot: true },
  ENROLLED: { variant: 'success', cls: 'status-pill-success', dot: true },
  WITHDRAWN: { variant: 'neutral', cls: 'status-pill-neutral' },
  // invoices & finance
  DRAFT: { variant: 'neutral', cls: 'status-pill-neutral' },
  ISSUED: { variant: 'info', cls: 'status-pill-info' },
  PARTIALLY_PAID: { variant: 'warning', cls: 'status-pill-warning', dot: true },
  PAID: { variant: 'success', cls: 'status-pill-success', dot: true },
  OVERDUE: { variant: 'urgent', cls: 'status-pill-urgent', dot: true },
  CANCELLED: { variant: 'neutral', cls: 'status-pill-neutral' },
  WRITTEN_OFF: { variant: 'neutral', cls: 'status-pill-neutral' },
  REFUNDED: { variant: 'neutral', cls: 'status-pill-neutral' },
  // attendance
  PRESENT: { variant: 'success', cls: 'status-pill-success', dot: true },
  ABSENT: { variant: 'urgent', cls: 'status-pill-urgent', dot: true },
  LATE: { variant: 'warning', cls: 'status-pill-warning', dot: true },
  HALF_DAY: { variant: 'info', cls: 'status-pill-info' },
  LEAVE: { variant: 'neutral', cls: 'status-pill-neutral' },
  // announcements & notices
  GENERAL: { variant: 'neutral', cls: 'status-pill-neutral' },
  HOLIDAY: { variant: 'success', cls: 'status-pill-success' },
  EMERGENCY: { variant: 'urgent', cls: 'status-pill-urgent', dot: true },
  EVENT: { variant: 'pink', cls: 'status-pill-pink' },
  ACHIEVEMENT: { variant: 'warning', cls: 'status-pill-warning' },
  IMPORTANT: { variant: 'pending', cls: 'status-pill-pending', dot: true },
  FEE_REMINDER: { variant: 'info', cls: 'status-pill-info' },
  ACADEMIC: { variant: 'primary', cls: 'status-pill-primary' },
  // observations
  PUBLISHED: { variant: 'success', cls: 'status-pill-success', dot: true },
  // inventory & procurement
  PENDING: { variant: 'pending', cls: 'status-pill-pending', dot: true, pulse: true },
  PARTIALLY_FULFILLED: { variant: 'warning', cls: 'status-pill-warning' },
  FULFILLED: { variant: 'success', cls: 'status-pill-success', dot: true },
  ORDERED: { variant: 'info', cls: 'status-pill-info' },
  PARTIALLY_RECEIVED: { variant: 'warning', cls: 'status-pill-warning' },
  RECEIVED: { variant: 'success', cls: 'status-pill-success', dot: true },
  FINALIZED: { variant: 'success', cls: 'status-pill-success', dot: true },
  COMPLETED: { variant: 'success', cls: 'status-pill-success', dot: true },
  RETURNED: { variant: 'info', cls: 'status-pill-info' },
  CONSUMABLE: { variant: 'primary', cls: 'status-pill-primary' },
  ASSET: { variant: 'info', cls: 'status-pill-info' },
  STATIONERY: { variant: 'pink', cls: 'status-pill-pink' },
  LEARNING_KIT: { variant: 'pending', cls: 'status-pill-pending' },
  UNIFORM: { variant: 'warning', cls: 'status-pill-warning' },
  FIRST_AID: { variant: 'urgent', cls: 'status-pill-urgent' },
  CLEANING: { variant: 'neutral', cls: 'status-pill-neutral' },
  KITCHEN_PANTRY: { variant: 'pending', cls: 'status-pill-pending' },
  EVENT_PROP: { variant: 'pink', cls: 'status-pill-pink' },
  OTHER: { variant: 'neutral', cls: 'status-pill-neutral' },
  // Setup & health
  COMPLETE: { variant: 'success', cls: 'status-pill-success', dot: true },
  READY: { variant: 'success', cls: 'status-pill-success', dot: true },
  CONFIGURED: { variant: 'success', cls: 'status-pill-success', dot: true },
  IN_PROGRESS: { variant: 'pending', cls: 'status-pill-pending', dot: true, pulse: true },
  NOT_STARTED: { variant: 'neutral', cls: 'status-pill-neutral' },
  OPTIONAL: { variant: 'neutral', cls: 'status-pill-neutral' },
  ERROR: { variant: 'urgent', cls: 'status-pill-urgent', dot: true },
  BLOCKED: { variant: 'urgent', cls: 'status-pill-urgent', dot: true },
}

// Backwards compatibility alias for code expecting STATUS_BADGE
export const STATUS_BADGE: Record<string, { cls: string; dot?: boolean }> = Object.fromEntries(
  Object.entries(STATUS_SEMANTIC_MAP).map(([key, val]) => [key, { cls: val.cls, dot: val.dot }])
)

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: string
  variant?: SemanticStatusVariant
  label?: string
  dot?: boolean
  pulse?: boolean
  size?: 'sm' | 'md'
  icon?: React.ReactNode
  className?: string
}

/**
 * PreOne OS Global Dual-Tone Semantic Status Pill.
 * Features soft semantic background, accessible semantic text, subtle border,
 * status dot, optional live pulse, and calm hover micro-interactions.
 */
export function StatusPill({
  status,
  variant: propVariant,
  label,
  dot: propDot,
  pulse: propPulse,
  size = 'md',
  icon,
  className = '',
  children,
  ...rest
}: StatusPillProps) {
  const normStatus = status ? status.toUpperCase().replace(/\s+/g, '_') : ''
  const config = (normStatus && STATUS_SEMANTIC_MAP[normStatus]) || {
    variant: propVariant || 'neutral',
    cls: `status-pill-${propVariant || 'neutral'}`,
    dot: propDot !== undefined ? propDot : false,
    pulse: propPulse !== undefined ? propPulse : false,
  }

  const effectiveVariant = propVariant || config.variant || 'neutral'
  const variantClass = `status-pill-${effectiveVariant}`
  const showDot = propDot !== undefined ? propDot : (config.dot ?? true)
  const isPulsing = propPulse !== undefined ? propPulse : (config.pulse ?? false)
  const displayText = label || children || (status ? enumLabel(status) : '')

  return (
    <span
      className={`status-pill ${variantClass} ${size === 'sm' ? 'status-pill-sm' : ''} ${className}`.trim()}
      {...rest}
    >
      {icon ? (
        <span className="shrink-0">{icon}</span>
      ) : showDot ? (
        <span
          className={`status-dot ${isPulsing ? 'status-dot-pulse' : ''}`}
          aria-hidden="true"
        />
      ) : null}
      <span>{displayText}</span>
    </span>
  )
}

/**
 * Backwards-compatible StatusBadge across PreOne OS modules.
 * Seamlessly renders the Dual-Tone Semantic Status Pill design.
 */
export function StatusBadge({
  status,
  label,
  dot,
  pulse,
  size,
  className,
}: {
  status: string
  label?: string
  dot?: boolean
  pulse?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <StatusPill
      status={status}
      label={label}
      dot={dot}
      pulse={pulse}
      size={size}
      className={className}
    />
  )
}

export * from './EmptyState'

export function Card({
  children,
  variant = 'default',
  className = '',
  onClick,
  style,
  as: Component = 'div',
  ...props
}: {
  children: React.ReactNode
  variant?: 'default' | 'compact' | 'featured' | 'metric' | 'interactive' | 'warning' | 'success' | 'info' | 'nav'
  className?: string
  onClick?: () => void
  style?: React.CSSProperties
  as?: React.ElementType
  [key: string]: any
}) {
  const varClass = variant !== 'default' ? `card-${variant}` : ''
  return (
    <Component
      className={`card ${varClass} ${className}`.trim()}
      style={style}
      onClick={onClick}
      {...(onClick && Component === 'div' ? { role: 'button', tabIndex: 0 } : {})}
      {...props}
    >
      {children}
    </Component>
  )
}

export function KpiTile({
  label, value, unit, icon, iconClass, meta, trend, onClick, active, variant, hero, className = '',
}: {
  label: string
  value: string | number
  unit?: string
  icon: React.ReactNode
  iconClass: string
  meta?: string
  trend?: { dir: 'up' | 'down' | 'flat'; text: string }
  onClick?: () => void
  active?: boolean
  variant?: 'hero' | 'primary' | 'secondary' | 'compact'
  hero?: boolean
  className?: string
}) {
  const isHero = hero || variant === 'hero' || variant === 'primary'
  const vClass = isHero ? 'kpi-hero' : variant ? `kpi-${variant}` : ''
  return (
    <div
      className={`kpi ${vClass}${onClick ? ' clickable' : ''}${active ? ' active' : ''} ${className}`}
      aria-pressed={onClick && active != null ? active : undefined}
      {...(onClick
        ? {
            role: 'button',
            tabIndex: 0,
            onClick,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            },
          }
        : {})}
    >
      <div className="kpi-top">
        <div className={`kpi-ic ${iconClass}`}>{icon}</div>
        {trend && <span className={`trend ${trend.dir}`}>{trend.text}</span>}
      </div>
      <div>
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">
          {value}
          {unit && <span className="unit">{unit}</span>}
        </div>
      </div>
      {meta && <div className="kpi-meta">{meta}</div>}
    </div>
  )
}

export function MicroEyebrow({
  children,
  className = '',
  as: Component = 'div',
  style,
}: {
  children: React.ReactNode
  className?: string
  as?: React.ElementType
  style?: React.CSSProperties
}) {
  return (
    <Component className={`micro-eyebrow ${className}`.trim()} style={style}>
      {children}
    </Component>
  )
}

export function TabularNumber({
  children,
  className = '',
  as: Component = 'span',
  style,
}: {
  children: React.ReactNode
  className?: string
  as?: React.ElementType
  style?: React.CSSProperties
}) {
  return (
    <Component className={`font-tabular tabular-nums ${className}`.trim()} style={style}>
      {children}
    </Component>
  )
}

export function DataValue({
  value,
  label,
  meta,
  className = '',
}: {
  value: React.ReactNode
  label?: string
  meta?: string
  className?: string
}) {
  return (
    <div className={`data-value-wrap ${className}`.trim()}>
      {label && <div className="micro-eyebrow">{label}</div>}
      <div className="font-tabular font-semibold text-foreground text-sm">{value}</div>
      {meta && <div className="text-xs text-muted-foreground">{meta}</div>}
    </div>
  )
}

export function SectionHeader({
  title,
  eyebrow,
  description,
  actions,
  className = '',
}: {
  title: React.ReactNode
  eyebrow?: string
  description?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`section-header ${className}`.trim()}>
      <div>
        {eyebrow && <div className="micro-eyebrow">{eyebrow}</div>}
        <h2 className="section-title">{title}</h2>
        {description && <p className="section-description">{description}</p>}
      </div>
      {actions && <div className="section-actions">{actions}</div>}
    </div>
  )
}

export function PageHead({
  title, sub, description, actions, eyebrow, badge, backHref,
}: {
  title: React.ReactNode
  sub?: string
  description?: string
  actions?: React.ReactNode
  eyebrow?: string
  badge?: React.ReactNode
  backHref?: string
}) {
  const desc = description || sub
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="page-eyebrow micro-eyebrow">{eyebrow}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {backHref && (
            <Link
              href={backHref}
              tabIndex={-1}
              className="btn btn-ghost"
              style={{
                width: 34,
                height: 34,
                padding: 0,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                outline: 'none',
                boxShadow: 'none',
              }}
              title="Back"
            >
              <ChevronLeft size={18} />
            </Link>
          )}
          <h1 className="page-title" style={{ margin: 0 }}>
            {title}
            {badge && <span className="page-head-badge">{badge}</span>}
          </h1>
        </div>
        {desc && <p className="page-description sub">{desc}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}

export const PageHeader = PageHead

export function Segmented({
  options, value, onChange,
}: {
  options: { key: string; label: string }[]
  value: string
  onChange: (k: string) => void
}) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button
          suppressHydrationWarning
          key={o.key}
          role="tab"
          aria-selected={value === o.key}
          className={value === o.key ? 'on' : ''}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Skeleton({
  h, w, variant, className = '',
}: {
  h?: number | string
  w?: number | string
  variant?: 'text' | 'kpi' | 'row' | 'card'
  className?: string
}) {
  const vClass = variant ? `skel-${variant}` : ''
  const defaultHeight = variant === 'kpi' ? 124 : variant === 'card' ? 190 : variant === 'row' ? 42 : (h ?? 16)
  return <div className={`skel ${vClass} ${className}`} style={{ height: defaultHeight, width: w ?? '100%' }} />
}

export function Field({
  label, required, helper, children,
}: {
  label: string
  required?: boolean
  helper?: string
  children: React.ReactNode
}) {
  return (
    <div className="field">
      <label>
        {label} {required && <span className="req">*</span>}
      </label>
      {children}
      {helper && <span className="helper">{helper}</span>}
    </div>
  )
}

export * from './Typography'
export * from './ZenTable'
export * from './TactileMotion'

