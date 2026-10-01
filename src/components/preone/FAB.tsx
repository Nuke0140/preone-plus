'use client'

import React from 'react'
import { Plus } from 'lucide-react'

export interface FABProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode
  label?: string
  onClick?: () => void
  color?: string
  className?: string
}

export function FAB({
  icon = <Plus size={24} />,
  label = 'Add new item',
  onClick,
  color,
  className = '',
  style,
  ...rest
}: FABProps) {
  return (
    <button
      type="button"
      className={`btn-fab ${className}`}
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        position: 'fixed',
        bottom: 'calc(var(--taskbar-h, 64px) + 16px)',
        right: '18px',
        width: '56px',
        height: '56px',
        borderRadius: '9999px',
        background: color || 'var(--primary, #7C3AED)',
        color: 'var(--primary-foreground, #FFFFFF)',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 10px 25px -3px color-mix(in srgb, var(--primary, #7C3AED) 45%, transparent), 0 4px 10px -2px rgba(0, 0, 0, 0.1)',
        cursor: 'pointer',
        zIndex: 'var(--z-drawer, 400)',
        transition: 'transform 0.18s cubic-bezier(0.2, 0.7, 0.3, 1), box-shadow 0.18s ease',
        outline: 'none',
        ...style,
      }}
      {...rest}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s ease',
        }}
      >
        {icon}
      </span>
    </button>
  )
}
