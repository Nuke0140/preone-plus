import React from 'react'

export interface AuthViewportProps {
  children: React.ReactNode
  className?: string
}

export function AuthViewport({ children, className = '' }: AuthViewportProps) {
  return (
    <main className={`auth-viewport relative z-10 w-full flex-1 flex flex-col items-center justify-center px-4 py-6 sm:py-8 ${className}`}>
      {children}
    </main>
  )
}
