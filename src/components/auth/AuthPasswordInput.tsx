'use client'

import React, { useState, forwardRef } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { AuthInput, AuthInputProps } from './AuthInput'
import { AuthIconButton } from './AuthIconButton'

export interface AuthPasswordInputProps
  extends Omit<AuthInputProps, 'type' | 'leadingIcon' | 'trailingAction'> {
  showToggle?: boolean
}

export const AuthPasswordInput = forwardRef<HTMLInputElement, AuthPasswordInputProps>(
  ({ showToggle = true, className = '', ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false)

    return (
      <AuthInput
        ref={ref}
        type={showPassword ? 'text' : 'password'}
        leadingIcon={<Lock className="w-4 h-4" />}
        trailingAction={
          showToggle ? (
            <AuthIconButton
              icon={showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              ariaLabel={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((prev) => !prev)}
            />
          ) : undefined
        }
        className={`font-mono ${className}`}
        {...props}
      />
    )
  }
)

AuthPasswordInput.displayName = 'AuthPasswordInput'
