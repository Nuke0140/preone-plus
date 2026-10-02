import React from 'react'

export interface AuthFrameProps {
  children: React.ReactNode
  className?: string
}

export function AuthFrame({ children, className = '' }: AuthFrameProps) {
  return (
    <div className={`auth-frame w-full max-w-[480px] mx-auto ${className}`}>
      {children}
    </div>
  )
}
