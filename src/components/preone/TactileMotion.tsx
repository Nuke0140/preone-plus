'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'

// ── 1. Animated Checkmark (SVG Stroke Draw) ─────────────────────────────────

export interface AnimatedCheckmarkProps {
  size?: number
  strokeWidth?: number
  className?: string
  color?: string
  /** If true, triggers the stroke-draw animation on mount or state change */
  animate?: boolean
}

export function AnimatedCheckmark({
  size = 16,
  strokeWidth = 2.5,
  className = '',
  color = 'currentColor',
  animate = true,
}: AnimatedCheckmarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`.trim()}
      aria-hidden="true"
    >
      <path
        d="M20 6L9 17L4 12"
        className={animate ? 'anim-checkmark' : ''}
        style={{
          strokeDasharray: 24,
          strokeDashoffset: 0,
        }}
      />
    </svg>
  )
}

// ── 2. Tactile Button (Scale 0.97 on Press + Status Feedback) ───────────────

export interface TactileButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'success' | 'hero'
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
  loading?: boolean
  loadingText?: string
  success?: boolean
  successText?: string
  children?: React.ReactNode
  className?: string
}

export function TactileButton({
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  loadingText,
  success = false,
  successText,
  children,
  className = '',
  disabled,
  ...rest
}: TactileButtonProps) {
  const variantClass = `btn-${variant}`
  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : ''

  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`btn ${variantClass} ${sizeClass} tactile-btn ${className}`.trim()}
      {...rest}
    >
      {loading ? (
        <>
          <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin shrink-0" />
          <span>{loadingText || children}</span>
        </>
      ) : success ? (
        <>
          <AnimatedCheckmark size={size === 'sm' ? 14 : 16} animate />
          <span>{successText || 'Saved'}</span>
        </>
      ) : (
        <>
          {icon && <span className="shrink-0">{icon}</span>}
          {children}
        </>
      )}
    </button>
  )
}

// ── 3. Interactive Card (2px Lift + Canonical Brand Shadow) ─────────────────

export interface InteractiveCardProps extends React.HTMLAttributes<HTMLDivElement> {
  lift?: boolean
  clickable?: boolean
  className?: string
  children: React.ReactNode
}

export function InteractiveCard({
  lift = true,
  clickable = true,
  className = '',
  children,
  ...rest
}: InteractiveCardProps) {
  return (
    <div
      className={`interactive-card ${lift ? 'card-lift' : ''} ${clickable ? 'cursor-pointer' : ''} ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  )
}
