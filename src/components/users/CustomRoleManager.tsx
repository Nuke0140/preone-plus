'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Sparkles, Plus, Pencil, Trash2, Check, ShieldCheck, Search
} from 'lucide-react'
import { ConfirmModal } from '@/components/preone/Modal'
import { useToast } from '@/components/preone/Toast'

interface CustomRole {
  id: string
  name: string
  description: string | null
  permissions: string[]
  baseRole?: string | null
  createdAt: string
}

const PERMISSION_CATALOG: Array<{ group: string; perms: Array<{ code: string; label: string }> }> = [
  {
    group: 'Students & Attendance',
    perms: [
      { code: 'students:read', label: 'View students' },
      { code: 'students:write', label: 'Edit students' },
      { code: 'attendance:read', label: 'View attendance' },
      { code: 'attendance:mark', label: 'Mark attendance' },
      { code: 'attendance:approve', label: 'Approve attendance' },
      { code: 'timeline:read', label: 'View daily timeline' },
    ],
  },
  {
    group: 'Academics & Exams',
    perms: [
      { code: 'academics:read', label: 'View academics' },
      { code: 'academics:write', label: 'Edit academics' },
      { code: 'academics:approve', label: 'Approve academics' },
      { code: 'exams:read', label: 'View exams' },
      { code: 'exams:write', label: 'Manage exams & marks' },
      { code: 'results:publish', label: 'Publish results' },
      { code: 'timetable:read', label: 'View timetable' },
      { code: 'timetable:write', label: 'Edit timetable' },
    ],
  },
  {
    group: 'Finance',
    perms: [
      { code: 'finance:read', label: 'View fees & ledgers' },
      { code: 'finance:write', label: 'Create invoices & receipts' },
    ],
  },
  {
    group: 'Operations',
    perms: [
      { code: 'operations:read', label: 'View operations' },
      { code: 'operations:write', label: 'Manage operations' },
      { code: 'inventory:read', label: 'View inventory' },
      { code: 'inventory:request', label: 'Request materials' },
      { code: 'inventory:receive', label: 'Receive stock' },
      { code: 'library:read', label: 'View library' },
      { code: 'library:write', label: 'Manage library' },
      { code: 'hostel:read', label: 'View hostel' },
      { code: 'hostel:write', label: 'Manage hostel' },
      { code: 'transport:read', label: 'View transport' },
      { code: 'transport:write', label: 'Manage transport' },
      { code: 'transport:assign', label: 'Assign transport' },
    ],
  },
  {
    group: 'Communication & People',
    perms: [
      { code: 'communication:read', label: 'Receive announcements' },
      { code: 'communication:broadcast', label: 'Send announcements' },
      { code: 'users:read', label: 'View staff directory' },
      { code: 'users:write', label: 'Manage users' },
      { code: 'hr:read', label: 'View HR' },
      { code: 'hr:self', label: 'Own HR self-service' },
      { code: 'reports:read', label: 'View reports' },
      { code: 'reports:export', label: 'Export reports' },
    ],
  },
]

const ALL_PERMS = PERMISSION_CATALOG.flatMap((g) => g.perms.map((p) => p.code))

