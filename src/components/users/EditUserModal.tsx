'use client'

import React, { useState, useEffect } from 'react'
import { User, Phone, Building, Briefcase, Shield, Key } from 'lucide-react'
import { Modal } from '@/components/preone/Modal'
import { useToast } from '@/components/preone/Toast'
import { Role, UserLifecycleStatus, BranchOption, UserRecord, CANONICAL_STAFF_ROLES, CANONICAL_FAMILY_ROLES, ROLE_BADGE } from './types'

interface EditUserModalProps {
  open: boolean
  onClose: () => void
  user: UserRecord | null
  branches: BranchOption[]
  onSuccess: () => void
}

export function EditUserModal({ open, onClose, user, branches, onSuccess }: EditUserModalProps) {
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<Role>('TEACHER')
  const [status, setStatus] = useState<UserLifecycleStatus>('ACTIVE')
  const [branchId, setBranchId] = useState('')
  const [designation, setDesignation] = useState('')
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    if (user) {
      setFullName(user.name)
      setPhone(user.phone || '')
      setRole(user.role)
      setStatus(user.status)
      setBranchId(user.branchId || '')
      setDesignation(user.staffProfile?.designation || '')
      setNewPassword('')
    }
  }, [user, open])

  if (!user) return null

  const isStaff = !['PARENT', 'GUARDIAN'].includes(user.role)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!fullName.trim()) {
      toast.error('Name Required', 'User name cannot be blank')
      return
    }

    setSubmitting(true)
    try {
      const payload: any = {
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        role,
        primaryRole: role,
        roles: [role],
        status,
        branchId: branchId || null,
      }

      if (isStaff) {
        payload.designation = designation.trim() || undefined
      }

      if (newPassword && newPassword.length >= 6) {
        payload.password = newPassword
      }

      const res = await fetch(`/api/v1/users/${user.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || json.message || 'Failed to update user profile')
      }

      toast.success(
        'User Profile Updated',
        `Successfully saved changes for ${fullName}.`
      )
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error('Update Failed', err.message || 'Error occurred while saving profile changes')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit User Profile"
      subtitle={`Modify account details and role permissions for ${user.name}`}
      icon={<User className="w-5 h-5 text-indigo-600" />}
      iconClass="ic-purple"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <button type="button" className="btn btn-secondary text-xs" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" form="edit-user-form" className="btn btn-primary text-xs" disabled={submitting}>
            {submitting ? 'Saving Changes...' : 'Save Profile Changes'}
          </button>
        </div>
      }
    >
      <form id="edit-user-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Full Name <span className="text-red-500">*</span>
          </label>
          <div className="relative input-icon-wrap">
            <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={{ paddingLeft: 38 }}
              className="input w-full text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Mobile Phone
            </label>
            <div className="relative input-icon-wrap">
              <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ paddingLeft: 38 }}
                className="input w-full text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Account Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="select w-full text-sm"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="LOCKED">LOCKED</option>
              <option value="DEACTIVATED">DEACTIVATED</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="select w-full text-sm"
            >
              {(isStaff ? CANONICAL_STAFF_ROLES : CANONICAL_FAMILY_ROLES).map((r) => (
                <option key={r} value={r}>
                  {ROLE_BADGE[r]?.label || r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Campus Branch
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="select w-full text-sm"
            >
              <option value="">Central / All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {isStaff && (
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Job Designation / Title
            </label>
            <div className="relative input-icon-wrap">
              <Briefcase className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="e.g. Lead Teacher"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                style={{ paddingLeft: 38 }}
                className="input w-full text-sm"
              />
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Reset Password <span className="text-gray-400 font-normal">(Leave blank to keep existing password)</span>
          </label>
          <div className="relative input-icon-wrap">
            <Key className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="password"
              placeholder="Minimum 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ paddingLeft: 38 }}
              className="input w-full text-sm font-mono"
              autoComplete="new-password"
            />
          </div>
        </div>
      </form>
    </Modal>
  )
}
