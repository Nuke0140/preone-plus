import React from 'react'

export interface AuthFormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode
  className?: string
}

export function AuthForm({ children, className = '', onSubmit, ...props }: AuthFormProps) {
  return (
    <form
      className={`auth-form w-full space-y-4 ${className}`}
      onSubmit={onSubmit}
      noValidate
      {...props}
    >
      {children}
    </form>
  )
}
