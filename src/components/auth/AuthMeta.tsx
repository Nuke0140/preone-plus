import React from 'react'
import { ShieldCheck } from 'lucide-react'

export interface AuthMetaProps {
  label?: string
  className?: string
}

export function AuthMeta({
  label = 'Secure PreOne workspace • Role-based access',
  className = '',
}: AuthMetaProps) {
  return (
    <div
      className={`auth-meta mt-6 pt-4 border-t border-slate-100/80 dark:border-slate-800/60 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 select-none ${className}`}
    >
      <ShieldCheck className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
      <span>{label}</span>
    </div>
  )
}
