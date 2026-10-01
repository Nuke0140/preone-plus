import React from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface AuthActionsProps {
  primaryText?: string
  loadingText?: string
  loading?: boolean
  disabled?: boolean
  icon?: React.ReactNode
  secondaryAction?: React.ReactNode
  className?: string
}

/**
 * Reusable AuthActions component.
 * Houses the primary authentication CTA (consuming global Button variant="primary")
 * and secondary action slots with confident typography, subtle depth, and smooth loading states.
 */
export function AuthActions({
  primaryText = 'Sign In',
  loadingText = 'Signing in...',
  loading = false,
  disabled = false,
  icon = <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />,
  secondaryAction,
  className = '',
}: AuthActionsProps) {
  return (
    <div className={`auth-actions w-full pt-2 space-y-3.5 ${className}`}>
      <Button
        type="submit"
        variant="primary"
        size="auth"
        disabled={disabled || loading}
        className="auth-button w-full h-12 rounded-xl text-sm font-semibold shadow-md shadow-purple-600/25 dark:shadow-purple-950/40 hover:shadow-lg hover:shadow-purple-600/30 active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer group"
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>{loadingText}</span>
          </>
        ) : (
          <>
            <span>{primaryText}</span>
            {icon}
          </>
        )}
      </Button>

      {secondaryAction && <div className="text-center">{secondaryAction}</div>}
    </div>
  )
}
