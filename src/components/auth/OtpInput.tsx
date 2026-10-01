'use client'

import React, { useRef, useEffect } from 'react'

export interface OtpInputProps {
  value: string[]
  onChange: (value: string[]) => void
  length?: number
  hasError?: boolean
  disabled?: boolean
  className?: string
}

export function OtpInput({
  value,
  onChange,
  length = 4,
  hasError = false,
  disabled = false,
  className = '',
}: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus()
  }, [])

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value

    if (rawVal.length > 1) {
      // Handle paste
      const digits = rawVal.replace(/\D/g, '').slice(0, length).split('')
      const nextOtp = [...value]
      digits.forEach((d, i) => {
        if (i < length) nextOtp[i] = d
      })
      onChange(nextOtp)
      const nextFocus = Math.min(digits.length, length - 1)
      inputRefs.current[nextFocus]?.focus()
      return
    }

    const digit = rawVal.replace(/\D/g, '')
    const nextOtp = [...value]
    nextOtp[index] = digit
    onChange(nextOtp)

    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  return (
    <div className={`otp-input-group flex items-center justify-center gap-3 sm:gap-4 my-2 ${className}`}>
      {Array.from({ length }).map((_, idx) => (
        <input
          key={idx}
          ref={(el) => {
            inputRefs.current[idx] = el
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          disabled={disabled}
          value={value[idx] || ''}
          onChange={(e) => handleChange(idx, e)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          aria-label={`Verification code digit ${idx + 1}`}
          className={`w-14 h-14 sm:w-16 sm:h-16 text-center text-xl sm:text-2xl font-bold font-mono rounded-2xl bg-slate-50/80 dark:bg-slate-950/70 border transition-all outline-none ${
            hasError
              ? 'border-rose-300 dark:border-rose-800 text-rose-600 ring-2 ring-rose-500/20'
              : 'border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-white focus:border-purple-600 focus:ring-4 focus:ring-purple-500/20'
          }`}
        />
      ))}
    </div>
  )
}
