'use client'

import React, { useState, useMemo } from 'react'
import {
  ShieldCheck, Search, Shield, KeyRound, CheckCircle2, Lock,
  Crown, GraduationCap, BookOpen, HeartHandshake, CircleDollarSign,
  Users, Bus, Heart, ChevronRight, X, Globe, Layers, AlertCircle, Sparkles
} from 'lucide-react'
import { Modal } from '@/components/preone/Modal'
import { SecurityShieldIllustration } from '@/components/preone'
import { DEFAULT_ROLES_MATRIX, RoleMatrixItem } from './types'

interface RolesDirectoryModalProps {
  open: boolean
  onClose: () => void
  rolesMatrix?: RoleMatrixItem[]
}

type RoleCategory = 'ALL' | 'WORKFORCE' | 'FAMILY'

interface PermissionDetail {
  label: string
  category: string
  categoryIcon: 'academics' | 'attendance' | 'finance' | 'workforce' | 'transport' | 'family' | 'system'
  description: string
}

const PERMISSION_DETAILS: Record<string, PermissionDetail> = {
  '*': {
    label: 'Full Superuser Administrative Access',
    category: 'Institutional Superuser',
    categoryIcon: 'system',
    description: 'Unrestricted read, write, configure, and delete across all campuses, finances, and system settings.',
  },
  'students:read': {
    label: 'Student Profiles & Rosters',
    category: 'Academics & Care',
    categoryIcon: 'academics',
    description: 'View student biodata, emergency contacts, class allocations, and guardian records.',
  },
  'students:write': {
    label: 'Create & Update Student Records',
    category: 'Academics & Care',
    categoryIcon: 'academics',
    description: 'Register student biodata, update medical information, and link family guardians.',
  },
  'admissions:approve': {
    label: 'Approve Student Admissions',
    category: 'Branch Governance',
    categoryIcon: 'academics',
    description: 'Authorize registration applications, assign roll numbers, and confirm enrollment.',
  },
  'attendance:approve': {
    label: 'Authorize Campus Attendance',
    category: 'Campus Operations',
    categoryIcon: 'attendance',
    description: 'Approve daily branch attendance logs, sign off headcounts, and lock attendance sheets.',
  },
  'attendance:mark': {
    label: 'Mark Classroom Attendance',
    category: 'Classroom Operations',
    categoryIcon: 'attendance',
    description: 'Record morning attendance, late arrivals, and absence notes for assigned classroom.',
  },
  'attendance:read': {
    label: 'View Attendance Records',
    category: 'Campus Operations',
    categoryIcon: 'attendance',
    description: 'Inspect check-in/out timestamps and monthly student attendance summaries.',
  },
  'academics:approve': {
    label: 'Approve Curriculums & Plans',
    category: 'Branch Governance',
    categoryIcon: 'academics',
    description: 'Sign off teacher lesson plans, milestones, and term development rubrics.',
  },
  'academics:read': {
    label: 'View Learning Milestones',
    category: 'Academics & Care',
    categoryIcon: 'academics',
    description: 'Access early childhood milestones, observation rubrics, and activity guidelines.',
  },
  'timeline:read': {
    label: 'Daily Activity Timeline',
    category: 'Classroom Care',
    categoryIcon: 'academics',
    description: 'Record and track daily naps, meals, diaper changes, and learning moments.',
  },
  'reports:read': {
    label: 'View Student Progress Reports',
    category: 'Academics & Care',
    categoryIcon: 'academics',
    description: 'Inspect term developmental progress, teacher observation notes, and evaluations.',
  },
  'reports:export': {
    label: 'Export Analytical Reports',
    category: 'Finance & Operations',
    categoryIcon: 'finance',
    description: 'Generate and download PDF / CSV exports of finances, admissions, and ledgers.',
  },
  'finance:read': {
    label: 'View Fee Schedules & Ledgers',
    category: 'Finance & Invoicing',
    categoryIcon: 'finance',
    description: 'Inspect fee structures, student invoice statuses, overdue bills, and receipt ledgers.',
  },
  'finance:write': {
    label: 'Issue Invoices & Record Receipts',
    category: 'Finance & Invoicing',
    categoryIcon: 'finance',
    description: 'Create student term invoices, apply approved discounts, and record offline payments.',
  },
  'payroll:process': {
    label: 'Process Staff Payroll',
    category: 'Finance & Workforce',
    categoryIcon: 'finance',
    description: 'Calculate monthly wages, deductions, allowances, and generate staff payslips.',
  },
  'users:read': {
    label: 'Browse Staff Directory',
    category: 'Workforce & HR',
    categoryIcon: 'workforce',
    description: 'View workforce employee profiles, contact details, designations, and branch links.',
  },
  'users:write': {
    label: 'Manage Workforce Accounts',
    category: 'Workforce & HR',
    categoryIcon: 'workforce',
    description: 'Provision staff user credentials, assign canonical RBAC roles, and edit profiles.',
  },
  'operations:read': {
    label: 'View Campus Schedules',
    category: 'Campus Operations',
    categoryIcon: 'attendance',
    description: 'Inspect daily branch routines, meal times, play schedules, and classroom events.',
  },
  'inventory:request': {
    label: 'Submit Supplies Requisitions',
    category: 'Campus Operations',
    categoryIcon: 'attendance',
    description: 'Request classroom stationery, diapers, cleaning items, and learning materials.',
  },
  'hr:self': {
    label: 'Personal Staff Self-Service',
    category: 'Workforce & HR',
    categoryIcon: 'workforce',
    description: 'Access personal attendance logs, submit leave applications, and view payslips.',
  },
  'hr:read': {
    label: 'View Staff HR & Leave Records',
    category: 'Workforce & HR',
    categoryIcon: 'workforce',
    description: 'Review staff employment documents, contracts, attendance history, and leave balances.',
  },
  'hr:write': {
    label: 'Update Staff Employment Records',
    category: 'Workforce & HR',
    categoryIcon: 'workforce',
    description: 'Edit employee contracts, emergency contacts, and compliance onboarding files.',
  },
  'hr:approve': {
    label: 'Approve Staff Leave Requests',
    category: 'Workforce & HR',
    categoryIcon: 'workforce',
    description: 'Authorize or decline teacher and support staff vacation or medical leave requests.',
  },
  'transport:read': {
    label: 'View Transit Routes & Schedules',
    category: 'Transport & Safety',
    categoryIcon: 'transport',
    description: 'Inspect school bus routes, designated pickup points, stops, and schedules.',
  },
  'transport:trip': {
    label: 'Start & End Transit Trips',
    category: 'Transport & Safety',
    categoryIcon: 'transport',
    description: 'Initiate live route tracking and broadcast departure/arrival statuses to parents.',
  },
  'transport:board': {
    label: 'Verify Student Boarding',
    category: 'Transport & Safety',
    categoryIcon: 'transport',
    description: 'Confirm and timestamp each child entering the school transit vehicle.',
  },
  'transport:drop': {
    label: 'Confirm Safe Drop-Off',
    category: 'Transport & Safety',
    categoryIcon: 'transport',
    description: 'Confirm and timestamp safe drop-off to verified guardian at home or bus stop.',
  },
  'transport:incident': {
    label: 'Broadcast Transit Alerts',
    category: 'Transport & Safety',
    categoryIcon: 'transport',
    description: 'Issue urgent route delay notifications, road incident alerts, or safety updates.',
  },
  'communication:read': {
    label: 'Receive Broadcast Announcements',
    category: 'Family Communication',
    categoryIcon: 'family',
    description: 'Receive school circulars, holiday announcements, and emergency notices.',
  },
  'students:read-linked': {
    label: 'View Linked Ward Profile Only',
    category: 'Family Care',
    categoryIcon: 'family',
    description: 'Strictly isolated access to own authorized child details and photos.',
  },
  'attendance:read-linked': {
    label: 'View Ward Daily Attendance',
    category: 'Family Care',
    categoryIcon: 'family',
    description: 'Live morning check-in and evening checkout timestamps for own child.',
  },
  'diary:read-linked': {
    label: 'View Child Daily Activity Diary',
    category: 'Family Care',
    categoryIcon: 'family',
    description: 'Read meal intakes, nap durations, learning activities, and teacher observation notes.',
  },
  'milestones:read-linked': {
    label: 'View Developmental Milestones',
    category: 'Family Care',
    categoryIcon: 'family',
    description: 'Track sensory, physical, social, and early cognitive milestone badges.',
  },
  'documents:read-linked': {
    label: 'View Child Documents & Records',
    category: 'Family Care',
    categoryIcon: 'family',
    description: 'Access immunization records, birth certificates, and academic reports.',
  },
  'pickup:read-linked': {
    label: 'View Authorized Pickup Pass',
    category: 'Gate Security',
    categoryIcon: 'family',
    description: 'Display digital pickup authorization badge for preschool gate clearance.',
  },
  'pickup:verify-linked': {
    label: 'Gate Pickup PIN Verification',
    category: 'Gate Security',
    categoryIcon: 'family',
    description: 'Present secure 4-digit verification PIN to gate security for student checkout.',
  },
}