export function CustomRoleManager() {
  const toast = useToast()
  const [roles, setRoles] = useState<CustomRole[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<CustomRole | null>(null)
  const [deleting, setDeleting] = useState<CustomRole | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)

  // Builder form
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const fetchRoles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/users/custom-roles')
      const json = await res.json()
      if (res.ok) setRoles(json.data?.customRoles || [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  const openCreate = () => {
    setName('')
    setDescription('')
    setSelected(new Set())
    setCreating(true)
    setEditing(null)
  }

  const openEdit = (role: CustomRole) => {
    setName(role.name)
    setDescription(role.description || '')
    setSelected(new Set(role.permissions))
    setEditing(role)
    setCreating(true)
  }

  const togglePerm = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const handleSave = async () => {
    if (!name.trim() || selected.size === 0) {
      toast.error('Validation Error', 'Role name and at least one permission are required')
      return
    }
    setSaving(true)
    try {
      const isEdit = Boolean(editing)
      const res = await fetch(isEdit ? `/api/v1/users/custom-roles/${editing!.id}` : '/api/v1/users/custom-roles', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), permissions: Array.from(selected) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || json.message || 'Failed to save custom role')
      toast.success(isEdit ? 'Custom Role Updated' : 'Custom Role Created', `"${name.trim()}" saved with ${selected.size} permission(s)`)
      setCreating(false)
      setEditing(null)
      fetchRoles()
    } catch (err: any) {
      toast.error('Save Failed', err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeletingBusy(true)
    try {
      const res = await fetch(`/api/v1/users/custom-roles/${deleting.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || json.message || 'Failed to delete role')
      toast.success('Custom Role Deleted', `"${deleting.name}" was removed`)
      setDeleting(null)
      fetchRoles()
    } catch (err: any) {
      toast.error('Delete Failed', err.message)
    } finally {
      setDeletingBusy(false)
    }
  }

  const selectedCount = selected.size

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span>
            School-defined permission sets. Build a role (e.g. &quot;Accounts + Library&quot;), then share it with the Roles
            Directory as your school&apos;s reference — enforcement stays with canonical RBAC roles.
          </span>
        </div>
        <button type="button" className="btn btn-primary text-xs flex items-center gap-1.5 shrink-0" onClick={openCreate}>
          <Plus className="w-3.5 h-3.5" />
          New Custom Role
        </button>
      </div>

      {/* Builder (create/edit) */}
      {creating && (
        <div className="p-4 rounded-xl border-2 border-purple-200 dark:border-purple-800 bg-purple-50/40 dark:bg-purple-950/20 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white">
              {editing ? `Edit "${editing.name}"` : 'Create Custom Role'}
            </h4>
            <button type="button" className="btn btn-ghost text-xs" onClick={() => { setCreating(false); setEditing(null) }}>
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Role Name *</label>
              <input
                type="text"
                className="input w-full text-xs"
                placeholder="e.g. Accounts + Library Hybrid"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <input
                type="text"
                className="input w-full text-xs"
                placeholder="What is this role for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={140}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Permissions ({selectedCount} selected)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1">
              {PERMISSION_CATALOG.map((group) => (
                <div key={group.group} className="p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">{group.group}</div>
                  <div className="space-y-1">
                    {group.perms.map((p) => (
                      <label key={p.code} className="flex items-center gap-1.5 text-[11px] text-gray-700 dark:text-gray-300 cursor-pointer hover:text-gray-900 dark:hover:text-white">
                        <input
                          type="checkbox"
                          className="accent-purple-600 w-3 h-3"
                          checked={selected.has(p.code)}
                          onChange={() => togglePerm(p.code)}
                        />
                        <span className="truncate" title={p.code}>{p.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="btn btn-primary text-xs flex items-center gap-1.5"
              onClick={handleSave}
              disabled={saving || !name.trim() || selectedCount === 0}
            >
              <Check className="w-3.5 h-3.5" />
              {saving ? 'Saving…' : editing ? 'Update Role' : 'Create Role'}
            </button>
          </div>
        </div>
      )}

      {/* Roles list */}
      {loading ? (
        <div className="py-8 text-center text-xs text-gray-400">Loading custom roles…</div>
      ) : roles.length === 0 ? (
        <div className="py-10 text-center">
          <ShieldCheck className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">No custom roles yet</p>
          <p className="text-[11px] text-gray-400 mt-0.5 max-w-sm mx-auto">
            Combine permissions from different modules into one reusable role for hybrid positions like
            &quot;Librarian + Exam Cell&quot;.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {roles.map((role) => (
            <div
              key={role.id}
              className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60 flex items-start justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-sm font-bold text-gray-900 dark:text-white truncate">{role.name}</div>
                {role.description && (
                  <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{role.description}</p>
                )}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <span className="badge b-purple text-[10px]">{role.permissions.length} permissions</span>
                  {role.permissions.slice(0, 3).map((p) => (
                    <span key={p} className="badge b-neutral text-[10px] font-mono">{p}</span>
                  ))}
                  {role.permissions.length > 3 && (
                    <span className="badge b-neutral text-[10px]">+{role.permissions.length - 3} more</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" className="btn btn-ghost text-xs p-1.5" title="Edit role" onClick={() => openEdit(role)}>
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button type="button" className="btn btn-ghost text-xs p-1.5 text-red-500" title="Delete role" onClick={() => setDeleting(role)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete Custom Role?"
        message={`"${deleting?.name}" will be removed from the roles directory. This cannot be undone.`}
        confirmLabel="Delete Role"
        danger
        onConfirm={handleDelete}
      />
    </div>
  )
}
