import React from 'react'

export interface AuthHeaderProps {
  title: string
  description?: string
  className?: string
}

export function AuthHeader({ title, description, className = '' }: AuthHeaderProps) {
  return (
    <div className={`auth-header text-center mb-7 relative z-10 ${className}`}>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
        {title}
      </h1>
      {description && (
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
          {description}
        </p>
      )}
    </div>
  )
}
