'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronRight, CheckCircle2, AlertTriangle, Sparkles, Clock, Circle } from 'lucide-react'
import { AnimatedCheckmark } from './TactileMotion'

export interface MetricCardProps {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  badge?: React.ReactNode
  progress?: number
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'
  accentColor?: string
  icon?: React.ReactNode
  onClick?: () => void
  className?: string
  ariaLabel?: string
}

export function MetricCard({
  label,
  value,
  sub,
  badge,
  progress,
  variant,
  accentColor,
  icon,
  onClick,
  className = '',
  ariaLabel,
}: MetricCardProps) {
  const isClickable = Boolean(onClick)
  const Tag = isClickable ? 'button' : 'div'

  const customStyle: React.CSSProperties = {}
  if (accentColor) {
    customStyle.borderTop = `3px solid ${accentColor}`
  }

  return (
    <Tag
      {...(isClickable ? { type: 'button', onClick, tabIndex: 0 } : {})}
      className={`metro-metric-card ${variant ? `m-var-${variant}` : ''} ${className}`.trim()}
      style={customStyle}
      aria-label={ariaLabel || label}
    >
      <div className="m-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span className="m-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
          {label}
        </span>
        {badge && <span className="m-badge">{badge}</span>}
      </div>

      <div className="m-val">{value}</div>

      {progress !== undefined && (
        <div
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{
            width: '100%',
            height: 4,
            background: 'var(--border-subtle)',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden',
            marginTop: 4,
            marginBottom: 4,
          }}
        >
          <div
            style={{
              width: `${Math.min(100, Math.max(0, progress))}%`,
              height: '100%',
              borderRadius: 'var(--radius-full)',
              background: accentColor || 'var(--primary)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      )}

      {sub && <div className="m-sub">{sub}</div>}
    </Tag>
  )
}

export interface SetupPhaseCardProps {
  phaseNumber: number
  phaseKey: 'foundation' | 'academic' | 'business' | 'operations' | string
  title: string
  description: string
  completedCount: number
  totalCount: number
  children: React.ReactNode
  onViewDetails?: () => void
  viewDetailsText?: string
  className?: string
}

export function SetupPhaseCard({
  phaseNumber,
  phaseKey,
  title,
  description,
  completedCount,
  totalCount,
  children,
  onViewDetails,
  viewDetailsText,
  className = '',
}: SetupPhaseCardProps) {
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className={`setup-phase-card phase-${phaseKey} ${className}`.trim()}>
      <div className="setup-phase-head">
        <div className="setup-phase-meta">
          <span className="setup-phase-num-pill">PHASE {phaseNumber}</span>
          <span className="setup-phase-count" aria-label={`${completedCount} of ${totalCount} steps completed`}>
            {completedCount}/{totalCount} Done
          </span>
        </div>
        <h3 className="setup-phase-title">{title}</h3>
        <p className="setup-phase-desc">{description}</p>
        <div
          className="setup-phase-progress-bar"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${title} progress: ${pct}%`}
        >
          <div className="setup-phase-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="setup-phase-body">
        {children}
      </div>

      {onViewDetails && (
        <div className="setup-phase-foot">
          <button
            type="button"
            className="setup-phase-action-link"
            onClick={onViewDetails}
          >
            {viewDetailsText || `View ${title} Details`}
            <ArrowRight size={13} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}

export interface SetupStepTileProps {
  href?: string
  icon?: React.ReactNode
  name: string
  status: 'COMPLETE' | 'BLOCKED' | 'SKIPPED' | 'NOT_STARTED' | 'IN_PROGRESS' | string
  statusBadge?: React.ReactNode
  applicability?: 'MANDATORY' | 'RECOMMENDED' | 'OPTIONAL' | string
  helper?: string
  onClick?: () => void
  className?: string
}

export function SetupStepTile({
  href,
  icon,
  name,
  status,
  statusBadge,
  applicability,
  helper,
  onClick,
  className = '',
}: SetupStepTileProps) {
  const isComplete = status === 'COMPLETE'
  const isBlocked = status === 'BLOCKED'
  const isSkipped = status === 'SKIPPED'

  const stateClass = isComplete
    ? 'is-complete'
    : isBlocked
    ? 'is-blocked'
    : isSkipped
    ? 'is-skipped'
    : ''

  const defaultIcon = isComplete ? (
    <AnimatedCheckmark size={16} animate={false} />
  ) : isBlocked ? (
    <AlertTriangle size={16} />
  ) : isSkipped ? (
    <Clock size={16} />
  ) : (
    <Circle size={16} />
  )

  const content = (
    <>
      <div className="setup-step-ic" aria-hidden="true">
        {icon || defaultIcon}
      </div>
      <div className="setup-step-info">
        <div className="setup-step-name" title={name}>{name}</div>
        <div className="setup-step-meta">
          {statusBadge}
          {applicability && applicability !== 'MANDATORY' && (
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {applicability}
            </span>
          )}
        </div>
        {helper && (
          <span
            style={{
              fontSize: 11.5,
              color: 'var(--text-muted)',
              lineHeight: 1.3,
              marginTop: 2,
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {helper}
          </span>
        )}
      </div>
      <ChevronRight
        size={14}
        aria-hidden="true"
        style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 4 }}
      />
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        className={`setup-step-tile ${stateClass} ${className}`.trim()}
        onClick={onClick}
      >
        {content}
      </Link>
    )
  }

  return (
    <button
      type="button"
      className={`setup-step-tile ${stateClass} ${className}`.trim()}
      onClick={onClick}
    >
      {content}
    </button>
  )
}

export interface SetupRecommendationBannerProps {
  title: string
  description: string
  icon?: React.ReactNode
  primaryAction?: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
  }
  secondaryAction?: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
  }
  className?: string
}

export function SetupRecommendationBanner({
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
  className = '',
}: SetupRecommendationBannerProps) {
  return (
    <section className={`setup-recommend-banner ${className}`.trim()} aria-label="Next recommended setup step">
      <div className="setup-recommend-content">
        <div className="setup-recommend-icon" aria-hidden="true">
          {icon || <Sparkles size={18} />}
        </div>
        <div className="setup-recommend-body">
          <div className="setup-recommend-title">
            <span>Next Recommended Step:</span>
            <span>{title}</span>
          </div>
          <p className="setup-recommend-desc">{description}</p>
        </div>
      </div>
      {(primaryAction || secondaryAction) && (
        <div className="setup-recommend-actions">
          {secondaryAction && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.icon}
              <span>{secondaryAction.label}</span>
            </button>
          )}
          {primaryAction && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={primaryAction.onClick}
            >
              {primaryAction.icon}
              <span>{primaryAction.label}</span>
            </button>
          )}
        </div>
      )}
    </section>
  )
}
