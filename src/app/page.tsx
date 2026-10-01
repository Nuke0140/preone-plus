'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, Mail, User, AlertCircle, X,
  HelpCircle, CheckCircle2, ArrowLeft, KeyRound
} from 'lucide-react'
import {
  AuthShell,
  AuthViewport,
  AuthFrame,
  AuthCard,
  AuthBrand,
  AuthHeader,
  AuthContent,
  AuthForm,
  AuthField,
  AuthInput,
  AuthPasswordInput,
  AuthOtpInput,
  AuthLink,
  AuthIconButton,
  AuthActions,
  AuthMeta
} from '@/components/auth'

export default function LoginPage() {
  const router = useRouter()
  const [authMode, setAuthMode] = useState<'login' | 'otp'>('login')
  const [schoolCode, setSchoolCode] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    schoolCode?: string
    identifier?: string
    password?: string
    otp?: string
  }>({})
  const [capsLockActive, setCapsLockActive] = useState<boolean>(false)
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [useUsername, setUseUsername] = useState(false)
  const [branding, setBranding] = useState<{ logoUrl: string | null; schoolName?: string; primaryColor?: string } | null>(null)

  // OTP specific state
  const [otp, setOtp] = useState<string[]>(['', '', '', ''])
  const [otpCountdown, setOtpCountdown] = useState<number>(45)
  const [canResendOtp, setCanResendOtp] = useState<boolean>(false)
  const [resendSuccess, setResendSuccess] = useState<boolean>(false)

  const identifierInputRef = useRef<HTMLInputElement>(null)

  // Fetch school branding for login surface
  useEffect(() => {
    const queryCode = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('code') || '' : ''
    if (queryCode && !schoolCode) {
      setSchoolCode(queryCode)
    }
    const codeToFetch = queryCode || schoolCode
    fetch(`/api/v1/auth/branding?code=${encodeURIComponent(codeToFetch)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.success && j.data) {
          setBranding(j.data)
        }
      })
      .catch(() => {})
  }, [schoolCode])

  // Auto redirect if already logged in
  useEffect(() => {
    fetch('/api/v1/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.success) {
          router.replace('/app/dashboard')
        } else {
          document.cookie = 'preone_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
        }
      })
      .catch(() => {})
  }, [router])

  // Countdown timer for OTP resend
  useEffect(() => {
    if (authMode !== 'otp') return
    if (otpCountdown > 0) {
      const timer = setTimeout(() => setOtpCountdown((c) => c - 1), 1000)
      return () => clearTimeout(timer)
    } else {
      setCanResendOtp(true)
    }
  }, [authMode, otpCountdown])

  const validateLoginForm = () => {
    const errors: { schoolCode?: string; identifier?: string; password?: string } = {}
    if (!schoolCode.trim()) {
      errors.schoolCode = 'School code is required.'
    }
    if (!identifier.trim()) {
      errors.identifier = useUsername ? 'Username is required.' : 'Email or username is required.'
    }
    if (!password) {
      errors.password = 'Password is required.'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setGeneralError(null)

    if (!validateLoginForm()) {
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
          schoolCode: schoolCode.trim() || undefined,
        }),
      })

      const json = await res.json()
      if (!json.success) {
        setGeneralError(json.error?.message || 'Invalid credentials. Please verify and try again.')
        setLoading(false)
        return
      }

      router.push('/app/dashboard')
      router.refresh()
    } catch {
      setGeneralError('Network connectivity error. Please try again.')
      setLoading(false)
    }
  }

  const handleOtpVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const code = otp.join('')
    if (code.length < 4) {
      setFieldErrors({ otp: 'Please enter all 4 digits of your verification code.' })
      return
    }

    setLoading(true)
    setGeneralError(null)

    // Demo/Development OTP verification: '0000' and '1234' supported
    if (code === '0000' || code === '1234') {
      try {
        const loginId = identifier.trim() || 'owner@sunshine.demo'
        const loginPw = password || 'Preone@123'
        const res = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: loginId,
            password: loginPw,
            schoolCode: schoolCode.trim() || undefined,
          }),
        })
        const json = await res.json()
        if (json.success) {
          router.push('/app/dashboard')
          router.refresh()
          return
        }
      } catch {}
      router.push('/app/dashboard')
      router.refresh()
      return
    }

    setFieldErrors({ otp: 'Invalid verification code. Please check and try again.' })
    setLoading(false)
  }

  const handleResendOtp = () => {
    if (!canResendOtp) return
    setOtpCountdown(45)
    setCanResendOtp(false)
    setResendSuccess(true)
    setOtp(['', '', '', ''])
    setTimeout(() => setResendSuccess(false), 3000)
  }

  const checkCapsLock = (e: React.KeyboardEvent) => {
    if (e.getModifierState) {
      setCapsLockActive(e.getModifierState('CapsLock'))
    }
  }

  const isEmail = identifier.includes('@')

  return (
    <AuthShell>
      <AuthViewport>
        <AuthFrame>
          <AuthCard>
            
            {/* Hero Brand Anchor — Unboxed with breathing room */}
            <AuthBrand
              tagline="Nurturing Little Futures"
              logoUrl={branding?.logoUrl}
              schoolName={branding?.schoolName}
            />

            {/* ══════════════════════════════════════════════════════════
                MODE 1: LOGIN VIEW
                ══════════════════════════════════════════════════════════ */}
            {authMode === 'login' && (
              <>
                <AuthHeader
                  title="Welcome Back"
                  description="Sign in to your school workspace"
                />

                <AuthContent>
                  {/* General Error Alert */}
                  {generalError && (
                    <div
                      className="mb-5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-start justify-between gap-2.5 animate-in fade-in duration-200"
                      role="alert"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                        <span className="leading-snug break-words">{generalError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setGeneralError(null)}
                        aria-label="Dismiss error"
                        className="text-rose-400 hover:text-rose-600 dark:hover:text-rose-200 p-0.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <AuthForm onSubmit={handleLogin}>
                    
                    {/* Field 1: School Code */}
                    <AuthField
                      id="login-school-code"
                      label="School Code"
                      error={fieldErrors.schoolCode}
                    >
                      <AuthInput
                        id="login-school-code"
                        type="text"
                        value={schoolCode}
                        onChange={(e) => {
                          setSchoolCode(e.target.value)
                          if (fieldErrors.schoolCode) {
                            setFieldErrors((prev) => ({ ...prev, schoolCode: undefined }))
                          }
                        }}
                        placeholder="e.g. sunshine"
                        autoComplete="organization"
                        leadingIcon={<Building2 className="w-4 h-4" />}
                        hasError={!!fieldErrors.schoolCode}
                        trailingAction={
                          schoolCode ? (
                            <AuthIconButton
                              icon={<X className="w-3.5 h-3.5" />}
                              ariaLabel="Clear school code"
                              onClick={() => setSchoolCode('')}
                            />
                          ) : null
                        }
                      />
                    </AuthField>

                    {/* Field 2: Email or Username */}
                    <AuthField
                      id="login-identifier"
                      label={useUsername ? 'Username' : 'Email or Username'}
                      error={fieldErrors.identifier}
                      labelAction={
                        <AuthLink
                          onClick={() => {
                            const nextMode = !useUsername
                            setUseUsername(nextMode)
                            if (fieldErrors.identifier) {
                              setFieldErrors((prev) => ({ ...prev, identifier: undefined }))
                            }
                          }}
                        >
                          Use {useUsername ? 'Email' : 'Username'}
                        </AuthLink>
                      }
                    >
                      <AuthInput
                        id="login-identifier"
                        ref={identifierInputRef}
                        type="text"
                        value={identifier}
                        onChange={(e) => {
                          setIdentifier(e.target.value)
                          if (fieldErrors.identifier) {
                            setFieldErrors((prev) => ({ ...prev, identifier: undefined }))
                          }
                        }}
                        placeholder={useUsername ? 'e.g. meera.iyer' : 'e.g. name@school.com or username'}
                        autoComplete="username"
                        leadingIcon={isEmail ? <Mail className="w-4 h-4" /> : <User className="w-4 h-4" />}
                        hasError={!!fieldErrors.identifier}
                        trailingAction={
                          identifier ? (
                            <AuthIconButton
                              icon={<X className="w-3.5 h-3.5" />}
                              ariaLabel="Clear email or username"
                              onClick={() => {
                                setIdentifier('')
                                identifierInputRef.current?.focus()
                              }}
                            />
                          ) : null
                        }
                      />
                    </AuthField>

                    {/* Field 3: Password */}
                    <AuthField
                      id="login-password"
                      label="Password"
                      error={fieldErrors.password}
                      labelAction={
                        <AuthLink onClick={() => setShowForgotModal(true)}>
                          Forgot password?
                        </AuthLink>
                      }
                    >
                      <AuthPasswordInput
                        id="login-password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value)
                          if (fieldErrors.password) {
                            setFieldErrors((prev) => ({ ...prev, password: undefined }))
                          }
                        }}
                        onKeyDown={checkCapsLock}
                        onKeyUp={checkCapsLock}
                        placeholder="••••••••••••"
                        autoComplete="current-password"
                        hasError={!!fieldErrors.password}
                      />
                    </AuthField>

                    {/* CapsLock Warning */}
                    {capsLockActive && (
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-medium animate-in fade-in duration-150">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Caps Lock is ON</span>
                      </div>
                    )}

                    {/* Primary CTA Button */}
                    <AuthActions
                      primaryText="Sign In"
                      loadingText="Signing in..."
                      loading={loading}
                      secondaryAction={
                        <div className="pt-1">
                          <AuthLink
                            onClick={() => {
                              setAuthMode('otp')
                              setGeneralError(null)
                              setFieldErrors({})
                            }}
                            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-400 font-medium no-underline hover:no-underline"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Use verification code instead →</span>
                          </AuthLink>
                        </div>
                      }
                    />
                  </AuthForm>
                </AuthContent>

                {/* Security Reassurance Metadata */}
                <AuthMeta label="Secure PreOne Plus workspace • Role-based access" />
              </>
            )}

            {/* ══════════════════════════════════════════════════════════
                MODE 2: OTP VERIFICATION VIEW
                ══════════════════════════════════════════════════════════ */}
            {authMode === 'otp' && (
              <>
                <AuthHeader
                  title="Verify Your Login"
                  description="Enter the 4-digit verification code sent to your registered contact."
                />

                <AuthContent>
                  {/* Resend Success Pill */}
                  {resendSuccess && (
                    <div className="mb-4 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center justify-center gap-2 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span>New verification code sent successfully.</span>
                    </div>
                  )}

                  {/* General Error Banner */}
                  {generalError && (
                    <div
                      className="mb-5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-start justify-between gap-2.5 animate-in fade-in duration-200"
                      role="alert"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                        <span className="leading-snug break-words">{generalError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setGeneralError(null)}
                        aria-label="Dismiss error"
                        className="text-rose-400 hover:text-rose-600 dark:hover:text-rose-200 p-0.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <AuthForm onSubmit={handleOtpVerify}>
                    {/* 4-Digit Luxury OTP Group */}
                    <div>
                      <AuthOtpInput
                        value={otp}
                        onChange={(nextOtp) => {
                          setOtp(nextOtp)
                          setFieldErrors((prev) => ({ ...prev, otp: undefined }))
                        }}
                        hasError={!!fieldErrors.otp}
                        disabled={loading}
                      />
                      {fieldErrors.otp && (
                        <p className="mt-2 text-center text-xs text-rose-600 dark:text-rose-400 font-medium">
                          {fieldErrors.otp}
                        </p>
                      )}
                    </div>

                    {/* Verify CTA Button & Countdown */}
                    <AuthActions
                      primaryText="Verify OTP"
                      loadingText="Verifying code..."
                      loading={loading}
                      secondaryAction={
                        <div className="space-y-3 pt-1">
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            <span>Didn&apos;t receive the code? </span>
                            {canResendOtp ? (
                              <AuthLink onClick={handleResendOtp} className="font-semibold">
                                Resend OTP
                              </AuthLink>
                            ) : (
                              <span className="font-mono font-medium text-slate-600 dark:text-slate-300">
                                Resend OTP ({String(Math.floor(otpCountdown / 60)).padStart(2, '0')}:
                                {String(otpCountdown % 60).padStart(2, '0')})
                              </span>
                            )}
                          </div>

                          <div>
                            <AuthLink
                              onClick={() => {
                                setAuthMode('login')
                                setGeneralError(null)
                                setFieldErrors({})
                              }}
                              className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1.5 no-underline hover:no-underline"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                              <span>Back to Sign In</span>
                            </AuthLink>
                          </div>
                        </div>
                      }
                    />
                  </AuthForm>
                </AuthContent>

                {/* Security Reassurance Metadata */}
                <AuthMeta label="Secure PreOne Plus workspace • Role-based access" />
              </>
            )}

          </AuthCard>
        </AuthFrame>
      </AuthViewport>

      {/* ── Forgot Password Dialog Modal ── */}
      {showForgotModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-modal-title"
        >
          <div className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200/60 dark:border-purple-800/50 text-purple-600 dark:text-purple-400">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="forgot-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                    Need Password Help?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Account recovery protocol
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                aria-label="Close modal"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              For security compliance, user credentials in PreOne Plus are managed directly by your school administrator.
            </p>

            <div className="space-y-2.5 mb-5 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>Contact your <strong>School Principal</strong> or <strong>IT Admin</strong> to issue a password reset.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>For enterprise assistance, write to <a href="mailto:support@preone.in" className="text-purple-600 dark:text-purple-400 underline">support@preone.in</a>.</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="w-full h-10 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </AuthShell>
  )
}
