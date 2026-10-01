import React from 'react'

export interface AuthLinkProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  className?: string
}

/**
 * Reusable inline action / link for secondary authentication actions.
 * Zero browser borders, zero gray background, subtle hover transitions.
 */
export function AuthLink({ children, className = '', ...props }: AuthLinkProps) {
  return (
    <button
      type="button"
      className={`text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline transition-colors cursor-pointer bg-transparent border-0 p-0 outline-none appearance-none focus-visible:ring-2 focus-visible:ring-purple-500/30 rounded-xs ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
