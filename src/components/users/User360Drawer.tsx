'use client'

import React, { useState } from 'react'
import {
  User, Mail, Phone, Building, Briefcase, Baby, Shield, KeyRound,
  Lock, CheckCircle2, XCircle, Clock, Calendar, Edit3, ShieldAlert
} from 'lucide-react'
import { Modal } from '@/components/preone/Modal'
import { Avatar, StatusBadge } from '@/components/preone/ui'
import { UserRecord, ROLE_BADGE } from './types'
import { normalizeRole } from '@/lib/roles'
import { fmtDateTime, timeAgo } from '@/lib/format'

interface User360DrawerProps {
  open: boolean
  onClose: () => void
  user: UserRecord | null
  onEdit?: (user: UserRecord) => void
  onStatusChange?: (user: UserRecord) => void
}

export function User360Drawer({ open, onClose, user, onEdit, onStatusChange }: User360DrawerProps) {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'RELATIONSHIPS' | 'SECURITY'>('OVERVIEW')

  if (!user) return null

  const isStaff = !['PARENT', 'GUARDIAN'].includes(normalizeRole(user.role))
  const isFamily = ['PARENT', 'GUARDIAN'].includes(normalizeRole(user.role))
  const badge = ROLE_BADGE[normalizeRole(user.role)] || { cls: 'b-neutral', label: user.role }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="User 360 Profile"
      subtitle={`Unified identity & access overview for ${user.name}`}
      wide
    >
      <div className="space-y-5">
        {/* Header Profile Card */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-gray-50 to-indigo-50/30 dark:from-gray-900 dark:to-indigo-950/20 border border-gray-200 dark:border-gray-800 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <Avatar name={user.name} src={user.avatarUrl} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">{user.name}</h3>
                <span className={`badge ${badge.cls} text-xs font-semibold`}>
                  {badge.label}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 font-mono">
                <span>@{user.username || user.email?.split('@')[0] || 'user'}</span>
                <span>•</span>
                <span>ID: {user.userId.slice(-6)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <StatusBadge status={user.status} />
            <span className="text-[11px] text-gray-400">
              Active: {user.lastLoginAt ? timeAgo(user.lastLoginAt) : 'Never'}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 text-xs font-semibold gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('OVERVIEW')}
            className={`pb-2 transition-colors ${
              activeTab === 'OVERVIEW'
                ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Identity & Contact
          </button>
          {isStaff && (
            <button
              type="button"
              onClick={() => setActiveTab('RELATIONSHIPS')}
              className={`pb-2 transition-colors ${
                activeTab === 'RELATIONSHIPS'
                  ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Employment & Classes
            </button>
          )}
          {isFamily && (
            <button
              type="button"
              onClick={() => setActiveTab('RELATIONSHIPS')}
              className={`pb-2 transition-colors ${
                activeTab === 'RELATIONSHIPS'
                  ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Linked Children & Pickup
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('SECURITY')}
            className={`pb-2 transition-colors ${
              activeTab === 'SECURITY'
                ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            RBAC & Roles
          </button>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'OVERVIEW' && (
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
              <span className="text-gray-400 block text-[11px] mb-1 flex items-center gap-1">
                <Mail className="w-3 h-3" /> Email Address
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-100 font-mono select-all">
                {user.email}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
              <span className="text-gray-400 block text-[11px] mb-1 flex items-center gap-1">
                <Phone className="w-3 h-3" /> Mobile Phone
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-100 font-mono">
                {user.phone || 'Not recorded'}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
              <span className="text-gray-400 block text-[11px] mb-1 flex items-center gap-1">
                <Building className="w-3 h-3" /> Campus Branch
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {user.branchId ? `Branch ID: ${user.branchId.slice(-6)}` : 'All Branches / Central'}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
              <span className="text-gray-400 block text-[11px] mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Registered On
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {fmtDateTime(user.createdAt)}
              </span>
            </div>
          </div>
        )}

        {/* TAB 2: RELATIONSHIPS (Staff or Family) */}
        {activeTab === 'RELATIONSHIPS' && (
          <div className="space-y-3">
            {isStaff && user.staffProfile && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                  <span className="text-gray-400 block text-[11px] mb-0.5">Employee Code</span>
                  <span className="font-bold font-mono text-gray-900 dark:text-white">
                    {user.staffProfile.employeeCode}
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                  <span className="text-gray-400 block text-[11px] mb-0.5">Designation</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {user.staffProfile.designation || 'Staff Member'}
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                  <span className="text-gray-400 block text-[11px] mb-0.5">Department</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {user.staffProfile.department || 'Academics'}
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                  <span className="text-gray-400 block text-[11px] mb-0.5">Employment Type</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {user.staffProfile.employmentType}
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                  <span className="text-gray-400 block text-[11px] mb-0.5">Qualifications</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {user.staffProfile.qualification || 'Not recorded'}
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                  <span className="text-gray-400 block text-[11px] mb-0.5">Joining Date</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {user.staffProfile.joiningDate ? new Date(user.staffProfile.joiningDate).toLocaleDateString() : 'Not recorded'}
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                  <span className="text-gray-400 block text-[11px] mb-0.5">Date of Birth / Gender</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {user.staffProfile.dateOfBirth ? new Date(user.staffProfile.dateOfBirth).toLocaleDateString() : 'DOB unset'} • {user.staffProfile.gender || 'Gender unset'}
                  </span>
                </div>
              </div>
            )}

            {isFamily && user.guardianProfile && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Enrolled Children ({user.guardianProfile.students.length})
                </div>
                {user.guardianProfile.students.map((child) => (
                  <div
                    key={child.id}
                    className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Baby className="w-3.5 h-3.5 text-indigo-600" />
                        {child.name}
                        <span className="badge b-primary font-mono text-[10px]">{child.admissionNo}</span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        Relationship: <span className="font-medium capitalize">{child.relationship?.toLowerCase() || 'Caregiver'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`badge text-[10px] ${
                          child.canPickup ? 'b-success' : 'b-neutral'
                        }`}
                      >
                        {child.canPickup ? 'Pickup Authorized' : 'No Pickup'}
                      </span>
                      {child.pickupPin && (
                        <span className="badge b-purple font-mono text-[10px]" title="Pickup PIN is set and secured">
                          PIN: ••••
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SECURITY & RBAC */}
        {activeTab === 'SECURITY' && (
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700">
              <span className="text-gray-400 block text-[11px] mb-1">Assigned RBAC Roles</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {(user.roles && user.roles.length > 0 ? user.roles : [user.role]).map((r) => (
                  <span key={r} className={`badge ${ROLE_BADGE[normalizeRole(r)]?.cls || 'b-neutral'} text-xs font-semibold`}>
                    {r}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg space-y-1">
              <span className="font-semibold text-gray-800 dark:text-gray-200 block">Security Scoping</span>
              <p className="text-gray-500 text-[11px]">
                {isFamily
                  ? 'Relationship-scoped: Access strictly bounded to linked enrolled children only.'
                  : 'Role-based workforce scoping: Enforces branch isolation and module authorization.'}
              </p>
            </div>
          </div>
        )}

        {/* Actions Bar */}
        <div className="pt-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <button type="button" className="btn btn-secondary text-xs" onClick={onClose}>
            Close
          </button>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                type="button"
                className="btn btn-secondary text-xs flex items-center gap-1.5"
                onClick={() => {
                  onClose()
                  onEdit(user)
                }}
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit Profile
              </button>
            )}
            {onStatusChange && (
              <button
                type="button"
                className={`btn text-xs ${user.status === 'ACTIVE' ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => {
                  onClose()
                  onStatusChange(user)
                }}
              >
                {user.status === 'ACTIVE' ? 'Suspend Account' : 'Activate Account'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
