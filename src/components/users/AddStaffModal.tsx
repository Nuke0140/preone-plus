'use client'

import React, { useState, useEffect } from 'react'
import {
  Briefcase, Building, Mail, Phone, User, Shield, Check, Key,
  Calendar, GraduationCap, Sparkles, RefreshCw, Layers, Award,
  Clock, DoorOpen, UserCheck, AlertCircle
} from 'lucide-react'
import { Modal } from '@/components/preone/Modal'
import { useToast } from '@/components/preone/Toast'
import { Role, BranchOption, ClassroomOption, CANONICAL_STAFF_ROLES, ROLE_BADGE } from './types'

interface AddStaffModalProps {
  open: boolean
  onClose: () => void
  branches: BranchOption[]
  classrooms: ClassroomOption[]
  onSuccess: () => void
}

export function AddStaffModal({ open, onClose, branches, classrooms, onSuccess }: AddStaffModalProps) {
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)

  // Section 1: Personal Information
  const [avatarUrl, setAvatarUrl] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER' | ''>('')

  // Section 2: Login & Access
  const [username, setUsername] = useState('')
  const [isUsernameCustom, setIsUsernameCustom] = useState(false)
  const [password, setPassword] = useState('')
  const [primaryRole, setPrimaryRole] = useState<Role>('TEACHER')
  const [additionalRoles, setAdditionalRoles] = useState<Role[]>([])
  const [branchId, setBranchId] = useState(branches[0]?.id || '')
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING'>('ACTIVE')

  // Section 3: Staff Information
  const [employeeCode, setEmployeeCode] = useState('')
  const [designation, setDesignation] = useState('')
  const [department, setDepartment] = useState('Academics')
  const [qualification, setQualification] = useState('')
  const [employmentType, setEmploymentType] = useState('FULL_TIME')
  const [joiningDate, setJoiningDate] = useState('')
  const [reportingManagerId, setReportingManagerId] = useState('')

  // Section 4: Teaching Assignment
  const [classroomId, setClassroomId] = useState('')

  // Auto-generate employee code on open if blank
  useEffect(() => {
    if (open && !employeeCode) {
      generateEmployeeCode()
    }
    if (open && !branchId && branches.length > 0) {
      setBranchId(branches[0].id)
    }
  }, [open, branches])

  // Auto-generate username from fullName if not manually customized
  const handleFullNameChange = (val: string) => {
    setFullName(val)
    if (!isUsernameCustom) {
      const slug = val
        .toLowerCase()
        .trim()
        .replace(/^(dr\.|mr\.|mrs\.|ms\.|prof\.)\s+/i, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(Boolean)
      if (slug.length >= 2) {
        setUsername(`${slug[0]}.${slug[slug.length - 1]}`)
      } else if (slug.length === 1) {
        setUsername(slug[0])
      } else {
        setUsername('')
      }
    }
  }

  const generateEmployeeCode = () => {
    const year = new Date().getFullYear()
    const randomSuffix = Math.floor(100 + Math.random() * 900)
    setEmployeeCode(`EMP-${year}-${randomSuffix}`)
  }

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*'
    let pwd = 'PreOne@'
    for (let i = 0; i < 4; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setPassword(pwd)
  }

  const toggleAdditionalRole = (r: Role) => {
    if (r === primaryRole) return
    setAdditionalRoles((prev) =>
      prev.includes(r) ? prev.filter((item) => item !== r) : [...prev, r]
    )
  }

  const isTeacher = primaryRole === 'TEACHER' || additionalRoles.includes('TEACHER')

  // Available classrooms filtered by branch if selected
  const availableClassrooms = classrooms.filter(
    (c) => !branchId || !c.branchId || c.branchId === branchId
  )

  const resetForm = () => {
    setAvatarUrl('')
    setFullName('')
    setEmail('')
    setPhone('')
    setDateOfBirth('')
    setGender('')
    setUsername('')
    setIsUsernameCustom(false)
    setPassword('')
    setPrimaryRole('TEACHER')
    setAdditionalRoles([])
    setBranchId(branches[0]?.id || '')
    setStatus('ACTIVE')
    setEmployeeCode('')
    setDesignation('')
    setDepartment('Academics')
    setEmploymentType('FULL_TIME')
    setQualification('')
    setJoiningDate('')
    setReportingManagerId('')
    setClassroomId('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Client-side validations
    if (!fullName.trim() || !email.trim()) {
      toast.error('Validation Error', 'Full Name and Work Email are required')
      return
    }

    if (!branchId) {
      toast.error('Validation Error', 'Campus Branch is required')
      return
    }

    if (!employeeCode.trim()) {
      toast.error('Validation Error', 'Employee Code is required')
      return
    }

    if (!designation.trim()) {
      toast.error('Validation Error', 'Job Designation is required')
      return
    }

    if (isTeacher && !classroomId && availableClassrooms.length > 0) {
      toast.error('Validation Error', 'Class / Classroom assignment is required for Teachers')
      return
    }

    setSubmitting(true)
    try {
      const allRoles: Role[] = [...new Set([primaryRole, ...additionalRoles])]

      const res = await fetch('/api/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          avatarUrl: avatarUrl.trim() || undefined,
          dateOfBirth: dateOfBirth || undefined,
          gender: gender || undefined,
          username: username.trim() || undefined,
          password: password.trim() || undefined,
          role: primaryRole,
          primaryRole,
          roles: allRoles,
          additionalRoles,
          branchId,
          status,
          employeeCode: employeeCode.trim(),
          designation: designation.trim(),
          department: department.trim() || undefined,
          employmentType,
          qualification: qualification.trim() || undefined,
          joiningDate: joiningDate || undefined,
          reportingManagerId: reportingManagerId || undefined,
          classroomId: isTeacher && classroomId ? classroomId : undefined,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || json.message || 'Failed to create staff account')
      }

      toast.success(
        'Staff Member Onboarded',
        `${fullName} registered as ${ROLE_BADGE[primaryRole]?.label || primaryRole} (Code: ${employeeCode.trim()}).`
      )
      resetForm()
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error('Creation Failed', err.message || 'Error occurred while saving staff user')
    } finally {
      setSubmitting(false)
    }
  }

  const modalFooter = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12 }}>
      <div className="hidden sm:flex" style={{ alignItems: 'center', gap: 6 }}>
        <span
          className="badge b-primary"
          style={{ padding: '4px 12px', fontSize: 11.5, fontWeight: 600, gap: 6 }}
        >
          <Briefcase style={{ width: 13, height: 13 }} />
          Campus Workforce Member
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 'auto', marginLeft: 'auto' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onClose}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          form="add-staff-form"
          className="btn btn-primary btn-sm"
          disabled={submitting}
        >
          {submitting ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className="animate-spin" style={{ width: 12, height: 12, border: '2px solid #FFFFFF', borderTopColor: 'transparent', borderRadius: '50%' }} />
              Creating Staff Account...
            </span>
          ) : (
            'Create Staff Member'
          )}
        </button>
      </div>
    </div>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Preschool Staff User"
      subtitle="Complete workforce onboarding for teachers, administrators, coordinators, and campus staff"
      icon={<Briefcase style={{ width: 20, height: 20 }} />}
      iconClass="ic-purple"
      wide
      footer={modalFooter}
    >
      <form id="add-staff-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} autoComplete="off">
        {/* ── SECTION 1: PERSONAL INFORMATION ── */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
            padding: '16px 18px',
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              paddingBottom: 10,
              borderBottom: '1px solid var(--border-subtle)',
              marginBottom: 14,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              1
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Personal Information
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {/* Full Name */}
            <div className="field">
              <label>
                Full Name <span className="req">*</span>
              </label>
              <div className="input-icon-wrap">
                <User style={{ width: 16, height: 16 }} />
                <input
                  type="text"
                  required
                  placeholder="e.g. Priya Sharma"
                  value={fullName}
                  onChange={(e) => handleFullNameChange(e.target.value)}
                  className="input"
                  style={{ paddingLeft: 38 }}
                />
              </div>
            </div>

            {/* Work Email */}
            <div className="field">
              <label>
                Work Email <span className="req">*</span>
              </label>
              <div className="input-icon-wrap">
                <Mail style={{ width: 16, height: 16 }} />
                <input
                  type="email"
                  required
                  placeholder="e.g. priya@preschool.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  style={{ paddingLeft: 38 }}
                  data-lpignore="true"
                />
              </div>
            </div>

            {/* Mobile Phone */}
            <div className="field">
              <label>Mobile Phone</label>
              <div className="input-icon-wrap">
                <Phone style={{ width: 16, height: 16 }} />
                <input
                  type="tel"
                  placeholder="e.g. +91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input"
                  style={{ paddingLeft: 38 }}
                />
              </div>
            </div>

            {/* Date of Birth */}
            <div className="field">
              <label>Date of Birth</label>
              <div className="input-icon-wrap">
                <Calendar style={{ width: 16, height: 16 }} />
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="input"
                  style={{ paddingLeft: 38 }}
                />
              </div>
            </div>

            {/* Gender */}
            <div className="field">
              <label>Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="select"
              >
                <option value="">Select Gender</option>
                <option value="FEMALE">Female</option>
                <option value="MALE">Male</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {/* Photo / Avatar URL */}
            <div className="field">
              <label>Photo / Avatar URL</label>
              <input
                type="url"
                placeholder="https://example.com/photo.jpg"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="input font-mono"
              />
            </div>
          </div>
        </div>

        {/* ── SECTION 2: LOGIN & ACCESS ── */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
            padding: '16px 18px',
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              paddingBottom: 10,
              borderBottom: '1px solid var(--border-subtle)',
              marginBottom: 14,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              2
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Login & Access Control
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {/* Username */}
            <div className="field">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ margin: 0 }}>
                  Username <span className="req">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsUsernameCustom(false)
                    handleFullNameChange(fullName)
                  }}
                  className="btn btn-ghost btn-xs text-primary"
                  style={{ fontSize: 11, padding: '1px 6px', height: 'auto' }}
                >
                  <RefreshCw style={{ width: 11, height: 11 }} /> Suggest
                </button>
              </div>
              <input
                type="text"
                required
                placeholder="e.g. priya.sharma"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))
                  setIsUsernameCustom(true)
                }}
                className="input font-mono"
              />
              <span className="helper">Used for teacher app, portal and web login</span>
            </div>

            {/* Password */}
            <div className="field">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ margin: 0 }}>
                  Password <span className="req">*</span>
                </label>
                <button
                  type="button"
                  onClick={generateRandomPassword}
                  className="btn btn-ghost btn-xs text-primary"
                  style={{ fontSize: 11, padding: '1px 6px', height: 'auto' }}
                >
                  <Sparkles style={{ width: 11, height: 11 }} /> Generate
                </button>
              </div>
              <div className="input-icon-wrap">
                <Key style={{ width: 16, height: 16 }} />
                <input
                  type="password"
                  placeholder="Leave blank for automatic invite"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input font-mono"
                  style={{ paddingLeft: 38 }}
                  autoComplete="new-password"
                  data-lpignore="true"
                />
              </div>
              <span className="helper">Leave blank to dispatch setup email with one-time link</span>
            </div>

            {/* Primary Role */}
            <div className="field">
              <label>
                Primary Role <span className="req">*</span>
              </label>
              <select
                value={primaryRole}
                onChange={(e) => {
                  const newRole = e.target.value as Role
                  setPrimaryRole(newRole)
                  setAdditionalRoles((prev) => prev.filter((r) => r !== newRole))
                  generateEmployeeCode()
                }}
                className="select"
              >
                {CANONICAL_STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_BADGE[r]?.label || r}
                  </option>
                ))}
              </select>
            </div>

            {/* Campus Branch */}
            <div className="field">
              <label>
                Campus Branch <span className="req">*</span>
              </label>
              <div className="input-icon-wrap">
                <Building style={{ width: 16, height: 16 }} />
                <select
                  required
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="select"
                  style={{ paddingLeft: 38 }}
                >
                  <option value="">Select Campus Branch *</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Account Status */}
            <div className="field">
              <label>
                Account Status <span className="req">*</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="select"
              >
                <option value="ACTIVE">Active (Immediate operational access)</option>
                <option value="PENDING">Pending (Awaiting invitation verification)</option>
                <option value="INACTIVE">Inactive (Disabled temporarily)</option>
                <option value="SUSPENDED">Suspended (Access locked)</option>
              </select>
            </div>
          </div>

          {/* Additional Roles Multi-Select Chips */}
          <div style={{ marginTop: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Additional Assigned Roles (Multi-Role Support)
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {CANONICAL_STAFF_ROLES.filter((r) => r !== primaryRole).map((r) => {
                const isSelected = additionalRoles.includes(r)
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleAdditionalRole(r)}
                    className={`btn btn-xs ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                    style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 'var(--radius-full)' }}
                  >
                    {isSelected && <Check style={{ width: 12, height: 12, marginRight: 4 }} />}
                    {ROLE_BADGE[r]?.label || r}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── SECTION 3: STAFF INFORMATION ── */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
            padding: '16px 18px',
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              paddingBottom: 10,
              borderBottom: '1px solid var(--border-subtle)',
              marginBottom: 14,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              3
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Staff & Employment Details
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {/* Employee Code */}
            <div className="field">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ margin: 0 }}>
                  Employee Code <span className="req">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => generateEmployeeCode()}
                  className="btn btn-ghost btn-xs text-primary"
                  style={{ fontSize: 11, padding: '1px 6px', height: 'auto' }}
                >
                  <RefreshCw style={{ width: 11, height: 11 }} /> Regenerate
                </button>
              </div>
              <input
                type="text"
                required
                placeholder="e.g. EMP-2041"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                className="input font-mono"
              />
              <span className="helper">Workforce identifier (distinct from login username)</span>
            </div>

            {/* Designation */}
            <div className="field">
              <label>
                Job Designation <span className="req">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Senior Montessori Educator"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="input"
              />
              <span className="helper">Official job title (independent of RBAC role)</span>
            </div>

            {/* Department */}
            <div className="field">
              <label>Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="select"
              >
                <option value="Academics">Academics</option>
                <option value="Operations">Operations</option>
                <option value="Finance">Finance</option>
                <option value="Human Resources">Human Resources</option>
                <option value="Transport">Transport</option>
                <option value="Administration">Administration</option>
              </select>
            </div>

            {/* Qualifications */}
            <div className="field">
              <label>Qualifications</label>
              <input
                type="text"
                placeholder="e.g. B.Ed, Early Childhood Diploma"
                value={qualification}
                onChange={(e) => setQualification(e.target.value)}
                className="input"
              />
            </div>

            {/* Employment Type */}
            <div className="field">
              <label>Employment Type</label>
              <select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                className="select"
              >
                <option value="FULL_TIME">Full Time / Permanent</option>
                <option value="PROBATION">Probationary</option>
                <option value="CONTRACT">Contractual</option>
                <option value="PART_TIME">Part Time</option>
                <option value="REGULAR">Regular (Legacy)</option>
              </select>
            </div>

            {/* Joining Date */}
            <div className="field">
              <label>Joining Date</label>
              <div className="input-icon-wrap">
                <Calendar style={{ width: 16, height: 16 }} />
                <input
                  type="date"
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                  className="input"
                  style={{ paddingLeft: 38 }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 4: TEACHING ASSIGNMENT (CONDITIONAL FOR TEACHERS) ── */}
        {isTeacher && (
          <div
            style={{
              background: 'var(--preone-primary-soft)',
              border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)',
              borderRadius: 'var(--radius-xl)',
              padding: '16px 18px',
              boxShadow: 'var(--shadow-soft)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                paddingBottom: 10,
                borderBottom: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  background: 'var(--primary)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                4
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Teaching Assignment
              </span>
            </div>

            <div className="field">
              <label style={{ color: 'var(--primary)', fontWeight: 700 }}>
                Assigned Primary Classroom <span className="req">*</span>
              </label>
              <div className="input-icon-wrap">
                <DoorOpen style={{ width: 16, height: 16 }} />
                <select
                  required
                  value={classroomId}
                  onChange={(e) => setClassroomId(e.target.value)}
                  className="select"
                  style={{ paddingLeft: 38, background: 'var(--bg-card)' }}
                >
                  <option value="">Select Classroom / Section *</option>
                  {availableClassrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.code ? `(${c.code})` : ''} {c.programType ? `— ${c.programType}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.35 }}>
                Binds the teacher to the classroom for attendance taking, daily activity timelines, and learning reports.
              </p>
            </div>
          </div>
        )}
      </form>
    </Modal>
  )
}