interface RoleConfig {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  title: string
  badgeText: string
  badgeCls: string
  category: 'WORKFORCE' | 'FAMILY'
  categoryLabel: string
  tierLabel: string
  scope: string
  boundary: string
  tagline: string
  accentColor: string
  iconBg: string
  iconColor: string
  policyTitle: string
  policyText: string
  policyType: 'security' | 'info' | 'warning' | 'success'
}

const ROLE_CONFIGS: Record<string, RoleConfig> = {
  OWNER: {
    icon: Crown,
    title: 'Institution Owner',
    badgeText: 'Owner / Trust Head',
    badgeCls: 'b-purple',
    category: 'WORKFORCE',
    categoryLabel: 'Preschool Leadership',
    tierLabel: 'Tier 0 • Full Superuser',
    scope: 'Institution / Multi-Branch',
    boundary: 'All Campuses & Global Ledgers',
    tagline: 'Full institutional control across all campuses, finances, configurations, and user accounts',
    accentColor: '#7C3AED',
    iconBg: '#EDE9FE',
    iconColor: '#6D28D9',
    policyTitle: 'Institutional Superuser & Immutable Audit Trail',
    policyText: 'The Owner holds root authority across all preschool branches, accounts, and financial ledgers. All administrative operations are permanently recorded to the immutable audit trail.',
    policyType: 'security',
  },
  PRINCIPAL: {
    icon: GraduationCap,
    title: 'Campus Principal',
    badgeText: 'Principal / Center Head',
    badgeCls: 'b-blue',
    category: 'WORKFORCE',
    categoryLabel: 'Preschool Leadership',
    tierLabel: 'Tier 1 • Branch Admin',
    scope: 'Campus / Branch',
    boundary: 'Assigned Campus Branch Only',
    tagline: 'Complete academic, admissions, operational, attendance, and branch staff management',
    accentColor: '#0284C7',
    iconBg: '#E0F2FE',
    iconColor: '#0369A1',
    policyTitle: 'Campus Administrative Authority',
    policyText: 'Principals hold complete operational authority strictly within their assigned preschool branch. Cross-campus modifications or root institution billing changes require Owner authorization.',
    policyType: 'info',
  },
  TEACHER: {
    icon: BookOpen,
    title: 'Classroom Teacher',
    badgeText: 'Teacher / Educator',
    badgeCls: 'b-success',
    category: 'WORKFORCE',
    categoryLabel: 'Preschool Workforce',
    tierLabel: 'Tier 2 • Classroom Educator',
    scope: 'Assigned Classroom & Students',
    boundary: 'Classroom Roster Isolation',
    tagline: 'Assigned classroom management, student attendance, daily activity timeline, and learning observations',
    accentColor: '#16A34A',
    iconBg: '#DCFCE7',
    iconColor: '#15803D',
    policyTitle: 'Classroom Privacy & Daily Timeline Scope',
    policyText: 'Teachers are strictly bounded to students enrolled in their assigned classrooms. Student academic observations, attendance records, and meal/nap timelines are managed here.',
    policyType: 'success',
  },
  DRIVER: {
    icon: Bus,
    title: 'Transit Driver',
    badgeText: 'Driver / Transport',
    badgeCls: 'b-orange',
    category: 'WORKFORCE',
    categoryLabel: 'Preschool Workforce',
    tierLabel: 'Tier 2 • Transit Lead',
    scope: 'Assigned Transport Routes',
    boundary: 'Route Vehicle & Passenger Roster',
    tagline: 'Student transit runs, vehicle boarding/deboarding verification, and transit route status',
    accentColor: '#EA580C',
    iconBg: '#FFEDD5',
    iconColor: '#C2410C',
    policyTitle: 'Transit Safety & Passenger Boarding Boundary',
    policyText: 'Drivers can start transit runs, verify student boarding/drop-off, and broadcast incident alerts. Student gradebooks, tuition fees, and administrative settings are completely restricted.',
    policyType: 'warning',
  },
  PARENT: {
    icon: Heart,
    title: 'Parent (Legal)',
    badgeText: 'Parent',
    badgeCls: 'b-primary',
    category: 'FAMILY',
    categoryLabel: 'Family & Caregivers',
    tierLabel: 'Client • Family Portal',
    scope: 'Enrolled Children Only',
    boundary: 'Direct Children Strict Isolation',
    tagline: 'Family account with child daily timeline, notices, fee payments, and communication (Max 2 per student)',
    accentColor: '#DB2777',
    iconBg: '#FCE7F3',
    iconColor: '#BE185D',
    policyTitle: 'Enrolled Child Isolation & Max 2 Parents Policy',
    policyText: 'Parent accounts are strictly restricted to legal parents of enrolled children. PreOne enforces a hard limit of max 2 Parent accounts per student. Other family members must register as Guardians.',
    policyType: 'security',
  },
  COORDINATOR: {
    icon: GraduationCap,
    title: 'Academic Coordinator',
    badgeText: 'Academic Coordinator',
    badgeCls: 'b-cyan',
    category: 'WORKFORCE',
    categoryLabel: 'Preschool Leadership',
    tierLabel: 'Tier 1.5 • Curriculum Lead',
    scope: 'Academic Programs & Classrooms',
    boundary: 'Curriculum & Teaching Staff Scope',
    tagline: 'Pedagogical supervisor coordinating classroom activities, lesson plans, and teaching staff',
    accentColor: '#0891B2',
    iconBg: '#CFFAFE',
    iconColor: '#0E7490',
    policyTitle: 'Pedagogical & Classroom Supervision',
    policyText: 'Coordinators oversee multi-classroom curriculums, lesson plans, educational milestones, and educator performance.',
    policyType: 'info',
  },
  STAFF: {
    icon: Users,
    title: 'Operations Staff',
    badgeText: 'General Staff',
    badgeCls: 'b-indigo',
    category: 'WORKFORCE',
    categoryLabel: 'Preschool Workforce',
    tierLabel: 'Tier 2 • Operations Staff',
    scope: 'Campus / Operations',
    boundary: 'Operational Support & Workforce',
    tagline: 'General administrative support, human resources assistance, and operations',
    accentColor: '#4F46E5',
    iconBg: '#E0E7FF',
    iconColor: '#4338CA',
    policyTitle: 'Operations & Administrative Assistance',
    policyText: 'Staff members manage daily center administration, material requests, and general workforce tasks.',
    policyType: 'info',
  },
  ACCOUNTS: {
    icon: CircleDollarSign,
    title: 'Accounts Officer',
    badgeText: 'Accounts & Finance',
    badgeCls: 'b-warning',
    category: 'WORKFORCE',
    categoryLabel: 'Preschool Workforce',
    tierLabel: 'Tier 2 • Finance Officer',
    scope: 'Campus / Branch Finance',
    boundary: 'Financial Ledgers & Billing Only',
    tagline: 'Fee schedules, student invoicing, offline/online collections, receipts, and financial records',
    accentColor: '#D97706',
    iconBg: '#FEF3C7',
    iconColor: '#B45309',
    policyTitle: 'Financial Governance Scope',
    policyText: 'Accounts officers possess authorization over fee collections, invoicing, receipts, and vendor ledgers.',
    policyType: 'warning',
  },
  RECEPTIONIST: {
    icon: Globe,
    title: 'Front Desk Receptionist',
    badgeText: 'Front Desk / Reception',
    badgeCls: 'b-pink',
    category: 'WORKFORCE',
    categoryLabel: 'Preschool Workforce',
    tierLabel: 'Tier 2 • Front Desk Lead',
    scope: 'Front Office & Visitor Desk',
    boundary: 'Inquiries & Front Desk Logs',
    tagline: 'Front-desk admissions inquiries, phone calls, walk-in logs, and daily communications',
    accentColor: '#DB2777',
    iconBg: '#FCE7F3',
    iconColor: '#BE185D',
    policyTitle: 'Front Office Inquiries & Visitor Clearance',
    policyText: 'Receptionists manage inquiries, admission visits, parent phone communications, and campus attendance overview.',
    policyType: 'info',
  },
  ATTENDANT: {
    icon: HeartHandshake,
    title: 'Attendant / Helper',
    badgeText: 'Caregiver / Attendant',
    badgeCls: 'b-teal',
    category: 'WORKFORCE',
    categoryLabel: 'Preschool Workforce',
    tierLabel: 'Tier 2 • Support Caretaker',
    scope: 'Classroom & Childcare Support',
    boundary: 'Childcare & Hygiene Logistics',
    tagline: 'Classroom caretaking, student hygiene assistance, meal monitoring, and child welfare support',
    accentColor: '#0D9488',
    iconBg: '#CCFBF1',
    iconColor: '#0F766E',
    policyTitle: 'Child Welfare & Classroom Support Scope',
    policyText: 'Attendants assist teachers with student safety, hydration, hygiene, and classroom logistics.',
    policyType: 'info',
  },
  GUARDIAN: {
    icon: ShieldCheck,
    title: 'Authorized Guardian',
    badgeText: 'Guardian',
    badgeCls: 'b-amber',
    category: 'FAMILY',
    categoryLabel: 'Family & Caregivers',
    tierLabel: 'Client • Authorized Caregiver',
    scope: 'Linked Children Only (Relationship-Scoped)',
    boundary: 'Relationship-Scoped Clearance',
    tagline: 'Authorized caregiver account with relationship-scoped child access (pickup authorization, attendance, diary)',
    accentColor: '#0284C7',
    iconBg: '#E0F2FE',
    iconColor: '#0369A1',
    policyTitle: 'Relationship-Scoped Security Guarantee',
    policyText: 'Guardians (grandparents, uncles, aunts, trusted drivers, nannies) have verified pickup PIN clearance and daily diary visibility. Tuition ledgers, fee bills, and school settings remain completely inaccessible.',
    policyType: 'security',
  },
}

