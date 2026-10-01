import React from 'react'
import { Card } from '@/components/ui/card'

export interface AuthCardProps {
  children: React.ReactNode
  className?: string
}

export function AuthCard({ children, className = '' }: AuthCardProps) {
  return (
    <Card
      variant="auth"
      className={`auth-card relative w-full rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800 shadow-[0_20px_60px_-15px_rgba(124,58,237,0.12),0_8px_24px_-8px_rgba(0,0,0,0.04)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] p-5 xs:p-7 sm:p-9 transition-all relative overflow-hidden ${className}`}
    >
      {/* Subtle Top Highlight Accent */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent pointer-events-none" />
      {/* Decorative Subtle Corner Gradient Accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-purple-100/40 via-pink-50/15 to-transparent dark:from-purple-900/15 dark:to-transparent rounded-tr-3xl pointer-events-none" />
      {children}
    </Card>
  )
}
