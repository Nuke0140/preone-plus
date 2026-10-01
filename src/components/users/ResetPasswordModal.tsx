'use client'

import React, { useState } from 'react'
import { KeyRound, Copy, Check, Mail } from 'lucide-react'
import { Modal } from '@/components/preone/Modal'
import { useToast } from '@/components/preone/Toast'
import { UserRecord } from './types'

interface ResetPasswordModalProps {
  open: boolean
  onClose: () => void
  user: UserRecord | null
}

/**
 * Admin password reset flow:
 *  - Step 1 (confirm): explains the impact, triggers POST /users/[id]/reset-password
 *  - Step 2 (result): shows the generated temporary password exactly once
 */
export function ResetPasswordModal({ open, onClose, user }: ResetPasswordModalProps) {
  const toast = useToast()
  const [step, setStep] = useState<'CONFIRM' | 'RESULT'>('CONFIRM')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ tempPassword: string; email: string | null; revokedSessions: number; name: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const isPending = user?.status === 'PENDING'

  const handleResendInvite = async () => {
    if (!user) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/users/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resend', userId: user.userId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || json.message || 'Failed to resend invitation')
      toast.success('Invitation Resent', `A fresh invite was sent to ${user.email || user.name}.`)
      onClose()
    } catch (err: any) {
      toast.error('Resend Failed', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetPassword = async () => {
    if (!user) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/users/${user.userId}/reset-password`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || json.message || 'Failed to reset password')
      setResult({
        tempPassword: json.data.tempPassword,
        email: json.data.email ?? user.email,
        revokedSessions: json.data.revokedSessions ?? 0,
        name: user.name,
      })
      setStep('RESULT')
    } catch (err: any) {
      toast.error('Reset Failed', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopy = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.tempPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Copy Failed', 'Please copy the password manually')
    }
  }

  const handleClose = () => {
    setStep('CONFIRM')
    setResult(null)
    setCopied(false)
    onClose()
  }

  if (!user) return null

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isPending ? 'Resend Invitation' : 'Reset Password'}
      subtitle={isPending ? `Send a fresh invite to ${user.name}` : `Generate a secure temporary password for ${user.name}`}
      icon={<KeyRound className="w-5 h-5 text-indigo-600" />}
      iconClass="ic-purple"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <button type="button" className="btn btn-secondary text-xs" onClick={handleClose} disabled={submitting}>
            {step === 'RESULT' ? 'Done' : 'Cancel'}
          </button>
          {step === 'CONFIRM' && (
            <button
              type="button"
              className="btn btn-primary text-xs"
              onClick={isPending ? handleResendInvite : handleResetPassword}
              disabled={submitting}
            >
              {submitting ? 'Working…' : isPending ? 'Resend Invite' : 'Generate Temp Password'}
            </button>
          )}
        </div>
      }
    >
      {step === 'CONFIRM' && !isPending && (
        <div className="space-y-3 text-sm">
          <p className="t-body">
            A strong temporary password will be generated following your school&apos;s password policy. The password
            will be shown <strong>only once</strong> — share it with the staff member through a secure channel.
          </p>
          <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
            <KeyRound className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong>{user.name}</strong>&apos;s account ({user.email || 'no email'}) will be signed out of all
              active devices immediately, and the new password must be used at next sign-in.
            </div>
          </div>
        </div>
      )}

      {step === 'CONFIRM' && isPending && (
        <div className="space-y-3 text-sm">
          <p className="t-body">
            {user.name}&apos;s account is still <strong>PENDING</strong> activation. Resending the invitation will
            notify them again with their sign-in details.
          </p>
        </div>
      )}

      {step === 'RESULT' && result && (
        <div className="space-y-4">
          <div className="p-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 text-xs text-green-700 dark:text-green-300 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            Password reset successful — {result.revokedSessions} active session(s) revoked.
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Temporary Password for <strong>{result.name}</strong> (shown only once)
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono text-sm font-bold tracking-wider text-gray-900 dark:text-white select-all">
                {result.tempPassword}
              </code>
              <button
                type="button"
                className="btn btn-secondary text-xs shrink-0 flex items-center gap-1.5"
                onClick={handleCopy}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {result.email && (
            <div className="p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-[11px] text-gray-500 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 shrink-0" />
              Share this password privately with {result.email}. Ask them to change it after signing in
              (Profile → Security → Change Password).
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
