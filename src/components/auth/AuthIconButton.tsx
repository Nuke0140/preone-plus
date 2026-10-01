import React from 'react'

export interface AuthIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode
  ariaLabel: string
  className?: string
}

/**
 * Reusable icon button for inside input fields (e.g. password visibility toggle, clear input).
 * Accessible, keyboard focusable, touch-friendly, zero raw HTML borders.
 */
export function AuthIconButton({
  icon,
  ariaLabel,
  className = '',
  ...props
}: AuthIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors bg-transparent border-0 outline-none appearance-none focus-visible:ring-2 focus-visible:ring-purple-500/30 cursor-pointer flex items-center justify-center ${className}`}
      {...props}
    >
      {icon}
    </button>
  )
}
