'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  Building2,
  Sliders,
  Bell,
  FileText,
  ShieldCheck,
  Rocket,
  Save,
  Activity,
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  Eye,
  Send,
  Lock,
  LogOut,
  Calendar,
  Layers,
  GraduationCap,
  Users,
  CreditCard,
  RefreshCw,
} from 'lucide-react'
import { PageHead, StatusBadge } from '@/components/preone/ui'
import { Modal } from '@/components/preone/Modal'
import { useToast } from '@/components/preone/Toast'

interface SchoolProfile {
  id: string
  name: string
  code: string
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  phone: string | null
  email: string | null
  website: string | null
  gstNumber: string | null
  panNumber: string | null
  logoUrl: string | null
  currency?: string
  timezone: string
  locale: string
  academicYearStartMonth: number
  status: string
  subscriptionPlan: string
  counts?: {
    branches: number
    academicSessions: number
    programs: number
    classrooms: number
  }
}

interface IntegrationService {
  name: string
  category: string
  status: string
  latencyMs?: number
  provider?: string
  detail: string
}

export default function SettingsControlCenter() {
  const [activeTab, setActiveTab] = useState<string>('profile')
  const [loading, setLoading] = useState<boolean>(true)
  const [busy, setBusy] = useState<boolean>(false)
  const [dirty, setDirty] = useState<boolean>(false)
  const toast = useToast()

  // Data states
  const [profile, setProfile] = useState<SchoolProfile | null>(null)
  const [profileForm, setProfileForm] = useState<Partial<SchoolProfile>>({})
  
  // Domain configs
  const [operatingConfig, setOperatingConfig] = useState<any>({})
  const [admissionConfig, setAdmissionConfig] = useState<any>({})
  const [academicConfig, setAcademicConfig] = useState<any>({})
  const [studentParentConfig, setStudentParentConfig] = useState<any>({})
  const [commConfig, setCommConfig] = useState<any>({})
  
  // Integrations & Health
  const [healthData, setHealthData] = useState<{ overallStatus: string; services: IntegrationService[] } | null>(null)
  
  // Security & RBAC
  const [permissionsMatrix, setPermissionsMatrix] = useState<any[]>([])
  const [passwordModalOpen, setPasswordModalOpen] = useState<boolean>(false)
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  
  // Templates
  const [templates, setTemplates] = useState<any[]>([])
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false)
  const [previewData, setPreviewData] = useState<any>(null)

  // Notification Tester
  const [testChannel, setTestChannel] = useState<'WHATSAPP' | 'SMS' | 'EMAIL'>('WHATSAPP')
  const [testTemplateBody, setTestTemplateBody] = useState<string>('Dear {{parentName}}, your child {{studentName}} arrived safely at {{schoolName}} at {{time}}.')
  const [testRecipient, setTestRecipient] = useState<string>('+91 98765 43210')
  const [testResult, setTestResult] = useState<any>(null)

  // User preferences
  const [themePref, setThemePref] = useState<string>('SYSTEM')
  const [densityPref, setDensityPref] = useState<string>('COMFORTABLE')

  // Notification Logs
  const [deliveryLogs, setDeliveryLogs] = useState<any[]>([])

  // Load All Effective Settings
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [settingsRes, healthRes, permRes, tmplRes, prefRes, logsRes] = await Promise.all([
        fetch('/api/v1/settings').then((r) => r.json()),
        fetch('/api/v1/integrations/health').then((r) => r.json()),
        fetch('/api/v1/settings/permissions').then((r) => r.json()),
        fetch('/api/v1/finance/templates').then((r) => r.json()),
        fetch('/api/v1/settings/preferences').then((r) => r.json()),
        fetch('/api/v1/settings/notifications/logs?limit=30').then((r) => r.json()),
      ])

      if (settingsRes.success && settingsRes.data) {
        setProfile(settingsRes.data.schoolProfile)
        setProfileForm(settingsRes.data.schoolProfile)
        const d = settingsRes.data.domains || {}
        setOperatingConfig(d.OPERATING || {})
        setAdmissionConfig(d.ADMISSION || {})
        setAcademicConfig(d.CURRICULUM || {})
        setStudentParentConfig(d.STUDENT_PARENT || {})
        setCommConfig(d.COMMUNICATION || {})
      }

      if (healthRes.success) setHealthData(healthRes.data)
      if (permRes.success) setPermissionsMatrix(permRes.data.matrix || [])
      if (tmplRes.success) setTemplates(tmplRes.data || [])
      if (prefRes.success) {
        setThemePref(prefRes.data.theme || 'SYSTEM')
        setDensityPref(prefRes.data.density || 'COMFORTABLE')
      }
      if (logsRes.success && logsRes.data) {
        setDeliveryLogs(logsRes.data.logs || [])
      }
      setDirty(false)
    } catch (e: any) {
      toast.error('Failed to load settings', e.message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Tab change with unsaved protection
  const handleTabChange = (newTab: string) => {
    if (dirty) {
      if (!confirm('You have unsaved changes. Are you sure you want to discard them?')) {
        return
      }
    }
    setDirty(false)
    setActiveTab(newTab)
  }

  // Save School Profile
  const handleSaveProfile = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: profileForm }),
      }).then((r) => r.json())

      if (res.success) {
        toast.success('School profile updated successfully')
        setProfile((prev) => ({ ...prev, ...profileForm } as SchoolProfile))
        setDirty(false)
      } else {
        toast.error('Update failed', res.error?.message || 'Could not save profile')
      }
    } catch (e: any) {
      toast.error('Save failed', e.message)
    } finally {
      setBusy(false)
    }
  }

  // Save Domain Config
  const handleSaveDomain = async (domain: string, data: any) => {
    setBusy(true)
    try {
      const res = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, data }),
      }).then((r) => r.json())

      if (res.success) {
        toast.success(`${domain} configuration updated`)
        setDirty(false)
      } else {
        toast.error('Update failed', res.error?.message || 'Failed to update domain')
      }
    } catch (e: any) {
      toast.error('Save failed', e.message)
    } finally {
      setBusy(false)
    }
  }

  // Password Change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Validation error', 'New passwords do not match')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/v1/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      }).then((r) => r.json())

      if (res.success) {
        toast.success('Password updated successfully')
        setPasswordModalOpen(false)
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      } else {
        toast.error('Password change failed', res.error?.message || 'Verification failed')
      }
    } catch (e: any) {
      toast.error('Error', e.message)
    } finally {
      setBusy(false)
    }
  }

  // Revoke All Sessions
  const handleRevokeSessions = async () => {
    if (!confirm('Sign out all devices? This will invalidate all active sessions for your user account.')) return
    setBusy(true)
    try {
      const meRes = await fetch('/api/v1/me').then((r) => r.json())
      if (meRes.success && meRes.data.userId) {
        const res = await fetch(`/api/v1/users/${meRes.data.userId}/revoke-sessions`, {
          method: 'POST',
        }).then((r) => r.json())
        if (res.success) {
          toast.success('All sessions revoked', 'Active sessions invalidated across devices')
        } else {
          toast.error('Failed to revoke sessions', res.error?.message)
        }
      }
    } catch (e: any) {
      toast.error('Error', e.message)
    } finally {
      setBusy(false)
    }
  }

  // Test Notification
  const handleTestNotification = async () => {
    setBusy(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/v1/setup/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: testChannel,
          templateBody: testTemplateBody,
          recipient: testRecipient,
        }),
      }).then((r) => r.json())

      if (res.success) {
        setTestResult(res.data)
        if (res.data.testStatus === 'REAL_TEST') {
          toast.success('Test message delivered', res.data.message)
        } else {
          toast.info('Configuration validation only', res.data.message)
        }
      } else {
        toast.error('Validation failed', res.error?.message)
      }
    } catch (e: any) {
      toast.error('Delivery test error', e.message)
    } finally {
      setBusy(false)
    }
  }

  // Preview Document Template
  const handlePreviewTemplate = async (templateId: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/finance/templates/${templateId}/preview`, {
        method: 'POST',
      }).then((r) => r.json())

      if (res.success) {
        setPreviewData(res.data)
        setPreviewModalOpen(true)
      } else {
        toast.error('Preview error', res.error?.message)
      }
    } catch (e: any) {
      toast.error('Failed to generate preview', e.message)
    } finally {
      setBusy(false)
    }
  }

  // User Preferences
  const handleSavePreferences = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/v1/settings/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: themePref, density: densityPref }),
      }).then((r) => r.json())

      if (res.success) {
        toast.success('Preferences saved')
      }
    } catch (e: any) {
      toast.error('Failed to save preferences', e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-container space-y-6" style={{ paddingBottom: 60 }}>
      <PageHead
        title="Settings & Administration"
        sub="Unified configuration control center for preschool operations, policies, integrations, and RBAC"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <StatusBadge status="ACTIVE" label="Authoritative Sync Active" />
            <button className="btn btn-secondary" onClick={loadData} disabled={loading || busy}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        }
      />

      {/* 12-Panel Navigation Tabs */}
      <div className="segmented-scroll" style={{ overflowX: 'auto', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'inline-flex', gap: 6, paddingBottom: 8 }}>
          {[
            { id: 'profile', label: 'School Profile', icon: Building2 },
            { id: 'organization', label: 'Organization', icon: Layers },
            { id: 'operations', label: 'Operating Schedule', icon: Sliders },
            { id: 'admissions', label: 'Admissions Policy', icon: Rocket },
            { id: 'academics', label: 'Academics & EYFS', icon: GraduationCap },
            { id: 'students', label: 'Student Lifecycle', icon: Users },
            { id: 'finance', label: 'Finance & Invoicing', icon: CreditCard },
            { id: 'templates', label: 'Document Templates', icon: FileText },
            { id: 'notifications', label: 'Communications & Alerts', icon: Bell },
            { id: 'security', label: 'Security & Access', icon: ShieldCheck },
            { id: 'rbac', label: 'Role Permissions', icon: UserCheck },
            { id: 'health', label: 'Integration Health', icon: Activity },
            { id: 'preferences', label: 'My Preferences', icon: Sliders },
          ].map((t) => {
            const Icon = t.icon
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => handleTabChange(t.id)}
                className={`btn ${active ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Icon size={14} />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {dirty && (
        <div className="panel" style={{ backgroundColor: 'var(--warning-bg, var(--warning-soft))', borderColor: 'var(--warning-border, var(--warning-soft))', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>
            ⚠️ You have unsaved changes. Remember to save your configuration before navigating away.
          </span>
          <button className="btn btn-sm btn-ghost" onClick={() => setDirty(false)}>Dismiss</button>
        </div>
      )}

      {/* PANEL 1: SCHOOL PROFILE & LOCALIZATION */}
      {activeTab === 'profile' && profile && (
        <div className="panel space-y-6">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>School Identity & Regional Localization</h3>
              <p className="txt-muted" style={{ fontSize: 13 }}>Authoritative school details, tax identifiers, and date/time formatting</p>
            </div>
            <button className="btn btn-primary" onClick={handleSaveProfile} disabled={busy}>
              <Save size={14} />
              Save Profile
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            <div className="form-group">
              <label>School Name *</label>
              <input
                type="text"
                className="input"
                value={profileForm.name || ''}
                onChange={(e) => {
                  setProfileForm({ ...profileForm, name: e.target.value })
                  setDirty(true)
                }}
              />
            </div>
            <div className="form-group">
              <label>School Code (Unique)</label>
              <input type="text" className="input" value={profile.code} disabled />
            </div>
            <div className="form-group">
              <label>Official Email</label>
              <input
                type="email"
                className="input"
                value={profileForm.email || ''}
                onChange={(e) => {
                  setProfileForm({ ...profileForm, email: e.target.value })
                  setDirty(true)
                }}
              />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="text"
                className="input"
                value={profileForm.phone || ''}
                onChange={(e) => {
                  setProfileForm({ ...profileForm, phone: e.target.value })
                  setDirty(true)
                }}
              />
            </div>
            <div className="form-group">
              <label>Website</label>
              <input
                type="text"
                className="input"
                value={profileForm.website || ''}
                onChange={(e) => {
                  setProfileForm({ ...profileForm, website: e.target.value })
                  setDirty(true)
                }}
              />
            </div>
            <div className="form-group">
              <label>Timezone</label>
              <select
                className="input"
                value={profileForm.timezone || 'Asia/Kolkata'}
                onChange={(e) => {
                  setProfileForm({ ...profileForm, timezone: e.target.value })
                  setDirty(true)
                }}
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                <option value="UTC">UTC (+0:00)</option>
                <option value="Asia/Dubai">Asia/Dubai (+4:00)</option>
                <option value="Asia/Singapore">Asia/Singapore (+8:00)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Locale / Language</label>
              <select
                className="input"
                value={profileForm.locale || 'en-IN'}
                onChange={(e) => {
                  setProfileForm({ ...profileForm, locale: e.target.value })
                  setDirty(true)
                }}
              >
                <option value="en-IN">English (India) - en-IN</option>
                <option value="en-US">English (US) - en-US</option>
                <option value="en-GB">English (UK) - en-GB</option>
              </select>
            </div>
            <div className="form-group">
              <label>Academic Year Start Month</label>
              <select
                className="input"
                value={profileForm.academicYearStartMonth || 4}
                onChange={(e) => {
                  setProfileForm({ ...profileForm, academicYearStartMonth: parseInt(e.target.value) })
                  setDirty(true)
                }}
              >
                <option value={1}>January</option>
                <option value={4}>April (Standard Indian Preschools)</option>
                <option value={6}>June</option>
                <option value={9}>September</option>
              </select>
            </div>
            <div className="form-group">
              <label>GSTIN / Tax ID</label>
              <input
                type="text"
                className="input"
                placeholder="27AABCU9603R1ZM"
                value={profileForm.gstNumber || ''}
                onChange={(e) => {
                  setProfileForm({ ...profileForm, gstNumber: e.target.value })
                  setDirty(true)
                }}
              />
            </div>
            <div className="form-group">
              <label>PAN Number</label>
              <input
                type="text"
                className="input"
                placeholder="ABCDE1234F"
                value={profileForm.panNumber || ''}
                onChange={(e) => {
                  setProfileForm({ ...profileForm, panNumber: e.target.value })
                  setDirty(true)
                }}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Physical Address</label>
            <textarea
              className="input"
              rows={2}
              value={profileForm.address || ''}
              onChange={(e) => {
                setProfileForm({ ...profileForm, address: e.target.value })
                setDirty(true)
              }}
            />
          </div>
        </div>
      )}

      {/* PANEL 2: ORGANIZATION MASTERS OVERVIEW */}
      {activeTab === 'organization' && profile && (
        <div className="space-y-4">
          <div className="panel">
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Authoritative Organization Topology</h3>
            <p className="txt-muted" style={{ fontSize: 13, marginBottom: 16 }}>
              Settings directly maps to authoritative master entities in the database. Modify entities using their canonical modules.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <div className="panel" style={{ backgroundColor: 'var(--bg-subtle)' }}>
                <span className="txt-muted" style={{ fontSize: 12 }}>Active Branches</span>
                <p style={{ fontSize: 24, fontWeight: 700, margin: '4px 0' }}>{profile.counts?.branches ?? 1}</p>
                <a href="/app/setup/branches" className="btn btn-sm btn-ghost" style={{ paddingLeft: 0 }}>Configure Branches →</a>
              </div>
              <div className="panel" style={{ backgroundColor: 'var(--bg-subtle)' }}>
                <span className="txt-muted" style={{ fontSize: 12 }}>Academic Sessions</span>
                <p style={{ fontSize: 24, fontWeight: 700, margin: '4px 0' }}>{profile.counts?.academicSessions ?? 1}</p>
                <a href="/app/setup/academic-years" className="btn btn-sm btn-ghost" style={{ paddingLeft: 0 }}>Manage Sessions →</a>
              </div>
              <div className="panel" style={{ backgroundColor: 'var(--bg-subtle)' }}>
                <span className="txt-muted" style={{ fontSize: 12 }}>Preschool Programs</span>
                <p style={{ fontSize: 24, fontWeight: 700, margin: '4px 0' }}>{profile.counts?.programs ?? 4}</p>
                <a href="/app/setup/programs" className="btn btn-sm btn-ghost" style={{ paddingLeft: 0 }}>Manage Programs →</a>
              </div>
              <div className="panel" style={{ backgroundColor: 'var(--bg-subtle)' }}>
                <span className="txt-muted" style={{ fontSize: 12 }}>Classrooms / Sections</span>
                <p style={{ fontSize: 24, fontWeight: 700, margin: '4px 0' }}>{profile.counts?.classrooms ?? 2}</p>
                <a href="/app/setup/classrooms" className="btn btn-sm btn-ghost" style={{ paddingLeft: 0 }}>Manage Classrooms →</a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PANEL 3: OPERATIONS & ATTENDANCE SCHEDULE */}
      {activeTab === 'operations' && (
        <div className="panel space-y-6">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>Daily Operating Schedule & Attendance Rules</h3>
              <p className="txt-muted" style={{ fontSize: 13 }}>Authoritative gate hours, arrival windows, late arrival tolerance, and pickup window</p>
            </div>
            <button className="btn btn-primary" onClick={() => handleSaveDomain('OPERATING', operatingConfig)} disabled={busy}>
              <Save size={14} />
              Save Operating Rules
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            <div className="form-group">
              <label>School Start Time</label>
              <input
                type="time"
                className="input"
                value={operatingConfig.schoolStartTime || '08:30'}
                onChange={(e) => {
                  setOperatingConfig({ ...operatingConfig, schoolStartTime: e.target.value })
                  setDirty(true)
                }}
              />
            </div>
            <div className="form-group">
              <label>School End Time</label>
              <input
                type="time"
                className="input"
                value={operatingConfig.schoolEndTime || '16:00'}
                onChange={(e) => {
                  setOperatingConfig({ ...operatingConfig, schoolEndTime: e.target.value })
                  setDirty(true)
                }}
              />
            </div>
            <div className="form-group">
              <label>Arrival Window Start</label>
              <input
                type="time"
                className="input"
                value={operatingConfig.arrivalWindowStart || '08:00'}
                onChange={(e) => {
                  setOperatingConfig({ ...operatingConfig, arrivalWindowStart: e.target.value })
                  setDirty(true)
                }}
              />
            </div>
            <div className="form-group">
              <label>Arrival Window End (Late Cutoff)</label>
              <input
                type="time"
                className="input"
                value={operatingConfig.arrivalWindowEnd || '09:30'}
                onChange={(e) => {
                  setOperatingConfig({ ...operatingConfig, arrivalWindowEnd: e.target.value })
                  setDirty(true)
                }}
              />
            </div>
            <div className="form-group">
              <label>Pickup Window Start</label>
              <input
                type="time"
                className="input"
                value={operatingConfig.pickupWindowStart || '15:30'}
                onChange={(e) => {
                  setOperatingConfig({ ...operatingConfig, pickupWindowStart: e.target.value })
                  setDirty(true)
                }}
              />
            </div>
            <div className="form-group">
              <label>Pickup Window End (Late Pickup Begins)</label>
              <input
                type="time"
                className="input"
                value={operatingConfig.pickupWindowEnd || '17:00'}
                onChange={(e) => {
                  setOperatingConfig({ ...operatingConfig, pickupWindowEnd: e.target.value })
                  setDirty(true)
                }}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Late Arrival Policy Note</label>
            <input
              type="text"
              className="input"
              value={operatingConfig.lateArrivalRule || 'Marked LATE after arrival window ends'}
              onChange={(e) => {
                setOperatingConfig({ ...operatingConfig, lateArrivalRule: e.target.value })
                setDirty(true)
              }}
            />
          </div>
        </div>
      )}

      {/* PANEL 4: ADMISSIONS POLICIES */}
      {activeTab === 'admissions' && (
        <div className="panel space-y-6">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>Admissions Rules & Document Requirements</h3>
              <p className="txt-muted" style={{ fontSize: 13 }}>Configurable document checklist, default registration fees, and admission rules</p>
            </div>
            <button className="btn btn-primary" onClick={() => handleSaveDomain('ADMISSION', admissionConfig)} disabled={busy}>
              <Save size={14} />
              Save Admission Policy
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            <div className="form-group">
              <label>Default Registration Fee (INR)</label>
              <input
                type="number"
                className="input"
                value={admissionConfig.registrationFeeRupees ?? 500}
                onChange={(e) => {
                  setAdmissionConfig({ ...admissionConfig, registrationFeeRupees: parseInt(e.target.value) || 0 })
                  setDirty(true)
                }}
              />
            </div>
            <div className="form-group">
              <label>Offer Letter Validity (Days)</label>
              <input
                type="number"
                className="input"
                value={admissionConfig.offerValidityDays ?? 7}
                onChange={(e) => {
                  setAdmissionConfig({ ...admissionConfig, offerValidityDays: parseInt(e.target.value) || 7 })
                  setDirty(true)
                }}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Required Documents for Enrollment</label>
            <p className="txt-muted" style={{ fontSize: 12, marginBottom: 8 }}>Mandatory checklist items checked during document verification gate</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {['BIRTH_CERTIFICATE', 'PHOTO', 'AADHAAR', 'IMMUNIZATION_RECORD', 'ADDRESS_PROOF'].map((doc) => {
                const isSelected = (admissionConfig.requiredDocuments || []).includes(doc)
                return (
                  <button
                    key={doc}
                    type="button"
                    className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => {
                      const cur = admissionConfig.requiredDocuments || []
                      const next = isSelected ? cur.filter((d: string) => d !== doc) : [...cur, doc]
                      setAdmissionConfig({ ...admissionConfig, requiredDocuments: next })
                      setDirty(true)
                    }}
                  >
                    {isSelected ? '✓ ' : '+ '} {doc.replace('_', ' ')}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* PANEL 5: ACADEMICS & CURRICULUM */}
      {activeTab === 'academics' && (
        <div className="panel space-y-6">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>Academic Framework & Developmental Areas</h3>
              <p className="txt-muted" style={{ fontSize: 13 }}>EYFS developmental areas, assessment methods, and milestone tracking options</p>
            </div>
            <button className="btn btn-primary" onClick={() => handleSaveDomain('CURRICULUM', academicConfig)} disabled={busy}>
              <Save size={14} />
              Save Academic Settings
            </button>
          </div>

          <div className="form-group">
            <label>Milestone Framework</label>
            <select
              className="input"
              value={academicConfig.milestoneFramework || 'EYFS'}
              onChange={(e) => {
                setAcademicConfig({ ...academicConfig, milestoneFramework: e.target.value })
                setDirty(true)
              }}
            >
              <option value="EYFS">Early Years Foundation Stage (EYFS - UK Standards)</option>
              <option value="MONTESSORI">Montessori Developmental Framework</option>
              <option value="WALDORF">Waldorf Early Childhood</option>
              <option value="CUSTOM">Custom Early Childhood Competencies</option>
            </select>
          </div>

          <div className="form-group">
            <label>Core Learning Areas</label>
            <p className="txt-muted" style={{ fontSize: 12, marginBottom: 8 }}>Foundational developmental categories for child observations</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {['Language & Literacy', 'Numeracy & Logic', 'Motor Skills', 'Social-Emotional', 'Creative Arts', 'Knowledge of the World'].map((area) => {
                const isSelected = (academicConfig.learningAreas || []).includes(area)
                return (
                  <button
                    key={area}
                    type="button"
                    className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => {
                      const cur = academicConfig.learningAreas || []
                      const next = isSelected ? cur.filter((a: string) => a !== area) : [...cur, area]
                      setAcademicConfig({ ...academicConfig, learningAreas: next })
                      setDirty(true)
                    }}
                  >
                    {isSelected ? '✓ ' : '+ '} {area}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* PANEL 6: STUDENT LIFECYCLE & GUARDIAN POLICIES */}
      {activeTab === 'students' && (
        <div className="panel space-y-6">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>Student Lifecycle & Pickup Verification Policies</h3>
              <p className="txt-muted" style={{ fontSize: 13 }}>Authoritative guardian pickup validation method and child security safeguards</p>
            </div>
            <button className="btn btn-primary" onClick={() => handleSaveDomain('STUDENT_PARENT', studentParentConfig)} disabled={busy}>
              <Save size={14} />
              Save Student Policy
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            <div className="form-group">
              <label>Pickup Verification Mode</label>
              <select
                className="input"
                value={studentParentConfig.pickupVerification || 'PIN_MATCH'}
                onChange={(e) => {
                  setStudentParentConfig({ ...studentParentConfig, pickupVerification: e.target.value })
                  setDirty(true)
                }}
              >
                <option value="PIN_MATCH">Daily Rotating OTP / Secure PIN Match</option>
                <option value="ID_CARD">School RFID / Student Escort Card</option>
                <option value="PHOTO_VERIFICATION">Biometric / Photo Escort Verification</option>
              </select>
            </div>
            <div className="form-group">
              <label>Max Authorized Pickups per Student</label>
              <input
                type="number"
                className="input"
                value={studentParentConfig.maxAuthorizedPickups ?? 4}
                onChange={(e) => {
                  setStudentParentConfig({ ...studentParentConfig, maxAuthorizedPickups: parseInt(e.target.value) || 4 })
                  setDirty(true)
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* PANEL 7: FINANCE & INVOICING */}
      {activeTab === 'finance' && (
        <div className="panel space-y-6">
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 600 }}>Finance & Payment Gateway Settings</h3>
            <p className="txt-muted" style={{ fontSize: 13 }}>
              Full fee structure configuration, cash limits, and payment gateways are managed under the Finance Control Center.
            </p>
          </div>
          <div style={{ padding: 20, backgroundColor: 'var(--bg-subtle)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontWeight: 600, fontSize: 14 }}>Fees & Concession Management</p>
              <p className="txt-muted" style={{ fontSize: 13 }}>Manage fee structures, Section 269ST compliance, sibling discount rules, and Razorpay/Stripe keys.</p>
            </div>
            <a href="/app/finance" className="btn btn-primary">Open Finance Module →</a>
          </div>
        </div>
      )}

      {/* PANEL 8: DOCUMENT TEMPLATES */}
      {activeTab === 'templates' && (
        <div className="panel space-y-6">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>Document & Receipt Templates</h3>
              <p className="txt-muted" style={{ fontSize: 13 }}>Database-backed templates for Fee Invoices and Official Payment Receipts with live preview</p>
            </div>
            <a href="/app/finance?tab=templates" className="btn btn-secondary">Design New Template</a>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            {templates.map((tmpl) => (
              <div key={tmpl.id} className="panel" style={{ border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span className="badge" style={{ fontSize: 11 }}>{tmpl.type}</span>
                    {tmpl.isDefault && <StatusBadge status="ACTIVE" label="Default Template" />}
                  </div>
                  <h4 style={{ fontSize: 15, fontWeight: 600 }}>{tmpl.name}</h4>
                  <p className="txt-muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Header: {(tmpl.content as any)?.headerTitle || 'Default Header'}
                  </p>
                </div>
                <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm btn-ghost" onClick={() => handlePreviewTemplate(tmpl.id)}>
                    <Eye size={13} /> Live Preview
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PANEL 9: COMMUNICATIONS & NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div className="panel space-y-6">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>Notification Gateways & Delivery Tester</h3>
              <p className="txt-muted" style={{ fontSize: 13 }}>Verify messaging templates against strict server credentials (zero fake delivery)</p>
            </div>
            <button className="btn btn-primary" onClick={() => handleSaveDomain('COMMUNICATION', commConfig)} disabled={busy}>
              <Save size={14} />
              Save Communication Rules
            </button>
          </div>

          <div className="form-group">
            <label>Active Notification Channels</label>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
              {['IN_APP', 'WHATSAPP', 'SMS', 'EMAIL'].map((ch) => {
                const isSelected = (commConfig.channels || ['IN_APP']).includes(ch)
                return (
                  <button
                    key={ch}
                    type="button"
                    className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => {
                      const cur = commConfig.channels || ['IN_APP']
                      const next = isSelected ? cur.filter((c: string) => c !== ch) : [...cur, ch]
                      setCommConfig({ ...commConfig, channels: next.length ? next : ['IN_APP'] })
                      setDirty(true)
                    }}
                  >
                    {isSelected ? '✓ ' : '+ '} {ch.replace('_', ' ')}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Event Dispatch Rules Matrix */}
          <div className="panel" style={{ marginTop: 20 }}>
            <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Automated Event Notification Rules</h4>
            <p className="txt-muted" style={{ fontSize: 12, marginBottom: 16 }}>
              Select which preschool domain state events trigger automated notifications to authorized guardians and staff.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {[
                { key: 'ATTENDANCE_UPDATE', label: 'Attendance (Absent / Late)', desc: 'Alerts guardians when child is marked absent or arrives late' },
                { key: 'HEALTH_ALERT', label: 'Health & Safety Incidents', desc: 'Instant alerts on wellness check anomalies or injuries' },
                { key: 'FEE_DUE', label: 'Fee Due & Overdue Invoices', desc: 'Dispatches invoice and overdue payment reminders' },
                { key: 'FEE_RECEIVED', label: 'Payment Receipts', desc: 'Confirms successful fee payments with receipt details' },
                { key: 'TRANSPORT_DELAY', label: 'School Bus Delays', desc: 'Notifies affected parents when transport trips run late' },
                { key: 'ANNOUNCEMENT', label: 'Broadcast Announcements', desc: 'School-wide and classroom broadcasts from management' },
                { key: 'INVENTORY_ALERT', label: 'Low Stock & Expiry Alerts', desc: 'Alerts Accounts and Principal when supplies fall below threshold' },
                { key: 'STAFF_ALERT', label: 'Workforce & Leave Alerts', desc: 'Notifies leadership on onboarding, leave, and coverage requests' },
              ].map((ev) => {
                const currentEvents = commConfig.notificationEvents || []
                const isEnabled = currentEvents.includes(ev.key)
                return (
                  <div
                    key={ev.key}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 8,
                      border: `1px solid ${isEnabled ? 'var(--primary)' : 'var(--border)'}`,
                      backgroundColor: isEnabled ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      const next = isEnabled
                        ? currentEvents.filter((k: string) => k !== ev.key)
                        : [...currentEvents, ev.key]
                      setCommConfig({ ...commConfig, notificationEvents: next })
                      setDirty(true)
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{ev.label}</span>
                      <span className={`badge ${isEnabled ? 'b-green' : 'b-neutral'}`}>
                        {isEnabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                    <p className="txt-muted" style={{ fontSize: 12, marginTop: 4 }}>{ev.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Truthful Notification Tester */}
          <div className="panel" style={{ backgroundColor: 'var(--bg-subtle)', marginTop: 24 }}>
            <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Send size={15} /> Truthful Notification Delivery Tester
            </h4>
            <p className="txt-muted" style={{ fontSize: 12, marginBottom: 16 }}>
              Validates placeholder variables and checks provider connectivity. Returns REAL_TEST or CONFIGURATION_ONLY.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
              <div className="form-group">
                <label>Test Channel</label>
                <select className="input" value={testChannel} onChange={(e: any) => setTestChannel(e.target.value)}>
                  <option value="WHATSAPP">WhatsApp Cloud API</option>
                  <option value="SMS">SMS Gateway</option>
                  <option value="EMAIL">Transactional Email (SMTP/SendGrid)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Test Recipient</label>
                <input
                  type="text"
                  className="input"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="+91 98765 43210 or email@domain.com"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 12 }}>
              <label>Template Body (Supported: {'{{studentName}}'}, {'{{parentName}}'}, {'{{schoolName}}'}, {'{{time}}'}, {'{{amount}}'})</label>
              <textarea
                className="input"
                rows={2}
                value={testTemplateBody}
                onChange={(e) => setTestTemplateBody(e.target.value)}
              />
            </div>

            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={handleTestNotification} disabled={busy}>
                <Send size={13} />
                Run Delivery Test
              </button>
            </div>

            {testResult && (
              <div
                className="panel"
                style={{
                  marginTop: 14,
                  backgroundColor: testResult.testStatus === 'REAL_TEST' ? 'var(--success-bg, var(--success-soft))' : 'var(--warning-bg, var(--warning-soft))',
                  borderColor: testResult.testStatus === 'REAL_TEST' ? 'var(--success)' : 'var(--warning-border, var(--warning-soft))',
                  color: testResult.testStatus === 'REAL_TEST' ? 'var(--success)' : 'var(--warning)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                  {testResult.testStatus === 'REAL_TEST' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>Result: {testResult.testStatus}</span>
                </div>
                <p style={{ fontSize: 13, marginTop: 4 }}>{testResult.message}</p>
              </div>
            )}
          </div>

          {/* Live Delivery Audit Log */}
          <div className="panel" style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 600 }}>Recent Delivery Audit Logs</h4>
                <p className="txt-muted" style={{ fontSize: 12 }}>Audit trail of dispatches across In-App, Email, SMS, and WhatsApp</p>
              </div>
              <span className="badge b-neutral">{deliveryLogs.length} Records</span>
            </div>

            {deliveryLogs.length === 0 ? (
              <p className="txt-muted" style={{ fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
                No notifications logged yet. Triggering automated actions or tests will record here.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px 10px' }}>Time</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px' }}>Event</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px' }}>Channel</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px' }}>Recipient</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px' }}>Status</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px' }}>Title</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryLogs.map((log: any) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} className="txt-muted">
                          {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <b>{log.eventType}</b>
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span className="badge b-neutral">{log.channel}</span>
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span>{log.recipientAddress || log.recipientId}</span>
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span className={`badge ${
                            log.status === 'DELIVERED' || log.status === 'SENT'
                              ? 'b-green'
                              : log.status === 'CONFIGURATION_ONLY'
                              ? 'b-orange'
                              : 'b-red'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.title}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PANEL 10: SECURITY, PASSWORD & SESSION MANAGEMENT */}
      {activeTab === 'security' && (
        <div className="panel space-y-6">
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 600 }}>Account Security & Device Session Management</h3>
            <p className="txt-muted" style={{ fontSize: 13 }}>Manage authentication security, password policies, and active sessions</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div className="panel" style={{ border: '1px solid var(--border)' }}>
              <h4 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Lock size={15} /> Password Policy
              </h4>
              <p className="txt-muted" style={{ fontSize: 12, margin: '8px 0 16px' }}>
                Passwords require a minimum of 8 characters and are encrypted with bcrypt salt rounds.
              </p>
              <button className="btn btn-secondary" onClick={() => setPasswordModalOpen(true)}>
                Change Account Password
              </button>
            </div>

            <div className="panel" style={{ border: '1px solid var(--border)' }}>
              <h4 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <LogOut size={15} /> Active Device Sessions
              </h4>
              <p className="txt-muted" style={{ fontSize: 12, margin: '8px 0 16px' }}>
                Instantly invalidate all active browser cookies and authentication tokens across devices.
              </p>
              <button className="btn btn-secondary" onClick={handleRevokeSessions} disabled={busy}>
                Sign Out All Devices
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PANEL 11: ROLE-PERMISSION MATRIX (RBAC) */}
      {activeTab === 'rbac' && (
        <div className="panel space-y-6">
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 600 }}>Role-Based Access Control (RBAC) Hierarchy</h3>
            <p className="txt-muted" style={{ fontSize: 13 }}>Authoritative system permissions resolved directly from backend ROLE_PERMISSIONS dictionary</p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px 14px' }}>System Role</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px' }}>Scope & Authority</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px' }}>Authorized Module Capabilities</th>
                </tr>
              </thead>
              <tbody>
                {permissionsMatrix.map((item) => (
                  <tr key={item.role} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>{item.role}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className="badge" style={{ fontSize: 11 }}>
                        {item.isWildcard ? 'Full Tenant Master' : `${item.permissionsCount} Grants`}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {item.moduleBreakdown
                          .filter((m: any) => m.hasAccess)
                          .map((m: any) => (
                            <span key={m.module} className="badge" style={{ fontSize: 11, backgroundColor: 'var(--bg-subtle)' }}>
                              {m.module}: {m.actions.join(', ') || 'full'}
                            </span>
                          ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PANEL 12: INTEGRATION HEALTH */}
      {activeTab === 'health' && (
        <div className="panel space-y-6">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>System Services & Integration Health</h3>
              <p className="txt-muted" style={{ fontSize: 13 }}>Live operational health for database, gateways, and communication channels</p>
            </div>
            {healthData && (
              <StatusBadge
                status={healthData.overallStatus === 'OPERATIONAL' ? 'ACTIVE' : 'DEGRADED'}
                label={healthData.overallStatus}
              />
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {healthData?.services.map((svc) => (
              <div key={svc.name} className="panel" style={{ border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span className="txt-muted" style={{ fontSize: 11 }}>{svc.category}</span>
                  <StatusBadge
                    status={svc.status === 'HEALTHY' || svc.status === 'CONNECTED' ? 'ACTIVE' : 'INACTIVE'}
                    label={svc.status}
                  />
                </div>
                <h4 style={{ fontSize: 14, fontWeight: 600 }}>{svc.name}</h4>
                {svc.latencyMs !== undefined && (
                  <p style={{ fontSize: 12, color: 'var(--success)', margin: '4px 0' }}>Latency: {svc.latencyMs} ms</p>
                )}
                {svc.provider && (
                  <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '4px 0' }}>Provider: {svc.provider}</p>
                )}
                <p className="txt-muted" style={{ fontSize: 12, marginTop: 8 }}>{svc.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PANEL 13: MY PREFERENCES */}
      {activeTab === 'preferences' && (
        <div className="panel space-y-6">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>Personal Interface Preferences</h3>
              <p className="txt-muted" style={{ fontSize: 13 }}>User-specific theme and density settings (does not affect other school staff)</p>
            </div>
            <button className="btn btn-primary" onClick={handleSavePreferences} disabled={busy}>
              <Save size={14} />
              Save My Preferences
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            <div className="form-group">
              <label>Theme Mode</label>
              <select className="input" value={themePref} onChange={(e) => setThemePref(e.target.value)}>
                <option value="LIGHT">Light Theme</option>
                <option value="DARK">Dark Theme</option>
                <option value="SYSTEM">Follow System Preference</option>
              </select>
            </div>
            <div className="form-group">
              <label>Layout Density</label>
              <select className="input" value={densityPref} onChange={(e) => setDensityPref(e.target.value)}>
                <option value="COMFORTABLE">Comfortable (Standard)</option>
                <option value="COMPACT">Compact (Higher Data Density)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CHANGE PASSWORD */}
      <Modal open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} title="Change Account Password">
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div className="form-group">
            <label>Current Password *</label>
            <input
              type="password"
              required
              className="input"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>New Password (Min 8 Characters) *</label>
            <input
              type="password"
              required
              minLength={8}
              className="input"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Confirm New Password *</label>
            <input
              type="password"
              required
              minLength={8}
              className="input"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setPasswordModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>Update Password</button>
          </div>
        </form>
      </Modal>

      {/* MODAL: LIVE PREVIEW TEMPLATE */}
      <Modal open={previewModalOpen} onClose={() => setPreviewModalOpen(false)} title="Template Live Preview">
        {previewData && (
          <div className="space-y-4">
            <div className="panel" style={{ border: '1px solid var(--border)', padding: 24, backgroundColor: 'var(--surface)', color: 'var(--text)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--border)', paddingBottom: 16, marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{previewData.school?.name}</h2>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>{previewData.school?.address}, {previewData.school?.city}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>{previewData.template?.name}</span>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>Sample Render</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16, fontSize: 13 }}>
                <div>
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>Student</p>
                  <p style={{ fontWeight: 600, margin: 0 }}>{previewData.student?.name} ({previewData.student?.admissionNo})</p>
                  <p style={{ margin: '2px 0 0' }}>Class: {previewData.student?.classroom}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>Guardian</p>
                  <p style={{ fontWeight: 600, margin: 0 }}>{previewData.guardian?.name}</p>
                  <p style={{ margin: '2px 0 0' }}>Phone: {previewData.guardian?.phone}</p>
                </div>
              </div>

              {previewData.template?.type === 'INVOICE' && previewData.invoice && (
                <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <table style={{ width: '100%', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                        <th style={{ padding: '6px 0' }}>Fee Head</th>
                        <th style={{ padding: '6px 0', textAlign: 'right' }}>Amount (INR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.invoice.items?.map((item: any, i: number) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '8px 0' }}>{item.description}</td>
                          <td style={{ padding: '8px 0', textAlign: 'right' }}>₹{item.amountRupees}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ textAlign: 'right', marginTop: 12, fontSize: 14, fontWeight: 700 }}>
                    Total: ₹{previewData.invoice.totalRupees}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setPreviewModalOpen(false)}>Close Preview</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