export function RolesDirectoryModal({
  open,
  onClose,
  rolesMatrix = DEFAULT_ROLES_MATRIX,
}: RolesDirectoryModalProps) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<RoleCategory>('ALL')
  const [selectedRole, setSelectedRole] = useState<string>('OWNER')

  // Filter roles by category tab & search keyword
  const filteredRoles = useMemo(() => {
    return rolesMatrix.filter((item) => {
      const config = ROLE_CONFIGS[item.role]
      const matchesCategory =
        activeCategory === 'ALL' ||
        (activeCategory === 'WORKFORCE' && config?.category === 'WORKFORCE') ||
        (activeCategory === 'FAMILY' && config?.category === 'FAMILY')

      if (!matchesCategory) return false

      if (!search.trim()) return true

      const q = search.toLowerCase()
      const inLabel = item.label.toLowerCase().includes(q)
      const inRole = item.role.toLowerCase().includes(q)
      const inDesc = item.description.toLowerCase().includes(q)
      const inScope = item.scope.toLowerCase().includes(q)
      const inConfigTitle = config?.title.toLowerCase().includes(q) || false
      const inPermissions = item.permissions.some((p) => {
        const detail = PERMISSION_DETAILS[p]
        return p.toLowerCase().includes(q) || (detail && detail.label.toLowerCase().includes(q))
      })

      return inLabel || inRole || inDesc || inScope || inConfigTitle || inPermissions
    })
  }, [rolesMatrix, activeCategory, search])

  // Active role details
  const activeRoleDetail = useMemo(() => {
    const found = rolesMatrix.find((r) => r.role === selectedRole)
    if (found && filteredRoles.some((r) => r.role === found.role)) return found
    return filteredRoles[0] || rolesMatrix[0]
  }, [rolesMatrix, selectedRole, filteredRoles])

  const activeConfig = activeRoleDetail ? ROLE_CONFIGS[activeRoleDetail.role] : null
  const RoleIcon = activeConfig?.icon || Shield

  // Workforce count & Family count
  const workforceCount = rolesMatrix.filter((r) => ROLE_CONFIGS[r.role]?.category === 'WORKFORCE').length
  const familyCount = rolesMatrix.filter((r) => ROLE_CONFIGS[r.role]?.category === 'FAMILY').length

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Roles Directory & Permissions Matrix"
      subtitle="Canonical 9 RBAC roles defined in PreOne Enterprise Preschool OS"
      icon={<ShieldCheck className="w-5 h-5 text-purple-600" />}
      iconClass="ic-purple"
      maxWidth="min(1040px, 100vw - 32px)"
      className="modal-xl"
      wide
      footer={
        <div className="flex items-center justify-between w-full text-xs">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <Lock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span className="hidden sm:inline">
              PreOne RBAC security policies are enforced on every server API mutation and page route.
            </span>
            <span className="sm:hidden">Enforced server-side via RBAC.</span>
          </div>
          <button type="button" className="btn btn-secondary text-xs px-4 py-1.5 font-medium" onClick={onClose}>
            Close Directory
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Top Control Bar: Category Segments + Quick Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-1 border-b border-gray-100 dark:border-gray-800/80">
          {/* Category Tabs */}
          <div className="seg text-xs shrink-0" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === 'ALL'}
              onClick={() => setActiveCategory('ALL')}
              className={`flex items-center gap-1.5 ${activeCategory === 'ALL' ? 'on' : ''}`}
            >
              <span>All Roles</span>
              <span className="text-[10px] opacity-75 font-semibold">({rolesMatrix.length})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === 'WORKFORCE'}
              onClick={() => setActiveCategory('WORKFORCE')}
              className={`flex items-center gap-1.5 ${activeCategory === 'WORKFORCE' ? 'on' : ''}`}
            >
              <span>Preschool Staff</span>
              <span className="text-[10px] opacity-75 font-semibold">({workforceCount})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === 'FAMILY'}
              onClick={() => setActiveCategory('FAMILY')}
              className={`flex items-center gap-1.5 ${activeCategory === 'FAMILY' ? 'on' : ''}`}
            >
              <span>Family & Caregivers</span>
              <span className="text-[10px] opacity-75 font-semibold">({familyCount})</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 sm:max-w-xs input-icon-wrap">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              className="input w-full text-xs py-1.5"
              style={{ paddingLeft: 36, paddingRight: search ? 30 : 12 }}
              placeholder="Search roles, scopes, permissions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 2-Pane Split: Roles Scannable List (Left) & Role Deep-Dive Policy (Right) */}
        <div className="roles-matrix-grid">
          {/* Left Column: Role Cards List */}
          <div className="role-list-pane">
            {filteredRoles.length > 0 ? (
              filteredRoles.map((item) => {
                const isSelected = activeRoleDetail?.role === item.role
                const config = ROLE_CONFIGS[item.role]
                const ItemIcon = config?.icon || Shield

                return (
                  <button
                    key={item.role}
                    type="button"
                    onClick={() => setSelectedRole(item.role)}
                    className={`role-card-item ${isSelected ? 'selected' : ''}`}
                  >
                    {/* Role Icon */}
                    <div
                      className="role-avatar-box"
                      style={{
                        background: config ? config.iconBg : 'var(--bg-muted)',
                        color: config ? config.iconColor : 'var(--text-secondary)',
                      }}
                    >
                      <ItemIcon style={{ width: 18, height: 18 }} />
                    </div>

                    {/* Role Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                          {config?.title || item.label}
                        </span>
                        <span className={`badge ${config?.badgeCls || 'b-neutral'} text-[10px] font-mono shrink-0`}>
                          {item.role}
                        </span>
                      </div>

                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.35 }} className="line-clamp-1">
                        {item.description}
                      </p>

                      <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--primary)', marginTop: 4 }}>
                        {item.scope}
                      </div>
                    </div>

                    {/* Chevron on Selected */}
                    {isSelected && (
                      <ChevronRight style={{ width: 16, height: 16, color: 'var(--primary)', alignSelf: 'center', flexShrink: 0 }} />
                    )}
                  </button>
                )
              })
            ) : (
              <div className="p-8 text-center bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                <Search className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">No matching roles</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Try clearing your search query or switching tabs.
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Selected Role Deep-Dive Policy */}
          <div className="role-details-pane">
            {activeRoleDetail && activeConfig ? (
              <>
                {/* 1. Hero Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, paddingBottom: 14, borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: activeConfig.iconBg,
                        color: activeConfig.iconColor,
                        flexShrink: 0,
                        boxShadow: 'var(--shadow-xs)',
                      }}
                    >
                      <RoleIcon style={{ width: 22, height: 22 }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                        <h4 style={{ fontSize: 16.5, fontWeight: 800, color: 'var(--text-primary)' }}>
                          {activeConfig.title}
                        </h4>
                        <span className={`badge ${activeConfig.badgeCls} font-mono text-[11px] font-semibold`}>
                          {activeRoleDetail.role}
                        </span>
                        <span className="badge b-neutral text-[10px]">
                          {activeConfig.tierLabel}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        {activeRoleDetail.description}
                      </p>
                    </div>
                  </div>
                  <SecurityShieldIllustration size={46} className="shrink-0 hidden lg:block opacity-80" />
                </div>

                {/* 2. Key Attributes Grid (4 KPI Tiles) */}
                <div className="role-kpi-grid">
                  {/* Scope */}
                  <div className="role-kpi-card">
                    <div className="role-kpi-label">
                      <Globe style={{ width: 13, height: 13, color: 'var(--primary)' }} /> Access Scope
                    </div>
                    <div className="role-kpi-val">{activeRoleDetail.scope}</div>
                  </div>

                  {/* Category */}
                  <div className="role-kpi-card">
                    <div className="role-kpi-label">
                      <Users style={{ width: 13, height: 13, color: '#0284C7' }} /> Account Category
                    </div>
                    <div className="role-kpi-val">{activeConfig.categoryLabel}</div>
                  </div>

                  {/* Boundary */}
                  <div className="role-kpi-card">
                    <div className="role-kpi-label">
                      <Layers style={{ width: 13, height: 13, color: '#16A34A' }} /> Data Boundary
                    </div>
                    <div className="role-kpi-val">{activeConfig.boundary}</div>
                  </div>

                  {/* Governance */}
                  <div className="role-kpi-card">
                    <div className="role-kpi-label">
                      <Shield style={{ width: 13, height: 13, color: '#D97706' }} /> Role Tier
                    </div>
                    <div className="role-kpi-val">{activeConfig.tierLabel}</div>
                  </div>
                </div>

                {/* 3. Authorized Capabilities & Permissions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
                      <KeyRound style={{ width: 14, height: 14, color: 'var(--primary)' }} />
                      Authorized Capabilities & Permissions
                    </div>
                    <span className="badge b-neutral text-[10px] font-mono">
                      {activeRoleDetail.permissions[0] === '*'
                        ? 'Unlimited (*)'
                        : `${activeRoleDetail.permissions.length} Capabilities`}
                    </span>
                  </div>

                  {/* Special Superuser View for OWNER */}
                  {activeRoleDetail.role === 'OWNER' ? (
                    <div
                      style={{
                        padding: 16,
                        borderRadius: 12,
                        border: '1px solid rgba(124, 58, 237, 0.25)',
                        background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(79, 70, 229, 0.04) 100%)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Sparkles style={{ width: 16, height: 16, color: 'var(--primary)' }} />
                        <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--primary)' }}>
                          Full Institutional Superuser Access (*)
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                        Unrestricted read, write, configure, and delete capabilities across all multi-branch campuses, financial ledgers, audit logs, staff rosters, and security policies.
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 4 }}>
                        <span className="badge b-primary text-[10px]">🏛️ Multi-Branch Governance</span>
                        <span className="badge b-success text-[10px]">💰 Fee Schedules & Ledgers</span>
                        <span className="badge b-purple text-[10px]">🔐 User Provisioning & RBAC Config</span>
                        <span className="badge b-neutral text-[10px]">📜 Immutable Audit Trail</span>
                        <span className="badge b-blue text-[10px]">🎓 Academic & Admissions Authority</span>
                      </div>
                    </div>
                  ) : (
                    /* Human-Readable Capability Badges */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {activeRoleDetail.permissions.map((p) => {
                        const detail = PERMISSION_DETAILS[p] || {
                          label: p,
                          category: 'General',
                          description: `Authorized system capability: ${p}`,
                        }

                        return (
                          <div key={p} className="role-perm-card">
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
                              <CheckCircle2 style={{ width: 14, height: 14, color: '#16A34A', flexShrink: 0, marginTop: 2 }} />
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>
                                    {detail.label}
                                  </span>
                                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                    • {detail.category}
                                  </span>
                                </div>
                                <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.35, marginTop: 1 }}>
                                  {detail.description}
                                </p>
                              </div>
                            </div>
                            <span className="role-perm-code">{p}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* 4. Security Policy & Strict Guarantees Banner */}
                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid',
                    borderColor:
                      activeConfig.policyType === 'security'
                        ? 'rgba(124, 58, 237, 0.3)'
                        : activeConfig.policyType === 'warning'
                        ? 'rgba(217, 119, 6, 0.3)'
                        : 'rgba(2, 132, 199, 0.3)',
                    background:
                      activeConfig.policyType === 'security'
                        ? 'rgba(124, 58, 237, 0.06)'
                        : activeConfig.policyType === 'warning'
                        ? 'rgba(217, 119, 6, 0.06)'
                        : 'rgba(2, 132, 199, 0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12, color: 'var(--text-primary)' }}>
                    <Lock style={{ width: 14, height: 14, color: activeConfig.iconColor }} />
                    <span>{activeConfig.policyTitle}</span>
                  </div>
                  <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.45, paddingLeft: 20 }}>
                    {activeConfig.policyText}
                  </p>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center my-auto">
                <SecurityShieldIllustration size={72} className="mb-3 opacity-60" />
                <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">No role selected</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-xs">
                  Choose a canonical role from the left pane to view its scope, boundary, and permissions.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
