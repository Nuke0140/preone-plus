import React, { forwardRef } from 'react'
import { Input, InputProps } from '@/components/ui/input'

export interface AuthInputProps extends InputProps {}

/**
 * Reusable AuthInput component.
 * Consumes the global Input primitive with auth variant tokens,
 * integrated leading icon slots, and trailing action controls.
 */
export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ inputSize = 'auth', className = '', ...props }, ref) => {
    return (
      <Input
        ref={ref}
        inputSize={inputSize}
        className={className}
        {...props}
      />
    )
  }
)

AuthInput.displayName = 'AuthInput'
