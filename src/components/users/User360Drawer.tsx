'use client'

import React, { useState, useCallback, useEffect } from 'react'
import {
  User, Mail, Phone, Building, Briefcase, Baby, Shield, KeyRound,
  Lock, CheckCircle2, XCircle, Clock, Calendar, Edit3, ShieldAlert,
  History, LogOut, Activity, AlertTriangle, Info, AlertCircle
} from 'lucide-react'
import { Modal, ConfirmModal } from '@/components/preone/Modal'
import { Avatar, StatusBadge } from '@/components/preone/ui'
import { UserRecord, ROLE_BADGE } from './types'
import { normalizeRole } from '@/lib/roles'
import { fmtDateTime, timeAgo } from '@/lib/format'

interface SecurityEvent {
  id: string
  action: string
  module: string | null
  summary: string | null
  severity: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  actor: { id: string | null; name: string | null; role: string | null }
}

function deviceLabel(ua: string | null): string {
  if (!ua) return 'Unknown device'
  const s = ua.toLowerCase()
  if (s.includes('headless')) return 'Headless browser / automation'
  if (s.includes('android')) return 'Android device'
  if (s.includes('iphone') || s.includes('ipad')) return 'iOS device'
  if (s.includes('edg/')) return 'Edge — Desktop'
  if (s.includes('chrome')) return 'Chrome — Desktop'
  if (s.includes('firefox')) return 'Firefox — Desktop'
  if (s.includes('safari')) return 'Safari — Desktop'
  return ua.slice(0, 40)
}

function severityBadge(sev: string | null): { cls: string; icon: React.ReactNode } {
  switch ((sev || 'INFO').toUpperCase()) {
    case 'CRITICAL':
    case 'ERROR':
      return { cls: 'b-danger', icon: <AlertCircle className="w-3 h-3" /> }
    case 'WARNING':
      return { cls: 'b-warning', icon: <AlertTriangle className="w-3 h-3" /> }
    case 'SUCCESS':
      return { cls: 'b-success', icon: <CheckCircle2 className="w-3 h-3" /> }
    default:
      return { cls: 'b-info', icon: <Info className="w-3 h-3" /> }
  }
}

interface User360DrawerProps {
  open: boolean
  onClose: () => void
  user: UserRecord | null
  onEdit?: (user: UserRecord) => void
  onStatusChange?: (user: UserRecord) => void
  onPasswordReset?: (user: UserRecord) => void
}

