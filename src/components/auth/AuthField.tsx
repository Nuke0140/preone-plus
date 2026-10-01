import React from 'react'
import { Label } from '@/components/ui/label'

export interface AuthFieldProps {
  id: string
  label: string
  labelAction?: React.ReactNode
  error?: string
  children: React.ReactNode
  className?: string
}

/**
 * Reusable AuthField component.
 * Uses global Label primitive, ensures consistent label hierarchy, deliberate spacing,
 * inline action alignment, and field-level error messages without colliding with controls.
 */
export function AuthField({
  id,
  label,
  labelAction,
  error,
  children,
  className = '',
}: AuthFieldProps) {
  return (
    <div className={`auth-field w-full space-y-2 ${className}`}>
      {/* Label Row with deliberate spacing and optional action */}
      <div className="flex items-center justify-between">
        <Label
          htmlFor={id}
          className="text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-normal"
        >
          {label}
        </Label>
        {labelAction && <div>{labelAction}</div>}
      </div>

      {/* Input Child Component */}
      <div className="relative w-full">
        {children}
      </div>

      {/* Field-level error */}
      {error && (
        <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium animate-in fade-in duration-150">
          {error}
        </p>
      )}
    </div>
  )
}
