'use client'

import React, { useState, useEffect } from 'react'
import {
  Baby, User, Mail, Phone, Key, Shield, AlertCircle, AlertTriangle,
  CheckCircle2, Lock, Search, RefreshCw, Eye, EyeOff, Plus, Trash2, Camera
} from 'lucide-react'
import { Modal } from '@/components/preone/Modal'
import { useToast } from '@/components/preone/Toast'
import { BranchOption, ClassroomOption } from './types'

interface AddFamilyModalProps {
  open: boolean
  onClose: () => void
  defaultRole?: 'PARENT' | 'GUARDIAN'
  branches: BranchOption[]
  classrooms: ClassroomOption[]
  onSuccess: () => void
}

interface StudentSearchItem {
  id: string
  firstName: string
  lastName: string | null
  admissionNo: string
  currentClassroom?: { id: string; name: string } | null
  branchId?: string
}

export function AddFamilyModal({
  open,
  onClose,
  defaultRole = 'PARENT',
  branches,
  classrooms,
  onSuccess,
}: AddFamilyModalProps) {
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)

  // Step 1: Caregiver Identity
  const [role, setRole] = useState<'PARENT' | 'GUARDIAN'>(defaultRole)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [fullName, setFullName] = useState('')
  const [caregiverGender, setCaregiverGender] = useState<string>('UNSPECIFIED')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [relationship, setRelationship] = useState('FATHER')
  const [status, setStatus] = useState<string>('ACTIVE')

  // Step 2: Child Association
  const [childMode, setChildMode] = useState<'EXISTING' | 'CREATE'>('EXISTING')

  // Existing student state
  const [studentSearch, setStudentSearch] = useState('')
  const [searchingStudents, setSearchingStudents] = useState(false)
  const [studentOptions, setStudentOptions] = useState<StudentSearchItem[]>([])
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchItem | null>(null)
  const [existingParentCount, setExistingParentCount] = useState<number>(0)
  const [checkingParentCount, setCheckingParentCount] = useState(false)

  // Multi-child (additional siblings)
  const [additionalStudents, setAdditionalStudents] = useState<StudentSearchItem[]>([])
  const [siblingSearch, setSiblingSearch] = useState('')
  const [siblingSearching, setSiblingSearching] = useState(false)
  const [siblingOptions, setSiblingOptions] = useState<StudentSearchItem[]>([])
  const [showSiblingSearch, setShowSiblingSearch] = useState(false)

  // New child state
  const [childAdmissionNo, setChildAdmissionNo] = useState('')
  const [childFirstName, setChildFirstName] = useState('')
  const [childLastName, setChildLastName] = useState('')
  const [childDOB, setChildDOB] = useState('')
  const [childGender, setChildGender] = useState('MALE')
  const [childBloodGroup, setChildBloodGroup] = useState('')
  const [childBranchId, setChildBranchId] = useState(branches[0]?.id || '')
  const [childClassroomId, setChildClassroomId] = useState(classrooms[0]?.id || '')
  const [childSeatNumber, setChildSeatNumber] = useState('')
  const [childAdmissionYear, setChildAdmissionYear] = useState('2026-27')

  // Step 3: Permissions & pickup
  const [canPickup, setCanPickup] = useState(true)
  const [pickupPin, setPickupPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [receivesComm, setReceivesComm] = useState(true)
  const [isFeePayer, setIsFeePayer] = useState(true)
  const [isPrimary, setIsPrimary] = useState(false)

  useEffect(() => {
    setRole(defaultRole)
    if (defaultRole === 'GUARDIAN') {
      setRelationship('GRANDPARENT')
      setIsFeePayer(false)
    } else {
      setRelationship('FATHER')
      setIsFeePayer(true)
    }
  }, [defaultRole, open])

  useEffect(() => {
    if (branches.length > 0 && !childBranchId) {
      setChildBranchId(branches[0].id)
    }
    if (classrooms.length > 0 && !childClassroomId) {
      setChildClassroomId(classrooms[0].id)
    }
  }, [branches, classrooms, childBranchId, childClassroomId])

  // Auto-generate username helper
  const handleAutoSuggestUsername = () => {
    if (!fullName.trim()) return
    const clean = fullName.toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.')
    const rand = Math.floor(100 + Math.random() * 900)
    setUsername(`${clean}.${rand}`)
  }

  // Random password generator
  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*'
    let pwd = ''
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setPassword(pwd)
    setShowPassword(true)
  }

  // Search students for primary link
  useEffect(() => {
    if (!studentSearch.trim() || studentSearch.length < 2) {
      setStudentOptions([])
      return
    }

    const timer = setTimeout(async () => {
      setSearchingStudents(true)
      try {
        const res = await fetch(`/api/v1/students?search=${encodeURIComponent(studentSearch.trim())}&pageSize=10`)
        if (res.ok) {
          const json = await res.json()
          setStudentOptions(json.data || json.items || [])
        }
      } catch (err) {
        console.error('Failed to search students:', err)
      } finally {
        setSearchingStudents(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [studentSearch])

  // Search siblings
  useEffect(() => {
    if (!siblingSearch.trim() || siblingSearch.length < 2) {
      setSiblingOptions([])
      return
    }

    const timer = setTimeout(async () => {
      setSiblingSearching(true)
      try {
        const res = await fetch(`/api/v1/students?search=${encodeURIComponent(siblingSearch.trim())}&pageSize=10`)
        if (res.ok) {
          const json = await res.json()
          const items: StudentSearchItem[] = json.data || json.items || []
          const filtered = items.filter(
            (it) => it.id !== selectedStudent?.id && !additionalStudents.some((s) => s.id === it.id)
          )
          setSiblingOptions(filtered)
        }
      } catch (err) {
        console.error('Failed to search siblings:', err)
      } finally {
        setSiblingSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [siblingSearch, selectedStudent, additionalStudents])

  // Check parent count when selectedStudent changes
  useEffect(() => {
    if (!selectedStudent) {
      setExistingParentCount(0)
      return
    }

    const checkParents = async () => {
      setCheckingParentCount(true)
      try {
        const res = await fetch(`/api/v1/students/${selectedStudent.id}`)
        if (res.ok) {
          const json = await res.json()
          const guardians: any[] = json.data?.guardians || []
          const parents = guardians.filter((g) => {
            const r = (g.relationship || '').toUpperCase()
            return r === 'FATHER' || r === 'MOTHER' || g.isParentAccount
          })
          setExistingParentCount(parents.length)
        }
      } catch (e) {
        // Silent catch
      } finally {
        setCheckingParentCount(false)
      }
    }

    checkParents()
  }, [selectedStudent])

  const isParentLimitExceeded = role === 'PARENT' && childMode === 'EXISTING' && existingParentCount >= 2

  const resetForm = () => {
    setFullName('')
    setEmail('')
    setPhone('')
    setUsername('')
    setPassword('')
    setAvatarUrl('')
    setCaregiverGender('UNSPECIFIED')
    setStatus('ACTIVE')
    setSelectedStudent(null)
    setStudentSearch('')
    setAdditionalStudents([])
    setSiblingSearch('')
    setShowSiblingSearch(false)
    setChildAdmissionNo('')
    setChildFirstName('')
    setChildLastName('')
    setChildDOB('')
    setChildBloodGroup('')
    setChildSeatNumber('')
    setPickupPin('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      toast.error('Validation Error', 'Full name, email, and mobile phone are required')
      return
    }

    if (childMode === 'EXISTING' && !selectedStudent) {
      toast.error('Student Required', 'Please search and select the enrolled child')
      return
    }

    if (isParentLimitExceeded) {
      toast.error(
        'Max 2 Parents Rule',
        'This child already has 2 registered parents. Please select the GUARDIAN role.'
      )
      return
    }

    if (childMode === 'CREATE' && (!childFirstName.trim() || !childDOB)) {
      toast.error('Child Info Required', 'Child first name and DOB are required')
      return
    }

    if (pickupPin && !/^\d{4,6}$/.test(pickupPin.trim())) {
      toast.error('Invalid PIN', 'Pickup PIN must be 4 to 6 numeric digits')
      return
    }

    setSubmitting(true)
    try {
      const payload: any = {
        avatarUrl: avatarUrl.trim() || null,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        gender: caregiverGender !== 'UNSPECIFIED' ? caregiverGender : undefined,
        username: username.trim() || undefined,
        password: password.trim() || undefined,
        role,
        primaryRole: role,
        roles: [role],
        relationship,
        status,
        isPrimary,
        canPickup,
        pickupPin: pickupPin.trim() || undefined,
        receivesComm,
        isFeePayer: role === 'PARENT' ? true : isFeePayer,
      }

      if (childMode === 'EXISTING' && selectedStudent) {
        payload.studentId = selectedStudent.id
        payload.studentAdmissionNo = selectedStudent.admissionNo
        if (additionalStudents.length > 0) {
          payload.studentAdmissionNos = additionalStudents.map((s) => s.admissionNo)
        }
      }

      if (childMode === 'CREATE') {
        payload.newChild = {
          admissionNo: childAdmissionNo.trim() || undefined,
          firstName: childFirstName.trim(),
          lastName: childLastName.trim() || undefined,
          dob: childDOB,
          gender: childGender,
          bloodGroup: childBloodGroup || undefined,
          branchId: childBranchId || undefined,
          classroomId: childClassroomId || undefined,
          seatNumber: childSeatNumber.trim() || undefined,
          admissionYear: childAdmissionYear,
        }
      }

      const res = await fetch('/api/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || json.message || 'Failed to create family user')
      }

      toast.success(
        `${role === 'PARENT' ? 'Parent' : 'Guardian'} Account Created`,
        `${fullName} registered successfully. ${json.data?.username ? `Username: ${json.data.username}` : ''}`
      )
      resetForm()
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error('Creation Failed', err.message || 'Error occurred while saving family user')
    } finally {
      setSubmitting(false)
    }
  }

  const modalFooter = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12 }}>
      <div className="hidden sm:flex" style={{ alignItems: 'center', gap: 6 }}>
        {role === 'PARENT' ? (
          <span
            className="badge b-primary"
            style={{ padding: '4px 12px', fontSize: 11.5, fontWeight: 600, gap: 6 }}
          >
            <Shield style={{ width: 13, height: 13 }} />
            Max 2 Parents per child policy enforced
          </span>
        ) : (
          <span
            className="badge b-amber"
            style={{ padding: '4px 12px', fontSize: 11.5, fontWeight: 600, gap: 6 }}
          >
            <CheckCircle2 style={{ width: 13, height: 13 }} />
            Unlimited authorized guardians allowed
          </span>
        )}
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
          form="add-family-form"
          className={`btn btn-sm ${role === 'PARENT' ? 'btn-primary' : ''}`}
          style={
            role === 'GUARDIAN'
              ? { background: 'var(--warning)', color: '#FFFFFF', border: 'none' }
              : undefined
          }
          disabled={submitting || isParentLimitExceeded}
        >
          {submitting ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className="animate-spin" style={{ width: 12, height: 12, border: '2px solid #FFFFFF', borderTopColor: 'transparent', borderRadius: '50%' }} />
              Saving...
            </span>
          ) : (
            `Create ${role === 'PARENT' ? 'Parent Account' : 'Authorized Guardian'}`
          )}
        </button>
      </div>
    </div>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={role === 'PARENT' ? 'Add Parent Account' : 'Add Authorized Guardian'}
      subtitle={
        role === 'PARENT'
          ? 'Primary student caregiver & fee payer with full academic visibility'
          : 'Authorized pickup escort, relative, or secondary campus contact'
      }
      icon={
        role === 'PARENT' ? (
          <User style={{ width: 20, height: 20 }} />
        ) : (
          <Shield style={{ width: 20, height: 20 }} />
        )
      }
      iconClass={role === 'PARENT' ? 'ic-purple' : 'ic-amber'}
      wide
      footer={modalFooter}
    >
      <form id="add-family-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Role Selector Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {/* Parent Account Card */}
          <button
            type="button"
            onClick={() => {
              setRole('PARENT')
              setRelationship('FATHER')
              setIsFeePayer(true)
            }}
            style={{
              position: 'relative',
              textAlign: 'left',
              padding: '14px 16px',
              borderRadius: 'var(--radius-lg)',
              background: role === 'PARENT' ? 'var(--preone-primary-soft)' : 'var(--bg-card)',
              border: role === 'PARENT' ? '2px solid var(--primary)' : '1px solid var(--border-default)',
              boxShadow: role === 'PARENT' ? 'var(--shadow-card)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              transition: 'all 150ms ease',
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: role === 'PARENT' ? 'var(--primary)' : 'var(--bg-muted)',
                color: role === 'PARENT' ? '#FFFFFF' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 150ms ease',
              }}
            >
              <User style={{ width: 18, height: 18 }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Parent Account</span>
                <span className="badge b-primary b-sm">Fee Payer</span>
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.35 }}>
                Max 2 per child. Full billing, academic, and attendance access.
              </p>
            </div>
          </button>

          {/* Authorized Guardian Card */}
          <button
            type="button"
            onClick={() => {
              setRole('GUARDIAN')
              setRelationship('GRANDPARENT')
              setIsFeePayer(false)
            }}
            style={{
              position: 'relative',
              textAlign: 'left',
              padding: '14px 16px',
              borderRadius: 'var(--radius-lg)',
              background: role === 'GUARDIAN' ? 'var(--warning-soft)' : 'var(--bg-card)',
              border: role === 'GUARDIAN' ? '2px solid var(--warning)' : '1px solid var(--border-default)',
              boxShadow: role === 'GUARDIAN' ? 'var(--shadow-card)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              transition: 'all 150ms ease',
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: role === 'GUARDIAN' ? 'var(--warning)' : 'var(--bg-muted)',
                color: role === 'GUARDIAN' ? '#FFFFFF' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 150ms ease',
              }}
            >
              <Shield style={{ width: 18, height: 18 }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Authorized Guardian</span>
                <span className="badge b-amber b-sm">Unlimited</span>
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.35 }}>
                Grandparents & relatives. Gate pickup & timeline notices.
              </p>
            </div>
          </button>
        </div>

        {/* Section 1: Caregiver Information */}
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
              Caregiver Information
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            <div className="field">
              <label>
                Full Name <span className="req">*</span>
              </label>
              <div className="input-icon-wrap">
                <User style={{ width: 16, height: 16 }} />
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Patil"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input"
                  style={{ paddingLeft: 38 }}
                />
              </div>
            </div>

            <div className="field">
              <label>
                Relationship to Child <span className="req">*</span>
              </label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="select"
              >
                {role === 'PARENT' ? (
                  <>
                    <option value="FATHER">Father</option>
                    <option value="MOTHER">Mother</option>
                    <option value="GUARDIAN">Guardian</option>
                  </>
                ) : (
                  <>
                    <option value="GUARDIAN">Guardian</option>
                    <option value="GRANDPARENT">Grandparent (Grandmother / Grandfather)</option>
                    <option value="SIBLING">Sibling (Brother / Sister of legal age)</option>
                    <option value="OTHER">Uncle / Aunt / Caregiver / Nanny</option>
                  </>
                )}
              </select>
            </div>

            <div className="field">
              <label>
                Email Address <span className="req">*</span>
              </label>
              <div className="input-icon-wrap">
                <Mail style={{ width: 16, height: 16 }} />
                <input
                  type="email"
                  required
                  placeholder="e.g. rahul.patil@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  style={{ paddingLeft: 38 }}
                />
              </div>
            </div>

            <div className="field">
              <label>
                Mobile Phone <span className="req">*</span>
              </label>
              <div className="input-icon-wrap">
                <Phone style={{ width: 16, height: 16 }} />
                <input
                  type="tel"
                  required
                  placeholder="e.g. +91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input"
                  style={{ paddingLeft: 38 }}
                />
              </div>
            </div>

            <div className="field">
              <label>Caregiver Gender (Optional)</label>
              <select
                value={caregiverGender}
                onChange={(e) => setCaregiverGender(e.target.value)}
                className="select"
              >
                <option value="UNSPECIFIED">Select Gender (Optional)</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="field">
              <label>Account Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="select"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="PENDING">PENDING</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            </div>

            <div className="field">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label>Portal Username</label>
                <button
                  type="button"
                  onClick={handleAutoSuggestUsername}
                  className="btn-link text-xs"
                  style={{ fontSize: 11, color: 'var(--primary)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                >
                  Suggest from Name
                </button>
              </div>
              <input
                type="text"
                placeholder="e.g. rahul.patil"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input font-mono"
              />
            </div>

            <div className="field">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label>Password</label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="btn-link text-xs"
                  style={{ fontSize: 11, color: 'var(--primary)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                >
                  Generate Password
                </button>
              </div>
              <div className="input-icon-wrap" style={{ position: 'relative' }}>
                <Key style={{ width: 16, height: 16 }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Leave empty for default"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input font-mono"
                  style={{ paddingLeft: 38, paddingRight: 38 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Photo / Avatar URL (Optional)</label>
              <div className="input-icon-wrap">
                <Camera style={{ width: 16, height: 16 }} />
                <input
                  type="url"
                  placeholder="https://..."
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="input"
                  style={{ paddingLeft: 38 }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Student Association */}
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
              justifyContent: 'space-between',
              paddingBottom: 10,
              borderBottom: '1px solid var(--border-subtle)',
              marginBottom: 14,
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                Student Association
              </span>
            </div>

            <div className="seg" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={childMode === 'EXISTING'}
                onClick={() => setChildMode('EXISTING')}
                className={childMode === 'EXISTING' ? 'on' : ''}
              >
                Enrolled Student
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={childMode === 'CREATE'}
                onClick={() => setChildMode('CREATE')}
                className={childMode === 'CREATE' ? 'on' : ''}
              >
                Enroll New Student
              </button>
            </div>
          </div>

          {childMode === 'EXISTING' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {!selectedStudent ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="input-icon-wrap">
                    <Search style={{ width: 16, height: 16 }} />
                    <input
                      type="search"
                      placeholder="Search by Admission No (e.g. ADM-2026-00123) or Student Name..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="input"
                      style={{ paddingLeft: 38 }}
                    />
                  </div>

                  {searchingStudents && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, padding: '2px 4px' }}>
                      <span className="animate-spin" style={{ width: 12, height: 12, border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%' }} />
                      Searching student directory...
                    </div>
                  )}

                  {studentOptions.length > 0 && (
                    <div
                      style={{
                        maxHeight: 190,
                        overflowY: 'auto',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-lg)',
                        background: 'var(--bg-card)',
                        boxShadow: 'var(--shadow-elevated)',
                      }}
                    >
                      {studentOptions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSelectedStudent(s)
                            setStudentSearch('')
                            setStudentOptions([])
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: '1px solid var(--border-subtle)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'background 120ms ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: '50%',
                                background: 'var(--primary-light)',
                                color: 'var(--primary)',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 12,
                              }}
                            >
                              {s.firstName?.[0] || 'S'}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--text-primary)' }}>
                                {s.firstName} {s.lastName || ''}
                              </div>
                              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                                Class: {s.currentClassroom?.name || 'Unassigned'}
                              </div>
                            </div>
                          </div>
                          <span className="badge b-neutral b-sm font-mono" style={{ fontSize: 11 }}>
                            {s.admissionNo}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    padding: '12px 16px',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: 'var(--primary)',
                        color: '#FFFFFF',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 15,
                        boxShadow: 'var(--shadow-soft)',
                      }}
                    >
                      {selectedStudent.firstName?.[0] || 'S'}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 750, color: 'var(--text-primary)' }}>
                          {selectedStudent.firstName} {selectedStudent.lastName || ''}
                        </span>
                        <span className="badge b-primary b-sm font-mono" style={{ fontWeight: 700 }}>
                          {selectedStudent.admissionNo}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>Class: {selectedStudent.currentClassroom?.name || 'Unassigned'}</span>
                        <span>•</span>
                        <span>
                          {checkingParentCount ? (
                            <span style={{ color: 'var(--primary)' }}>Verifying quota...</span>
                          ) : (
                            <span
                              className={`badge b-sm ${
                                existingParentCount >= 2 ? 'b-amber' : 'b-success'
                              }`}
                              style={{ padding: '2px 8px' }}
                            >
                              {existingParentCount >= 2 ? (
                                <AlertTriangle style={{ width: 11, height: 11 }} />
                              ) : (
                                <CheckCircle2 style={{ width: 11, height: 11 }} />
                              )}
                              {existingParentCount}/2 Parents registered
                              {existingParentCount < 2 && ` (${2 - existingParentCount} slot open)`}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStudent(null)
                      setStudentSearch('')
                    }}
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--danger)', fontSize: 12 }}
                  >
                    Change Student
                  </button>
                </div>
              )}

              {/* Max 2 Parents policy warning */}
              {isParentLimitExceeded && (
                <div
                  style={{
                    padding: '12px 16px',
                    background: 'var(--warning-soft)',
                    border: '1px solid var(--warning)',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: 12,
                    color: '#92400E',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}
                >
                  <AlertTriangle style={{ width: 18, height: 18, color: '#D97706', flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <strong style={{ display: 'block', fontSize: 13, marginBottom: 2 }}>
                      Max 2 Parents Rule Enforced
                    </strong>
                    This child already has 2 registered Parent accounts in this preschool. According to school policy, primary parent accounts are capped at 2. You can add this caregiver as an Authorized Guardian with full gate pickup authorizations.
                    <div style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setRole('GUARDIAN')
                          setRelationship('GRANDPARENT')
                          setIsFeePayer(false)
                        }}
                        className="btn btn-sm"
                        style={{ background: '#D97706', color: '#FFFFFF', border: 'none', fontWeight: 700 }}
                      >
                        Switch to Authorized Guardian account →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Multi-Child / Sibling Support */}
              {selectedStudent && (
                <div style={{ marginTop: 8, borderTop: '1px dashed var(--border-default)', paddingTop: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Linked Siblings / Additional Children ({additionalStudents.length})
                    </span>
                    {!showSiblingSearch && (
                      <button
                        type="button"
                        onClick={() => setShowSiblingSearch(true)}
                        className="btn btn-ghost btn-xs"
                        style={{ fontSize: 11.5, color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <Plus size={13} /> Link Another Child
                      </button>
                    )}
                  </div>

                  {additionalStudents.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                      {additionalStudents.map((s) => (
                        <div
                          key={s.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-muted)',
                            fontSize: 12,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Baby size={14} className="text-primary" />
                            <span style={{ fontWeight: 600 }}>{s.firstName} {s.lastName || ''}</span>
                            <span className="badge b-primary b-sm font-mono">{s.admissionNo}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAdditionalStudents(additionalStudents.filter((x) => x.id !== s.id))}
                            className="btn btn-ghost btn-xs text-danger"
                            style={{ padding: 4 }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {showSiblingSearch && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--bg-card)', padding: 10, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="search"
                          placeholder="Search sibling by name or admission no..."
                          value={siblingSearch}
                          onChange={(e) => setSiblingSearch(e.target.value)}
                          className="input input-sm"
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setShowSiblingSearch(false)
                            setSiblingSearch('')
                            setSiblingOptions([])
                          }}
                          className="btn btn-secondary btn-xs"
                        >
                          Cancel
                        </button>
                      </div>

                      {siblingSearching && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Searching siblings...</div>
                      )}

                      {siblingOptions.length > 0 && (
                        <div style={{ maxHeight: 130, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 6 }}>
                          {siblingOptions.map((s) => (
                            <div
                              key={s.id}
                              onClick={() => {
                                setAdditionalStudents([...additionalStudents, s])
                                setSiblingSearch('')
                                setSiblingOptions([])
                                setShowSiblingSearch(false)
                              }}
                              style={{
                                padding: '6px 10px',
                                fontSize: 12,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                borderBottom: '1px solid var(--border-subtle)',
                              }}
                            >
                              <span>{s.firstName} {s.lastName || ''}</span>
                              <span className="font-mono text-xs">{s.admissionNo}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
                padding: '14px 16px',
                background: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div className="field">
                <label>Admission No. (Optional / Auto)</label>
                <input
                  type="text"
                  placeholder="e.g. ADM-2026-00125"
                  value={childAdmissionNo}
                  onChange={(e) => setChildAdmissionNo(e.target.value)}
                  className="input font-mono"
                />
              </div>

              <div className="field">
                <label>
                  Child First Name <span className="req">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Aarav"
                  value={childFirstName}
                  onChange={(e) => setChildFirstName(e.target.value)}
                  className="input"
                />
              </div>

              <div className="field">
                <label>Child Last Name</label>
                <input
                  type="text"
                  placeholder="e.g. Patil"
                  value={childLastName}
                  onChange={(e) => setChildLastName(e.target.value)}
                  className="input"
                />
              </div>

              <div className="field">
                <label>
                  Date of Birth <span className="req">*</span>
                </label>
                <input
                  type="date"
                  value={childDOB}
                  onChange={(e) => setChildDOB(e.target.value)}
                  className="input"
                />
              </div>

              <div className="field">
                <label>Gender <span className="req">*</span></label>
                <select
                  value={childGender}
                  onChange={(e) => setChildGender(e.target.value)}
                  className="select"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="field">
                <label>Blood Group</label>
                <select
                  value={childBloodGroup}
                  onChange={(e) => setChildBloodGroup(e.target.value)}
                  className="select"
                >
                  <option value="">Select (Optional)</option>
                  <option value="A_POSITIVE">A+</option>
                  <option value="A_NEGATIVE">A-</option>
                  <option value="B_POSITIVE">B+</option>
                  <option value="B_NEGATIVE">B-</option>
                  <option value="O_POSITIVE">O+</option>
                  <option value="O_NEGATIVE">O-</option>
                  <option value="AB_POSITIVE">AB+</option>
                  <option value="AB_NEGATIVE">AB-</option>
                </select>
              </div>

              <div className="field">
                <label>Campus Branch <span className="req">*</span></label>
                <select
                  value={childBranchId}
                  onChange={(e) => setChildBranchId(e.target.value)}
                  className="select"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Classroom / Section <span className="req">*</span></label>
                <select
                  value={childClassroomId}
                  onChange={(e) => setChildClassroomId(e.target.value)}
                  className="select"
                >
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Seat Number (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. SEAT-12"
                  value={childSeatNumber}
                  onChange={(e) => setChildSeatNumber(e.target.value)}
                  className="input font-mono"
                />
              </div>

              <div className="field">
                <label>Admission Year <span className="req">*</span></label>
                <input
                  type="text"
                  value={childAdmissionYear}
                  onChange={(e) => setChildAdmissionYear(e.target.value)}
                  className="input font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Security & Campus Authorizations */}
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
              Security & Campus Authorizations
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 14 }}>
            <div className="field">
              <label>
                4-6 Digit Pickup PIN <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Gate signout verification)</span>
              </label>
              <div className="input-icon-wrap" style={{ position: 'relative' }}>
                <Lock style={{ width: 16, height: 16 }} />
                <input
                  type={showPin ? 'text' : 'password'}
                  maxLength={6}
                  placeholder="••••"
                  value={pickupPin}
                  onChange={(e) => setPickupPin(e.target.value.replace(/\D/g, ''))}
                  className="input font-mono"
                  style={{ paddingLeft: 38, paddingRight: 38, letterSpacing: '0.2em' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                  }}
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <span className="helper">Never stored in plain text. Used for afternoon dismissal authorization.</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 'var(--radius-lg)',
                border: canPickup ? '1.5px solid var(--primary)' : '1px solid var(--border-default)',
                background: canPickup ? 'var(--preone-primary-soft)' : 'var(--bg-subtle)',
                cursor: 'pointer',
                transition: 'all 120ms ease',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={canPickup}
                onChange={(e) => setCanPickup(e.target.checked)}
                style={{ width: 16, height: 16, marginTop: 2, accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>
                  Authorized Campus Pickup
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'block', marginTop: 2, lineHeight: 1.35 }}>
                  Authorized to sign-out child from campus gate with PIN verification.
                </span>
              </div>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 'var(--radius-lg)',
                border: receivesComm ? '1.5px solid var(--primary)' : '1px solid var(--border-default)',
                background: receivesComm ? 'var(--preone-primary-soft)' : 'var(--bg-subtle)',
                cursor: 'pointer',
                transition: 'all 120ms ease',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={receivesComm}
                onChange={(e) => setReceivesComm(e.target.checked)}
                style={{ width: 16, height: 16, marginTop: 2, accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>
                  Timeline & Notice Broadcasts
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'block', marginTop: 2, lineHeight: 1.35 }}>
                  Receives daily attendance alerts, classroom photos, and announcements.
                </span>
              </div>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 'var(--radius-lg)',
                border: isFeePayer ? '1.5px solid var(--primary)' : '1px solid var(--border-default)',
                background: isFeePayer ? 'var(--preone-primary-soft)' : 'var(--bg-subtle)',
                cursor: 'pointer',
                transition: 'all 120ms ease',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={isFeePayer}
                onChange={(e) => setIsFeePayer(e.target.checked)}
                disabled={role === 'PARENT'}
                style={{ width: 16, height: 16, marginTop: 2, accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>
                    Fee Payer Authorization
                  </span>
                  {role === 'PARENT' && (
                    <span className="badge b-primary b-sm" style={{ fontSize: 10 }}>Mandatory for Parent</span>
                  )}
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'block', marginTop: 2, lineHeight: 1.35 }}>
                  Authorized to view fee schedules, make payments, and access fee receipts.
                </span>
              </div>
            </label>
          </div>
        </div>
      </form>
    </Modal>
  )
}