export function User360Drawer({ open, onClose, user, onEdit, onStatusChange, onPasswordReset }: User360DrawerProps) {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'RELATIONSHIPS' | 'SECURITY' | 'ACTIVITY'>('OVERVIEW')
  const [timeline, setTimeline] = useState<SecurityEvent[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineError, setTimelineError] = useState<string | null>(null)
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [revokeResult, setRevokeResult] = useState<string | null>(null)

  const fetchTimeline = useCallback(async () => {
    if (!user) return
    setTimelineLoading(true)
    setTimelineError(null)
    try {
      const res = await fetch(`/api/v1/users/${user.userId}/security-timeline`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || json.message || 'Failed to load security activity')
      setTimeline(json.data?.timeline || [])
    } catch (err: any) {
      setTimelineError(err.message || 'Failed to load security activity')
    } finally {
      setTimelineLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (open && activeTab === 'ACTIVITY' && user) {
      fetchTimeline()
    }
  }, [open, activeTab, user, fetchTimeline])

  useEffect(() => {
    if (open) setActiveTab('OVERVIEW')
  }, [open, user?.userId])

  const handleRevokeSessions = async () => {
    if (!user) return
    setRevoking(true)
    try {
      const res = await fetch(`/api/v1/users/${user.userId}/revoke-sessions`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || json.message || 'Failed to revoke sessions')
      const count = json.data?.revokedCount ?? 0
      setRevokeResult(`Signed out of ${count} device session(s) successfully`)
      fetchTimeline()
      return count
    } finally {
      setRevoking(false)
    }
  }

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
          <button
            type="button"
            onClick={() => setActiveTab('ACTIVITY')}
            className={`pb-2 transition-colors flex items-center gap-1 ${
              activeTab === 'ACTIVITY'
                ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Security Activity
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
                    {ROLE_BADGE[normalizeRole(r)]?.label || r}
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

        {/* TAB 4: SECURITY ACTIVITY TIMELINE */}
        {activeTab === 'ACTIVITY' && (
          <div className="space-y-3">
            {/* Session control bar */}
            <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-50/40 dark:from-gray-900 dark:to-gray-900/60 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <LogOut className="w-3.5 h-3.5 text-gray-500" />
                  Device Sessions
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Last login: {user.lastLoginAt ? `${fmtDateTime(user.lastLoginAt)} (${timeAgo(user.lastLoginAt)})` : 'Never logged in'}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-danger text-[11px] shrink-0 flex items-center gap-1.5"
                onClick={() => setRevokeConfirmOpen(true)}
                disabled={revoking}
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out All Devices
              </button>
            </div>

            {revokeResult && (
              <div className="p-2.5 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 text-xs text-green-700 dark:text-green-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                {revokeResult}
              </div>
            )}

            {/* Timeline */}
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              Security & Audit Events
              {timeline.length > 0 && <span className="badge b-neutral text-[10px]">{timeline.length}</span>}
            </div>

            {timelineLoading && (
              <div className="py-8 text-center text-xs text-gray-400">Loading security activity…</div>
            )}

            {timelineError && (
              <div className="p-2.5 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-xs text-red-600 dark:text-red-300">
                {timelineError}
              </div>
            )}

            {!timelineLoading && !timelineError && timeline.length === 0 && (
              <div className="py-8 text-center">
                <History className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No security events recorded for this user yet.</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Logins, profile changes, and admin actions will appear here.</p>
              </div>
            )}

            {!timelineLoading && timeline.length > 0 && (
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {timeline.map((ev) => {
                  const sev = severityBadge(ev.severity)
                  return (
                    <div key={ev.id} className="p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/60">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`badge ${sev.cls} text-[10px] shrink-0`}>
                            {sev.icon}
                            {ev.action}
                          </span>
                          {ev.module && <span className="text-[10px] text-gray-400 uppercase tracking-wide">{ev.module}</span>}
                        </div>
                        <span className="text-[10px] text-gray-400 shrink-0" title={fmtDateTime(ev.createdAt)}>
                          {timeAgo(ev.createdAt)}
                        </span>
                      </div>
                      {ev.summary && (
                        <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-1 leading-snug">{ev.summary}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400 font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(ev.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span>IP: {ev.ipAddress || '—'}</span>
                        <span className="truncate">{deviceLabel(ev.userAgent)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Actions Bar */}
        <div className="pt-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between flex-wrap gap-2">
          <button type="button" className="btn btn-secondary text-xs" onClick={onClose}>
            Close
          </button>
          <div className="flex items-center gap-2">
            {onPasswordReset && isStaff && (
              <button
                type="button"
                className="btn btn-secondary text-xs flex items-center gap-1.5"
                onClick={() => {
                  onClose()
                  onPasswordReset(user)
                }}
              >
                <KeyRound className="w-3.5 h-3.5" />
                {user.status === 'PENDING' ? 'Resend Invite' : 'Reset Password'}
              </button>
            )}
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

      {/* Revoke sessions confirmation */}
      <ConfirmModal
        open={revokeConfirmOpen}
        onClose={() => setRevokeConfirmOpen(false)}
        title="Sign Out All Devices?"
        message={`This will instantly invalidate every active browser session and authentication token for ${user.name}. They will need to sign in again on all devices.`}
        confirmLabel="Sign Out All Devices"
        danger
        onConfirm={async () => {
          try {
            await handleRevokeSessions()
          } catch {
            // toast handled by caller; keep drawer state consistent
          }
        }}
      />
    </Modal>
  )
}
