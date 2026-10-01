'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Plus, Phone, UserCheck, UserX, Clock3, FileCheck2, ClipboardList,
  ThumbsUp, ChevronRight, Calendar, Building, Search, Eye, AlertCircle,
  FileText, CheckCircle2, XCircle, Clock, Users, ArrowRight, Check,
  Send, UserPlus, HeartHandshake, AlertTriangle, RefreshCw, ChevronDown,
  Download, Printer, DollarSign, History, ShieldAlert, Award, X,
  MessageCircle, FileSignature, GraduationCap, BarChart3, Filter,
  ArrowUpRight, ArrowDownRight, Layers, Sparkles, User, Info, CheckCircle
} from 'lucide-react'
import { PageHead, Segmented, EmptyState, StatusBadge, StatusPill, StudentIdentityChip, FamilyIdentityChip, Skeleton } from '@/components/preone/ui'
import { DataTable, RowAction } from '@/components/preone/DataTable'
import { Modal } from '@/components/preone/Modal'
import { DatePicker, MaskedInput, EnterNav, Wizard } from '@/components/preone/forms'
import { useToast } from '@/components/preone/Toast'
import { FunnelChart } from '@/components/preone/Chart'
import { fmtDate, enumLabel } from '@/lib/format'

// ── Master Types ─────────────────────────────────────────────────────────────
interface AcademicSessionOption {
  id: string
  name: string
  isCurrent: boolean
}

interface BranchOption {
  id: string
  name: string
  isMain: boolean
}

interface ProgramOption {
  id: string
  code: string
  name: string
  programType: string
  ageMinMonths: number | null
  ageMaxMonths: number | null
  capacity: number
}

interface ClassroomOption {
  id: string
  name: string
  code: string
  programType: string
  capacity: number
  _count?: { students: number }
}

interface Enquiry {
  id: string
  leadNumber: string
  parentName: string
  phone: string
  email: string | null
  childName: string | null
  childDob: string | null
  interestedProgram: string | null
  source: string
  status: string
  notes: string | null
  nextFollowUpAt: string | null
  convertedApplicationId: string | null
  createdAt: string
  updatedAt?: string
}

interface ApplicationListItem {
  id: string
  applicationNumber: string
  childName: string
  childFirstName: string
  childLastName?: string | null
  childDob: string
  childGender: string
  programType: string
  parentName: string
  parentPhone: string
  parentEmail: string | null
  status: string
  submittedAt: string
  verifiedAt: string | null
  approvedAt: string | null
  studentId: string | null
  classroomId: string | null
  leadNumber: string | null
  leadId: string | null
  offers?: { id: string; offerNumber: string; status: string; terms?: string | null }[]
  documents: {
    id: string
    docType: string
    fileName: string
    status: string
    verified: boolean
    remarks: string | null
    rejectionReason: string | null
  }[]
}

interface ReviewData {
  application: {
    id: string
    applicationNumber: string
    childFirstName: string
    childLastName?: string | null
    childDob: string
    childGender: string
    programType: string
    parentName: string
    parentPhone: string
    parentEmail?: string | null
    previousSchool?: string | null
    status: string
    submittedAt?: string
    verifiedAt?: string | null
    approvedAt?: string | null
    rejectedAt?: string | null
    rejectionReason?: string | null
    notes?: string | null
    studentId?: string | null
    classroomId?: string | null
    leadId?: string | null
    lead?: { leadNumber: string; source: string; notes?: string } | null
    academicSession?: { name: string } | null
    documents: {
      id: string
      docType: string
      fileName: string
      status: string
      verified: boolean
      uploadedAt: string
      verifiedAt?: string | null
      remarks?: string | null
      rejectionReason?: string | null
    }[]
    offers: {
      id: string
      offerNumber: string
      childName: string
      parentName: string
      programType: string
      feeTotalCents: number
      terms?: string | null
      status: string
      validFrom: string
      validUntil: string
      issuedAt?: string | null
      acceptedAt?: string | null
      declinedAt?: string | null
      acceptNote?: string | null
      declineReason?: string | null
    }[]
  }
  requirements: {
    ageRequirement: { eligible: boolean; ageMonths: number; minMonths?: number | null; maxMonths?: number | null; reason?: string }
    documentsCheck: { verified: number; rejected: number; total: number; isComplete: boolean; missing: string[] }
    capacityCheck: { hasAvailableCapacity: boolean; sections: { id: string; name: string; capacity: number; enrolled: number; available: number; hasSeat: boolean }[] }
    feePlanQuote: { id: string; name: string; totalAnnualRupees: number; installmentCount: number; items: { head: string; label: string; amountRupees: number }[] } | null
    siblingConcession: {
      hasSibling: boolean
      existingChildren: { studentId: string; admissionNo: string; name: string; classroom: string; status: string }[]
      applicableDiscountPercent: number
    }
    isReadyForApproval: boolean
  }
  offers: any[]
  timeline: { id: string; action: string; summary: string; actorName?: string | null; actorRole?: string | null; createdAt: string }[]
}

// ── 7 Primary Business Workspaces ───────────────────────────────────────────
const NAV_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'enquiries', label: 'Enquiries' },
  { key: 'followups', label: 'Follow-ups & Visits' },
  { key: 'applications', label: 'Applications' },
  { key: 'waitlist', label: 'Waiting List' },
  { key: 'admissions', label: 'Classroom Placements' },
  { key: 'reports', label: 'Reports' },
]

// ── Canonical 12-Stage Preschool Admission Journey ───────────────────────────
const ADMISSION_JOURNEY_STAGES = [
  { step: 1, short: '01', key: 'ENQUIRY', label: 'New Enquiry', desc: 'Parent first contacts school (walk-in, phone, web)', icon: UserPlus, targetTab: 'enquiries' },
  { step: 2, short: '02', key: 'CONVERSATION', label: 'Parent Conversation', desc: 'Understand program, batch, daycare, transport & fees', icon: Phone, targetTab: 'followups' },
  { step: 3, short: '03', key: 'VISIT', label: 'School Visit', desc: 'Schedule and complete guided campus walkthrough', icon: Calendar, targetTab: 'followups' },
  { step: 4, short: '04', key: 'PROGRAM_FIT', label: 'Program Fit', desc: 'DOB → Age & availability check (Eligible / Under / Over Age)', icon: CheckCircle2, targetTab: 'enquiries' },
  { step: 5, short: '05', key: 'APPLICATION', label: 'Application', desc: 'Admission form, family info & medical details submitted', icon: ClipboardList, targetTab: 'applications' },
  { step: 6, short: '06', key: 'DOCUMENTS', label: 'Documents', desc: 'Birth certificate, parent ID, address & health records', icon: FileCheck2, targetTab: 'applications' },
  { step: 7, short: '07', key: 'MEETING', label: 'Child & Parent Meeting', desc: 'Parent expectations and basic child interaction notes', icon: HeartHandshake, targetTab: 'applications' },
  { step: 8, short: '08', key: 'DECISION', label: 'Admission Decision', desc: 'Principal review: Approved, Waitlisted, or Closed', icon: Award, targetTab: 'applications' },
  { step: 9, short: '09', key: 'OFFER', label: 'Admission Offer', desc: 'Generate & send admission offer with fee breakdown quote', icon: Send, targetTab: 'applications' },
  { step: 10, short: '10', key: 'PARENT_ACCEPTANCE', label: 'Parent Acceptance', desc: 'Parent reviews and accepts offer terms & fees', icon: ThumbsUp, targetTab: 'applications' },
  { step: 11, short: '11', key: 'CLASSROOM_ALLOCATION', label: 'Classroom Placement', desc: 'Branch, division, seat capacity & batch allocation', icon: Building, targetTab: 'applications' },
  { step: 12, short: '12', key: 'FINAL_ENROLLMENT', label: 'Complete Admission', desc: 'Student + guardian + classroom + initial fee invoice active', icon: GraduationCap, targetTab: 'admissions' },
]

/** Calculate age in months from a date-of-birth string */
function calculateAgeMonths(dobString: string): number | null {
  if (!dobString) return null
  const dob = new Date(dobString)
  if (isNaN(dob.getTime())) return null
  const now = new Date()
  const years = now.getFullYear() - dob.getFullYear()
  const months = now.getMonth() - dob.getMonth()
  const days = now.getDate() - dob.getDate()
  let totalMonths = years * 12 + months
  if (days < 0) totalMonths -= 1
  return Math.max(0, totalMonths)
}

/** Next Action Engine: Computes canonical business next action, stage, and operational status answering the 4 questions */
function computeNextAction(app: ApplicationListItem | ReviewData['application'], reqs?: any): {
  whereAreWe: string
  whatHappened: string
  whatNeedsToHappen: string
  whatShouldIClick: string
  primaryActionType:
    | 'START_FINAL_REVIEW'
    | 'CONFIRM_CREATE_ADMISSION'
    | 'VERIFY_DOCUMENTS'
    | 'CREATE_FEE_OFFER'
    | 'REVIEW_APPLICATION'
    | 'VIEW_STUDENT'
    | 'WAIT_FOR_PARENT'
    | 'NONE'
  targetTab?: string
  action: string
  actor: string
  stage: string
  status: 'ACTION REQUIRED' | 'IN PROGRESS' | 'WAITING FOR PARENT' | 'WAITING FOR STAFF' | 'BLOCKED' | 'COMPLETED' | 'NOT PROCEEDING'
  isBlocked?: boolean
  blockReason?: string
} {
  const status = (app.status || '').toUpperCase()

  if (status === 'ENROLLED' || status === 'ADMITTED') {
    return {
      whereAreWe: 'Admission Completed',
      whatHappened: 'Admission confirmed and student officially enrolled in class.',
      whatNeedsToHappen: 'No further admission action. Student profile and parent portal are ready.',
      whatShouldIClick: 'View Student',
      primaryActionType: 'VIEW_STUDENT',
      targetTab: 'overview',
      action: 'Admission Completed',
      actor: 'Completed',
      stage: 'ENROLLED',
      status: 'COMPLETED',
    }
  }

  if (status === 'REJECTED' || status === 'WITHDRAWN') {
    return {
      whereAreWe: status === 'WITHDRAWN' ? 'Offer Declined' : 'Application Not Approved',
      whatHappened: status === 'WITHDRAWN' ? 'Parent declined offer or admission withdrawn.' : 'Application was reviewed and not approved.',
      whatNeedsToHappen: 'No further action required. This file is closed and archived.',
      whatShouldIClick: 'No further admission action',
      primaryActionType: 'NONE',
      targetTab: 'overview',
      action: 'File Closed',
      actor: 'Archived',
      stage: 'DECISION',
      status: 'NOT PROCEEDING',
    }
  }

  if (status === 'WAITLISTED') {
    return {
      whereAreWe: 'Waiting List',
      whatHappened: 'Classroom section is currently at full capacity.',
      whatNeedsToHappen: 'Monitor seat availability across divisions or promote when a vacancy occurs.',
      whatShouldIClick: 'Evaluate & Promote',
      primaryActionType: 'REVIEW_APPLICATION',
      targetTab: 'overview',
      action: 'Classroom Full — Monitor Capacity',
      actor: 'Admissions Desk',
      stage: 'DECISION',
      status: 'BLOCKED',
      isBlocked: true,
      blockReason: 'Section at maximum capacity',
    }
  }

  // Parent has accepted offer -> Staff final review is required
  if (status === 'OFFER_ACCEPTED') {
    return {
      whereAreWe: 'Parent Accepted',
      whatHappened: 'Parent accepted the admission offer and agreed to the fee terms.',
      whatNeedsToHappen: 'Staff needs to complete the final admission check.',
      whatShouldIClick: 'Start Final Review',
      primaryActionType: 'START_FINAL_REVIEW',
      targetTab: 'final_confirmation',
      action: 'Start Final Review',
      actor: 'Admissions Officer / Principal',
      stage: 'FINAL CONFIRMATION',
      status: 'ACTION REQUIRED',
    }
  }

  // Candidate placed on Waiting List
  if (status === 'WAITLISTED') {
    return {
      whereAreWe: 'Placed on Waiting List',
      whatHappened: 'Applicant is placed in queue awaiting seat availability or deferral date.',
      whatNeedsToHappen: 'Monitor seat availability in program classrooms and review queue priority.',
      whatShouldIClick: 'View Waiting List',
      primaryActionType: 'REVIEW_APPLICATION',
      targetTab: 'waitlist',
      action: 'Waiting for Seat Availability',
      actor: 'Admissions Officer',
      stage: 'WAITING_LIST',
      status: 'WAITING FOR STAFF',
    }
  }

  // Offer has been generated and sent to parent
  if (status === 'OFFER_SENT') {
    return {
      whereAreWe: 'Offer Sent',
      whatHappened: 'Admission offer and fee breakdown sent to parent.',
      whatNeedsToHappen: 'Waiting for parent to review and accept the offer.',
      whatShouldIClick: 'Wait for Parent',
      primaryActionType: 'WAIT_FOR_PARENT',
      targetTab: 'decision_offer',
      action: 'Wait for Parent',
      actor: 'Parent',
      stage: 'OFFER',
      status: 'WAITING FOR PARENT',
    }
  }

  // Application has been approved -> Staff must issue fee offer
  if (status === 'APPROVED') {
    return {
      whereAreWe: 'Application Approved',
      whatHappened: 'School leadership approved the application for admission.',
      whatNeedsToHappen: 'Select a fee template and send the official admission offer.',
      whatShouldIClick: 'Create Fee Offer',
      primaryActionType: 'CREATE_FEE_OFFER',
      targetTab: 'decision_offer',
      action: 'Create Fee Offer',
      actor: 'Admissions Officer',
      stage: 'OFFER',
      status: 'ACTION REQUIRED',
    }
  }

  // Application is under review / submitted
  const docs = (app as any).documents || []
  const unverifiedDocs = docs.filter((d: any) => !d.verified && d.status !== 'VERIFIED')

  if (unverifiedDocs.length > 0) {
    return {
      whereAreWe: 'Documents Pending',
      whatHappened: `Application submitted; ${unverifiedDocs.length} mandatory document${unverifiedDocs.length > 1 ? 's are' : ' is'} awaiting staff verification.`,
      whatNeedsToHappen: 'Verify birth certificate, medical records, and family documents.',
      whatShouldIClick: 'Verify Documents',
      primaryActionType: 'VERIFY_DOCUMENTS',
      targetTab: 'documents',
      action: 'Verify Documents',
      actor: 'Admissions Officer',
      stage: 'VERIFICATION',
      status: 'ACTION REQUIRED',
    }
  }

  if (reqs && reqs.capacityCheck && !reqs.capacityCheck.hasAvailableCapacity) {
    return {
      whereAreWe: 'No Capacity Available',
      whatHappened: 'Classroom sections for this program are full.',
      whatNeedsToHappen: 'Review application for waitlisting or division seat reallocation.',
      whatShouldIClick: 'Review Application',
      primaryActionType: 'REVIEW_APPLICATION',
      targetTab: 'decision_offer',
      action: 'No Classroom Seat Available',
      actor: 'Principal',
      stage: 'DECISION',
      status: 'BLOCKED',
      isBlocked: true,
      blockReason: 'All sections for this program are full',
    }
  }

  if (reqs && reqs.ageRequirement && !reqs.ageRequirement.eligible) {
    return {
      whereAreWe: 'Age Criteria Not Met',
      whatHappened: reqs.ageRequirement.reason || 'Child age is outside the configured program bounds.',
      whatNeedsToHappen: 'Principal review required to determine eligibility or alternative program.',
      whatShouldIClick: 'Review Application',
      primaryActionType: 'REVIEW_APPLICATION',
      targetTab: 'decision_offer',
      action: 'Age Criteria Not Met',
      actor: 'Principal',
      stage: 'DECISION',
      status: 'BLOCKED',
      isBlocked: true,
      blockReason: reqs.ageRequirement.reason || 'Child age out of program bounds',
    }
  }

  return {
    whereAreWe: 'Application Submitted',
    whatHappened: 'Admission application and documents submitted for school review.',
    whatNeedsToHappen: 'Principal or Centre Head needs to review the application and make a decision.',
    whatShouldIClick: 'Review Application',
    primaryActionType: 'REVIEW_APPLICATION',
    targetTab: 'decision_offer',
    action: 'Review Application',
    actor: 'Principal',
    stage: 'DECISION',
    status: 'ACTION REQUIRED',
  }
}

export default function AdmissionsPage() {
  const toast = useToast()

  // Navigation state (Default: Overview workspace)
  const [tab, setTab] = useState<string>('overview')

  // Master setup contexts (loaded from DB/ConfigurationService)
  const [sessions, setSessions] = useState<AcademicSessionOption[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [programs, setPrograms] = useState<ProgramOption[]>([])
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([])
  const [feePlans, setFeePlans] = useState<any[]>([])
  const [selectedFeePlanId, setSelectedFeePlanId] = useState<string>('')

  // Active Scope Selection
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [selectedBranchId, setSelectedBranchId] = useState<string>('')
  const [filterProgram, setFilterProgram] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Data states
  const [enquiries, setEnquiries] = useState<Enquiry[] | null>(null)
  const [applications, setApplications] = useState<ApplicationListItem[] | null>(null)
  const [busy, setBusy] = useState(false)

  // Follow-up tab filter sub-state: 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING' | 'COMPLETED'
  const [followUpFilter, setFollowUpFilter] = useState<'OVERDUE' | 'DUE_TODAY' | 'UPCOMING' | 'COMPLETED'>('DUE_TODAY')

  // Inspector & Modal states
  const [enquiryModal, setEnquiryModal] = useState(false)
  const [formModal, setFormModal] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<any | null>(null)
  const [pendingFormPayload, setPendingFormPayload] = useState<any | null>(null)
  const [enquiryDuplicateWarning, setEnquiryDuplicateWarning] = useState<any | null>(null)
  const [pendingEnquiryPayload, setPendingEnquiryPayload] = useState<any | null>(null)
  const [successModal, setSuccessModal] = useState<{ open: boolean; data: any | null }>({ open: false, data: null })
  const [pipelineModalOpen, setPipelineModalOpen] = useState(false)

  // Final Confirmation Dialog State
  const [confirmAdmissionDialog, setConfirmAdmissionDialog] = useState(false)
  const [enrollmentProgressStep, setEnrollmentProgressStep] = useState<string | null>(null)

  // Additional guardian state (Max 2 Parents Rule compliant)
  const [showExtraGuardian, setShowExtraGuardian] = useState(false)
  const [extraGuardian, setExtraGuardian] = useState({
    relationship: 'MOTHER',
    fullName: '',
    phone: '',
    email: '',
  })

  // Enquiry / Application form enhancements
  const [enquiryDob, setEnquiryDob] = useState('')
  const [appDob, setAppDob] = useState('')
  const [appProgramType, setAppProgramType] = useState('NURSERY')
  const [appStep, setAppStep] = useState(0)
  const [appSummary, setAppSummary] = useState<{ k: string; v: string }[]>([])

  // Computed age for application wizard live feedback
  const appAgeMonths = useMemo(() => calculateAgeMonths(appDob), [appDob])
  const selectedProgramDetails = useMemo(() => {
    return programs.find((p) => (p.programType || p.code) === appProgramType)
  }, [programs, appProgramType])

  const appAgeEligibility = useMemo(() => {
    if (!selectedProgramDetails || appAgeMonths === null) return null
    const min = selectedProgramDetails.ageMinMonths
    const max = selectedProgramDetails.ageMaxMonths
    if (min !== null && appAgeMonths < min) {
      return { eligible: false, reason: `Age ${appAgeMonths}m is below minimum ${min}m for ${selectedProgramDetails.name}` }
    }
    if (max !== null && appAgeMonths > max) {
      return { eligible: false, reason: `Age ${appAgeMonths}m exceeds maximum ${max}m for ${selectedProgramDetails.name}` }
    }
    return { eligible: true, reason: `Age ${appAgeMonths}m satisfies ${selectedProgramDetails.name} criteria` }
  }, [selectedProgramDetails, appAgeMonths])

  useEffect(() => {
    if (formModal) {
      setAppDob('')
      setAppProgramType(programs[0]?.programType || 'NURSERY')
    }
  }, [formModal, programs])

  const nextStep = (e: React.MouseEvent<HTMLButtonElement>) => {
    const f = e.currentTarget.form
    if (f) {
      if (!f.checkValidity()) {
        f.reportValidity()
        return
      }
      const ns = Math.min(appStep + 1, 2)
      setAppStep(ns)
      if (ns === 2) {
        const fd = new FormData(f)
        const g = (k: string) => String(fd.get(k) || '')
        setAppSummary([
          { k: 'Program', v: g('programType') },
          { k: 'Child', v: `${g('childFirstName')} ${g('childLastName')}`.trim() },
          { k: 'DOB / Age', v: `${g('childDob')} (${appAgeMonths !== null ? `${appAgeMonths} months` : '—'})` },
          { k: 'Gender', v: g('childGender') },
          { k: 'Blood Group', v: g('bloodGroup') || 'Not specified' },
          { k: 'Previous School', v: g('previousSchool') || 'None' },
          { k: 'Primary Parent', v: `${g('parentName')} (${g('relationship') || 'Parent'})` },
          { k: 'Phone', v: g('parentPhone') },
          { k: 'Email', v: g('parentEmail') || '—' },
          { k: 'Address', v: g('address') || '—' },
          ...(showExtraGuardian && extraGuardian.fullName
            ? [{ k: 'Second Caregiver', v: `${extraGuardian.fullName} (${extraGuardian.relationship}) · ${extraGuardian.phone}` }]
            : []),
        ])
      }
    }
  }

  // Follow-up & Visit Modals
  const [followUpModal, setFollowUpModal] = useState<{ open: boolean; enquiry: Enquiry | null; defaultType?: string }>({ open: false, enquiry: null })
  const [visitModal, setVisitModal] = useState<{ open: boolean; enquiry: Enquiry | null }>({ open: false, enquiry: null })
  const [visitOutcomeModal, setVisitOutcomeModal] = useState<{ open: boolean; visitId: string | null; visit: any | null; lead: any | null }>({ open: false, visitId: null, visit: null, lead: null })
  const [rescheduleModal, setRescheduleModal] = useState<{ open: boolean; visitId: string | null; lead: any | null; currentDate?: string }>({ open: false, visitId: null, lead: null })
  const [cancelVisitModal, setCancelVisitModal] = useState<{ open: boolean; visitId: string | null; lead: any | null }>({ open: false, visitId: null, lead: null })
  const [selectedOutcomeType, setSelectedOutcomeType] = useState<string>('READY_TO_PROCEED')
  const [workspaceVisits, setWorkspaceVisits] = useState<{ counts: { dueToday: number; overdue: number; upcomingVisits: number; completed: number }; items: any[] }>({ counts: { dueToday: 0, overdue: 0, upcomingVisits: 0, completed: 0 }, items: [] })

  // Application Inspector Modal
  const [inspector, setInspector] = useState<{
    open: boolean
    formId: string | null
    data: ReviewData | null
    tab: string
  }>({
    open: false,
    formId: null,
    data: null,
    tab: 'overview',
  })
  const drawerPanelRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!inspector.open) return
    const opener = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setInspector({ open: false, formId: null, data: null, tab: 'overview' })
      }
    }
    document.addEventListener('keydown', onKey)
    const timer = setTimeout(() => drawerPanelRef.current?.focus(), 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', onKey)
      opener?.focus()
    }
  }, [inspector.open])

  // Inspector Action States
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [rejectReasonModal, setRejectReasonModal] = useState<{ open: boolean; docId?: string; isAppReject?: boolean }>({ open: false })
  const [rejectReasonText, setRejectReasonText] = useState<string>('')
  const [counsellingForm, setCounsellingForm] = useState({
    scheduledAt: new Date().toISOString().slice(0, 16),
    counselorName: '',
    mode: 'IN_PERSON',
    notes: '',
    outcome: 'POSITIVE',
  })

  // CSV Bulk Import Wizard State
  const [csvModalOpen, setCsvModalOpen] = useState(false)
  const [csvStep, setCsvStep] = useState(0)
  const [csvType, setCsvType] = useState<'leads' | 'applications'>('leads')
  const [csvRawText, setCsvRawText] = useState('')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRawRows, setCsvRawRows] = useState<any[]>([])
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({})
  const [csvValidationResult, setCsvValidationResult] = useState<any>(null)
  const [csvDuplicateAction, setCsvDuplicateAction] = useState<'SKIP' | 'CREATE' | 'LINK'>('SKIP')
  const [csvImportResult, setCsvImportResult] = useState<any>(null)
  const [csvLoading, setCsvLoading] = useState(false)

  // Allocation Engine Modal State
  const [allocModal, setAllocModal] = useState<{
    open: boolean
    applicationId: string | null
    data: any
    loading: boolean
    selectedClassId?: string
  }>({
    open: false,
    applicationId: null,
    data: null,
    loading: false,
  })

  // Lead / Enquiry Inspector State
  const [leadInspector, setLeadInspector] = useState<{
    open: boolean
    leadId: string | null
    data: any | null
    activity: any[]
    tab: 'overview' | 'activity' | 'edit'
    loading: boolean
  }>({
    open: false,
    leadId: null,
    data: null,
    activity: [],
    tab: 'overview',
    loading: false,
  })

  // Lost Lead Modal State
  const [lostModal, setLostModal] = useState<{
    open: boolean
    leadId: string | null
    leadNumber: string
    reason: string
    notes: string
  }>({
    open: false,
    leadId: null,
    leadNumber: '',
    reason: 'CHOSE_ANOTHER_SCHOOL',
    notes: '',
  })

  // Assign Staff Modal State
  const [assignModal, setAssignModal] = useState<{
    open: boolean
    leadId: string | null
    leadNumber: string
    assignedToId: string
  }>({
    open: false,
    leadId: null,
    leadNumber: '',
    assignedToId: '',
  })

  const [staffOptions, setStaffOptions] = useState<{ id: string; fullName: string; role?: string }[]>([])

  // ── M03.4 Waiting List States ─────────────────────────────────────────────
  const [waitlistEntries, setWaitlistEntries] = useState<any[]>([])
  const [waitlistCapacities, setWaitlistCapacities] = useState<any[]>([])
  const [wlPriorityFilter, setWlPriorityFilter] = useState<'ALL' | 'NORMAL' | 'HIGH'>('ALL')
  const [wlStatusFilter, setWlStatusFilter] = useState<string>('ALL')

  // Move to Waitlist Modal (with mandatory reasons)
  const [waitlistModal, setWaitlistModal] = useState<{
    open: boolean
    applicationId: string | null
    applicationNumber?: string
    childName?: string
    programType?: string
    reason: 'NO_SEAT_AVAILABLE' | 'PARENT_REQUESTED_LATER' | 'FUTURE_TERM' | 'PROGRAM_CAPACITY' | 'OTHER'
    reasonNotes: string
    priority: 'NORMAL' | 'HIGH'
  }>({
    open: false,
    applicationId: null,
    reason: 'NO_SEAT_AVAILABLE',
    reasonNotes: '',
    priority: 'NORMAL',
  })

  // Change Priority Modal
  const [priorityModal, setPriorityModal] = useState<{
    open: boolean
    entryId: string | null
    childName?: string
    currentPriority?: string
    newPriority: 'NORMAL' | 'HIGH'
    reason: string
  }>({
    open: false,
    entryId: null,
    newPriority: 'HIGH',
    reason: '',
  })

  // Waiting List Inspector Drawer / Sheet
  const [wlInspector, setWlInspector] = useState<{
    open: boolean
    entryId: string | null
    data: any | null
    loading: boolean
    tab: 'overview' | 'capacity' | 'audits'
  }>({
    open: false,
    entryId: null,
    data: null,
    loading: false,
    tab: 'overview',
  })

  // Waitlist Seat Offer Modal
  const [wlOfferModal, setWlOfferModal] = useState<{
    open: boolean
    entryId: string | null
    childName?: string
    validDays: number
    feePlanId: string
    terms: string
  }>({
    open: false,
    entryId: null,
    validDays: 7,
    feePlanId: '',
    terms: '',
  })

  // Waitlist Parent Response Modal
  const [wlResponseModal, setWlResponseModal] = useState<{
    open: boolean
    entryId: string | null
    childName?: string
    response: 'ACCEPTED' | 'DECLINED'
    notes: string
  }>({
    open: false,
    entryId: null,
    response: 'ACCEPTED',
    notes: '',
  })

  // Waitlist Admission Completion Modal
  const [wlCompleteModal, setWlCompleteModal] = useState<{
    open: boolean
    entryId: string | null
    childName?: string
    programType?: string
    classroomId: string
  }>({
    open: false,
    entryId: null,
    classroomId: '',
  })

  // Waitlist Candidate Withdraw Modal
  const [wlWithdrawModal, setWlWithdrawModal] = useState<{
    open: boolean
    entryId: string | null
    childName?: string
    reason: string
  }>({
    open: false,
    entryId: null,
    reason: '',
  })

  const handleParseCsv = (content: string) => {
    setCsvRawText(content)
    const lines = content.trim().split(/\r?\n/).filter(Boolean)
    if (lines.length < 2) {
      toast('CSV file must have a header row and at least one data row', 'error')
      return
    }
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''))
    setCsvHeaders(headers)

    const rows: any[] = []
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''))
      const obj: any = {}
      headers.forEach((h, idx) => {
        obj[h] = vals[idx] || ''
      })
      rows.push(obj)
    }
    setCsvRawRows(rows)

    const initialMapping: Record<string, string> = {}
    const canonicalFields = csvType === 'leads'
      ? [
          { key: 'parentName', aliases: ['parent_name', 'parent', 'guardian', 'father_name', 'mother_name'] },
          { key: 'phone', aliases: ['parent_phone', 'phone', 'mobile', 'contact'] },
          { key: 'email', aliases: ['parent_email', 'email'] },
          { key: 'childName', aliases: ['child_name', 'student_name', 'child'] },
          { key: 'dob', aliases: ['child_dob', 'dob', 'date_of_birth', 'birth_date'] },
          { key: 'program', aliases: ['interested_program', 'program', 'class', 'grade'] },
          { key: 'notes', aliases: ['notes', 'remarks', 'comment'] },
        ]
      : [
          { key: 'childFirstName', aliases: ['child_first_name', 'first_name', 'name'] },
          { key: 'childLastName', aliases: ['child_last_name', 'last_name', 'surname'] },
          { key: 'dob', aliases: ['dob', 'date_of_birth', 'child_dob'] },
          { key: 'gender', aliases: ['gender', 'sex'] },
          { key: 'program', aliases: ['program', 'program_type', 'class'] },
          { key: 'parentName', aliases: ['parent_name', 'guardian_name', 'father_name'] },
          { key: 'parentPhone', aliases: ['parent_phone', 'phone', 'mobile'] },
          { key: 'parentEmail', aliases: ['parent_email', 'email'] },
          { key: 'address', aliases: ['address', 'residence', 'location'] },
          { key: 'notes', aliases: ['notes', 'remarks'] },
        ]

    canonicalFields.forEach((cf) => {
      const match = headers.find((h) => {
        const clean = h.toLowerCase().replace(/[\s_-]/g, '')
        return cf.aliases.some((a) => a.replace(/[\s_-]/g, '') === clean) || clean === cf.key.toLowerCase()
      })
      if (match) initialMapping[cf.key] = match
    })
    setCsvMapping(initialMapping)
    setCsvStep(1)
  }

  const handleValidateCsv = async () => {
    setCsvLoading(true)
    try {
      const res = await fetch('/api/v1/admissions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview',
          type: csvType,
          rows: csvRawRows,
          mapping: csvMapping,
          branchId: selectedBranchId,
          academicYearId: selectedSessionId,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setCsvValidationResult(json.data)
        setCsvStep(2)
      } else {
        toast(json.error?.message || 'Validation failed', 'error')
      }
    } catch (err) {
      toast('Failed to validate CSV rows', 'error')
    } finally {
      setCsvLoading(false)
    }
  }

  const handleExecuteCsvImport = async () => {
    setCsvLoading(true)
    try {
      const res = await fetch('/api/v1/admissions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          type: csvType,
          rows: csvValidationResult.rows,
          duplicateAction: csvDuplicateAction,
          branchId: selectedBranchId,
          academicYearId: selectedSessionId,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setCsvImportResult(json.data)
        setCsvStep(4)
        toast(`Import Batch ${json.data.batchId} completed!`, 'success')
        loadData()
      } else {
        toast(json.error?.message || 'Import execution failed', 'error')
      }
    } catch (err) {
      toast('Failed to execute batch import', 'error')
    } finally {
      setCsvLoading(false)
    }
  }

  const openAllocationModal = async (appId: string) => {
    setAllocModal({ open: true, applicationId: appId, data: null, loading: true })
    try {
      const res = await fetch(`/api/v1/applications/${appId}/allocation`)
      const json = await res.json()
      if (json.success) {
        setAllocModal({
          open: true,
          applicationId: appId,
          data: json.data,
          loading: false,
          selectedClassId: json.data.recommendedClassroomId || json.data.divisions[0]?.id || '',
        })
      } else {
        toast(json.error?.message || 'Failed to load allocation options', 'error')
      }
    } catch (err) {
      toast('Failed to evaluate allocation options', 'error')
      setAllocModal((prev) => ({ ...prev, loading: false }))
    }
  }

  const handleConfirmAllocation = async (action: 'allocate' | 'waitlist') => {
    if (!allocModal.applicationId) return
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/applications/${allocModal.applicationId}/allocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          classroomId: allocModal.selectedClassId,
          academicYearId: selectedSessionId,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast(action === 'waitlist' ? 'Application placed on Waiting List' : `Allocated to ${json.data.classroomName}!`, 'success')
        setAllocModal({ open: false, applicationId: null, data: null, loading: false })
        loadData()
        if (inspector.open && inspector.formId === allocModal.applicationId) {
          openInspector(allocModal.applicationId)
        }
      } else {
        toast(json.error?.message || 'Allocation failed', 'error')
      }
    } catch (err) {
      toast('Allocation request failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  // ── Load Masters from Database ───────────────────────────────────────────
  useEffect(() => {
    async function loadMasters() {
      try {
        const [sessRes, brRes, progRes, clsRes, feeRes] = await Promise.all([
          fetch('/api/v1/academic-years').then((r) => r.json()),
          fetch('/api/v1/branches').then((r) => r.json()),
          fetch('/api/v1/programs').then((r) => r.json()),
          fetch('/api/v1/classrooms').then((r) => r.json()),
          fetch('/api/v1/fee-plans').then((r) => r.json()).catch(() => ({ success: false, data: [] })),
        ])

        if (sessRes.success && sessRes.data.length > 0) {
          setSessions(sessRes.data)
          const current = sessRes.data.find((s: AcademicSessionOption) => s.isCurrent) || sessRes.data[0]
          setSelectedSessionId(current.id)
        }
        if (brRes.success && brRes.data.length > 0) {
          setBranches(brRes.data)
          const main = brRes.data.find((b: BranchOption) => b.isMain) || brRes.data[0]
          setSelectedBranchId(main.id)
        }
        if (progRes.success) setPrograms(progRes.data)
        if (clsRes.success) setClassrooms(clsRes.data)
        if (feeRes.success && feeRes.data?.length > 0) {
          setFeePlans(feeRes.data)
          setSelectedFeePlanId(feeRes.data[0].id)
        }
      } catch (err) {
        console.error('Failed to load setup masters:', err)
      }
    }
    loadMasters()
  }, [])

  // ── Load Admissions Data ─────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!selectedSessionId || !selectedBranchId) return
    try {
      const qParams = new URLSearchParams({
        branchId: selectedBranchId,
        academicYearId: selectedSessionId,
        ...(filterProgram ? { programType: filterProgram } : {}),
        ...(filterStatus ? { status: filterStatus } : {}),
        ...(searchQuery ? { q: searchQuery } : {}),
      })

      const [enqRes, formRes, visitRes, wlRes] = await Promise.all([
        fetch(`/api/v1/leads?${qParams.toString()}`).then((r) => r.json()),
        fetch(`/api/v1/applications?${qParams.toString()}`).then((r) => r.json()),
        fetch(`/api/v1/visits?branchId=${selectedBranchId}&queue=${followUpFilter}`).then((r) => r.json()).catch(() => ({ success: false, data: null })),
        fetch(
          `/api/v1/admissions/waitlist?branchId=${selectedBranchId}&academicYearId=${selectedSessionId}${filterProgram ? `&programType=${filterProgram}` : ''}${wlPriorityFilter !== 'ALL' ? `&priority=${wlPriorityFilter}` : ''}${wlStatusFilter !== 'ALL' ? `&status=${wlStatusFilter}` : ''}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`
        ).then((r) => r.json()).catch(() => ({ success: false, data: null })),
      ])

      if (enqRes.success) setEnquiries(enqRes.data)
      if (formRes.success) setApplications(formRes.data)
      if (visitRes?.success && visitRes.data) setWorkspaceVisits(visitRes.data)
      if (wlRes?.success && wlRes.data) {
        const rawEntries = Array.isArray(wlRes.data)
          ? wlRes.data
          : Array.isArray(wlRes.data.entries)
            ? wlRes.data.entries
            : []
        const rawCapacities = Array.isArray(wlRes.meta?.capacitySummaries)
          ? wlRes.meta.capacitySummaries
          : Array.isArray(wlRes.data?.capacities)
            ? wlRes.data.capacities
            : []
        setWaitlistEntries(rawEntries)
        setWaitlistCapacities(rawCapacities)
      }
    } catch (err) {
      console.error('Failed to fetch admissions data:', err)
    }
  }, [selectedSessionId, selectedBranchId, filterProgram, filterStatus, searchQuery, followUpFilter, wlPriorityFilter, wlStatusFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Open Inspector ───────────────────────────────────────────────────────
  const openInspector = async (formId: string, initialTab: string = 'overview') => {
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/applications/${formId}?branchId=${selectedBranchId}&academicYearId=${selectedSessionId}`)
      const json = await res.json()
      setBusy(false)
      if (json.success) {
        setInspector({
          open: true,
          formId,
          data: json.data,
          tab: initialTab,
        })
        const availableSection = json.data.requirements?.capacityCheck?.sections?.find((s: any) => s.hasSeat)
        if (availableSection) setSelectedClassId(availableSection.id)
      } else {
        toast.error('Could not load application detail', json.error?.message)
      }
    } catch (err: any) {
      setBusy(false)
      toast.error('Network error loading application', err.message)
    }
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleCreateEnquiry = async (e: React.FormEvent<HTMLFormElement>, override: boolean = false) => {
    if (e && e.preventDefault) e.preventDefault()
    setBusy(true)
    const fd = e?.currentTarget ? new FormData(e.currentTarget) : null
    const payload: any = fd ? Object.fromEntries(fd.entries()) : (pendingEnquiryPayload || {})
    payload.branchId = selectedBranchId
    payload.academicYearId = selectedSessionId
    if (override) {
      payload.overrideDuplicate = true
    }

    const res = await fetch('/api/v1/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    setBusy(false)

    if (json.success) {
      if (json.meta?.isDuplicate && !override) {
        setEnquiryDuplicateWarning({
          lead: json.data,
          warning: json.meta.warning || 'A lead with similar phone, email, or child name already exists.',
          payload,
        })
        setPendingEnquiryPayload(payload)
      } else {
        toast.success('Enquiry recorded', `${json.data.leadNumber} created for ${json.data.parentName}`)
        setEnquiryModal(false)
        setEnquiryDob('')
        setEnquiryDuplicateWarning(null)
        setPendingEnquiryPayload(null)
        loadData()
      }
    } else {
      toast.error('Failed to record enquiry', json.error?.message)
    }
  }

  const handleConfirmDuplicateEnquiry = async () => {
    if (!pendingEnquiryPayload) return
    setBusy(true)
    pendingEnquiryPayload.overrideDuplicate = true
    const res = await fetch('/api/v1/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pendingEnquiryPayload),
    })
    const json = await res.json()
    setBusy(false)
    if (json.success) {
      toast.success('Enquiry recorded (Override)', `${json.data.leadNumber} created for ${json.data.parentName}`)
      setEnquiryModal(false)
      setEnquiryDob('')
      setEnquiryDuplicateWarning(null)
      setPendingEnquiryPayload(null)
      loadData()
    } else {
      toast.error('Failed to record enquiry', json.error?.message)
    }
  }

  const handleCreateApplication = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    const payload: any = Object.fromEntries(fd.entries())
    payload.branchId = selectedBranchId
    payload.academicYearId = selectedSessionId
    if (showExtraGuardian && extraGuardian.fullName) {
      payload.additionalGuardians = [extraGuardian]
    }

    const res = await fetch('/api/v1/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    setBusy(false)

    if (json.success) {
      toast.success('Application created', `${json.data.applicationNumber} ready for document verification`)
      setFormModal(false)
      setAppDob('')
      setAppStep(0)
      setAppSummary([])
      setShowExtraGuardian(false)
      setExtraGuardian({ relationship: 'MOTHER', fullName: '', phone: '', email: '' })
      setDuplicateWarning(null)
      setPendingFormPayload(null)
      loadData()
      openInspector(json.data.id, 'documents')
    } else if (json.status === 409 || json.error?.code === 'CONFLICT' || json.meta?.isDuplicate) {
      setDuplicateWarning(json.error?.message || 'A similar application exists for this child.')
      setPendingFormPayload(payload)
    } else {
      toast.error('Application creation failed', json.error?.message)
    }
  }

  const handleConfirmDuplicateApplication = async () => {
    if (!pendingFormPayload) return
    setBusy(true)
    pendingFormPayload.isDuplicateConfirmed = true
    const res = await fetch('/api/v1/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pendingFormPayload),
    })
    const json = await res.json()
    setBusy(false)
    if (json.success) {
      toast.success('Application created with confirmation', json.data.applicationNumber)
      setFormModal(false)
      setDuplicateWarning(null)
      setPendingFormPayload(null)
      setShowExtraGuardian(false)
      setExtraGuardian({ relationship: 'MOTHER', fullName: '', phone: '', email: '' })
      loadData()
    } else {
      toast.error('Could not create application', json.error?.message)
    }
  }

  const handleConvertEnquiry = async (enquiryId: string) => {
    setBusy(true)
    const res = await fetch(`/api/v1/leads/${enquiryId}/convert`, { method: 'POST' })
    const json = await res.json()
    setBusy(false)
    if (json.success) {
      toast.success('Admission Form Started', `Form ${json.data.applicationNumber} created from enquiry`)
      loadData()
      openInspector(json.data.applicationId, 'documents')
    } else {
      toast.error('Could not convert', json.error?.message)
    }
  }

  const openLeadInspector = async (leadId: string, tab: 'overview' | 'activity' | 'edit' = 'overview') => {
    setLeadInspector((prev) => ({ ...prev, open: true, leadId, tab, loading: true }))
    try {
      const res = await fetch(`/api/v1/leads/${leadId}`)
      const json = await res.json()
      if (json.success) {
        setLeadInspector({
          open: true,
          leadId,
          data: json.data?.enquiry || json.data?.lead || json.data,
          activity: json.data?.activity || [],
          tab,
          loading: false,
        })
      } else {
        toast.error('Failed to load enquiry details', json.error?.message)
        setLeadInspector((prev) => ({ ...prev, loading: false }))
      }
    } catch {
      toast.error('Error fetching enquiry details')
      setLeadInspector((prev) => ({ ...prev, loading: false }))
    }
  }

  const handleOpenLostModal = (e: React.MouseEvent, leadId: string, leadNumber: string) => {
    e.stopPropagation()
    setLostModal({
      open: true,
      leadId,
      leadNumber,
      reason: 'CHOSE_ANOTHER_SCHOOL',
      notes: '',
    })
  }

  const handleConfirmLostLead = async () => {
    if (!lostModal.leadId || !lostModal.reason) return
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/leads/${lostModal.leadId}/lost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lostReason: lostModal.reason,
          lostNotes: lostModal.notes,
          branchId: selectedBranchId,
          academicYearId: selectedSessionId,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Enquiry closed as Lost', `${lostModal.leadNumber} marked as lost`)
        setLostModal({ open: false, leadId: null, leadNumber: '', reason: 'CHOSE_ANOTHER_SCHOOL', notes: '' })
        loadData()
        if (leadInspector.open && leadInspector.leadId === lostModal.leadId) {
          openLeadInspector(lostModal.leadId)
        }
      } else {
        toast.error('Failed to close enquiry', json.error?.message)
      }
    } catch {
      toast.error('Failed to close enquiry')
    } finally {
      setBusy(false)
    }
  }

  const handleOpenAssignModal = async (e: React.MouseEvent, leadId: string, leadNumber: string, currentAssignedId?: string | null) => {
    e.stopPropagation()
    setAssignModal({
      open: true,
      leadId,
      leadNumber,
      assignedToId: currentAssignedId || '',
    })
    if (staffOptions.length === 0) {
      try {
        const res = await fetch('/api/v1/users?userType=STAFF&limit=100')
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setStaffOptions(json.data.map((u: any) => ({ id: u.id, fullName: u.fullName || u.email, role: u.role })))
        }
      } catch {}
    }
  }

  const handleConfirmAssignLead = async () => {
    if (!assignModal.leadId || !assignModal.assignedToId) return
    setBusy(true)
    try {
      const staffMember = staffOptions.find((s) => s.id === assignModal.assignedToId)
      const res = await fetch(`/api/v1/leads/${assignModal.leadId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedToId: assignModal.assignedToId,
          assignedStaffName: staffMember?.fullName,
          branchId: selectedBranchId,
          academicYearId: selectedSessionId,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Lead Assigned', `${assignModal.leadNumber} assigned to ${staffMember?.fullName || 'staff'}`)
        setAssignModal({ open: false, leadId: null, leadNumber: '', assignedToId: '' })
        loadData()
        if (leadInspector.open && leadInspector.leadId === assignModal.leadId) {
          openLeadInspector(assignModal.leadId)
        }
      } else {
        toast.error('Assignment failed', json.error?.message)
      }
    } catch {
      toast.error('Failed to assign lead')
    } finally {
      setBusy(false)
    }
  }

  const handleUpdateLead = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!leadInspector.leadId) return
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    const payload: any = Object.fromEntries(fd.entries())
    payload.branchId = selectedBranchId
    payload.academicYearId = selectedSessionId
    try {
      const res = await fetch(`/api/v1/leads/${leadInspector.leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Enquiry updated', 'Details updated successfully')
        loadData()
        openLeadInspector(leadInspector.leadId, 'overview')
      } else {
        toast.error('Update failed', json.error?.message)
      }
    } catch {
      toast.error('Failed to update enquiry')
    } finally {
      setBusy(false)
    }
  }

  const handleReactivateLead = async (leadId: string, leadNumber: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/leads/${leadId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'QUALIFIED',
          notes: 'Re-activated from lost/nurture state by staff',
          branchId: selectedBranchId,
          academicYearId: selectedSessionId,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Enquiry Re-activated', `${leadNumber} status set to QUALIFIED`)
        loadData()
        openLeadInspector(leadId, 'overview')
      } else {
        toast.error('Re-activation failed', json.error?.message)
      }
    } catch {
      toast.error('Failed to re-activate enquiry')
    } finally {
      setBusy(false)
    }
  }

  const handleAddFollowUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!followUpModal.enquiry) return
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    const payload = Object.fromEntries(fd.entries())
    payload.branchId = selectedBranchId
    payload.academicYearId = selectedSessionId

    const res = await fetch(`/api/v1/leads/${followUpModal.enquiry.id}/follow-ups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    setBusy(false)
    if (json.success) {
      toast.success('Follow-up scheduled', 'Action recorded on lead')
      setFollowUpModal({ open: false, enquiry: null })
      loadData()
    } else {
      toast.error('Failed to log follow-up', json.error?.message)
    }
  }

  const handleScheduleVisit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!visitModal.enquiry) return
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    const payload = Object.fromEntries(fd.entries())
    payload.branchId = selectedBranchId
    payload.academicYearId = selectedSessionId

    const res = await fetch(`/api/v1/leads/${visitModal.enquiry.id}/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    setBusy(false)
    if (json.success) {
      toast.success('School Visit confirmed', 'Calendar entry & follow-up set')
      setVisitModal({ open: false, enquiry: null })
      loadData()
    } else {
      toast.error('Failed to schedule visit', json.error?.message)
    }
  }

  const handleOpenVisitOutcome = (visit: any) => {
    setSelectedOutcomeType('READY_TO_PROCEED')
    setVisitOutcomeModal({
      open: true,
      visitId: visit.id,
      visit,
      lead: visit.lead || enquiries?.find((e) => e.id === visit.sourceId) || null,
    })
  }

  const handleCompleteVisitSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!visitOutcomeModal.visitId) return
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    const outcome = selectedOutcomeType
    const nextFollowUpAt = fd.get('nextFollowUpAt') as string
    const lostReason = fd.get('lostReason') as string
    const parentFeedback = fd.get('parentFeedback') as string
    const staffNotes = fd.get('staffNotes') as string

    const childInteraction = {
      comfort: fd.get('comfort') as string,
      educatorInteraction: fd.get('educatorInteraction') as string,
      communication: fd.get('communication') as string,
      activityResponse: fd.get('activityResponse') as string,
      separation: fd.get('separation') as string,
      strengthsNotes: fd.get('strengthsNotes') as string,
      supportNotes: fd.get('supportNotes') as string,
    }

    try {
      const res = await fetch(`/api/v1/visits/${visitOutcomeModal.visitId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome,
          nextFollowUpAt: nextFollowUpAt || undefined,
          lostReason: lostReason || undefined,
          parentFeedback,
          staffNotes,
          childInteraction,
          branchId: selectedBranchId,
          academicYearId: selectedSessionId,
        }),
      })
      const json = await res.json()
      setBusy(false)
      if (json.success) {
        toast.success('Visit Recorded Successfully', `Outcome: ${outcome}`)
        setVisitOutcomeModal({ open: false, visitId: null, visit: null, lead: null })
        loadData()
        if (outcome === 'READY_TO_PROCEED' && json.data.applicationId) {
          openInspector(json.data.applicationId, 'overview')
        }
      } else {
        toast.error('Failed to complete visit', json.error?.message)
      }
    } catch {
      setBusy(false)
      toast.error('Failed to complete visit')
    }
  }

  const handleRescheduleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!rescheduleModal.visitId) return
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    const newScheduledAt = fd.get('newScheduledAt') as string
    const reason = fd.get('reason') as string
    const visitorCount = parseInt((fd.get('visitorCount') as string) || '2', 10)

    try {
      const res = await fetch(`/api/v1/visits/${rescheduleModal.visitId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newScheduledAt,
          reason,
          visitorCount,
          branchId: selectedBranchId,
          academicYearId: selectedSessionId,
        }),
      })
      const json = await res.json()
      setBusy(false)
      if (json.success) {
        toast.success('Visit Rescheduled', 'History preserved and new appointment set')
        setRescheduleModal({ open: false, visitId: null, lead: null })
        loadData()
      } else {
        toast.error('Failed to reschedule visit', json.error?.message)
      }
    } catch {
      setBusy(false)
      toast.error('Failed to reschedule visit')
    }
  }

  const handleCancelVisitSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!cancelVisitModal.visitId) return
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    const reason = fd.get('reason') as string
    const nextFollowUpAt = fd.get('nextFollowUpAt') as string

    try {
      const res = await fetch(`/api/v1/visits/${cancelVisitModal.visitId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          nextFollowUpAt: nextFollowUpAt || undefined,
          branchId: selectedBranchId,
          academicYearId: selectedSessionId,
        }),
      })
      const json = await res.json()
      setBusy(false)
      if (json.success) {
        toast.info('Visit Cancelled', 'Record archived and status updated')
        setCancelVisitModal({ open: false, visitId: null, lead: null })
        loadData()
      } else {
        toast.error('Failed to cancel visit', json.error?.message)
      }
    } catch {
      setBusy(false)
      toast.error('Failed to cancel visit')
    }
  }

  const handleMarkNoShow = async (visitId: string) => {
    if (!confirm('Mark visit as No-Show? This keeps the prospect active and schedules a next-day recovery call.')) {
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/visits/${visitId}/no-show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: selectedBranchId,
          academicYearId: selectedSessionId,
        }),
      })
      const json = await res.json()
      setBusy(false)
      if (json.success) {
        toast.info('Marked as No-Show', 'Recovery call task created for admissions staff')
        loadData()
      } else {
        toast.error('Action failed', json.error?.message)
      }
    } catch {
      setBusy(false)
      toast.error('Failed to mark no-show')
    }
  }

  // ── Document Workflow ────────────────────────────────────────────────────
  const handleVerifyDocument = async (docId: string, action: 'VERIFY' | 'REJECT', remarks?: string) => {
    if (!inspector.formId) return
    setBusy(true)
    const res = await fetch(`/api/v1/applications/${inspector.formId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: docId, action, remarks }),
    })
    const json = await res.json()
    setBusy(false)
    if (json.success) {
      toast.success(action === 'VERIFY' ? 'Document verified' : 'Document rejected')
      openInspector(inspector.formId, 'documents')
      loadData()
    } else {
      toast.error('Action failed', json.error?.message)
    }
  }

  const handleVerifyAllDocuments = async () => {
    if (!inspector.formId) return
    setBusy(true)
    const res = await fetch(`/api/v1/applications/${inspector.formId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const json = await res.json()
    setBusy(false)
    if (json.success) {
      toast.success('All documents verified', 'Application status updated to VERIFIED')
      openInspector(inspector.formId, 'documents')
      loadData()
    } else {
      toast.error('Could not verify documents', json.error?.message)
    }
  }

  // ── Counselling Workflow ─────────────────────────────────────────────────
  const handleSaveCounselling = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inspector.formId) return
    setBusy(true)
    const res = await fetch(`/api/v1/applications/${inspector.formId}/counselling`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...counsellingForm,
        branchId: selectedBranchId,
        academicYearId: selectedSessionId,
      }),
    })
    const json = await res.json()
    setBusy(false)
    if (json.success) {
      toast.success('Counselling session recorded', `Outcome: ${json.data.outcome}`)
      openInspector(inspector.formId, 'decision')
      loadData()
    } else {
      toast.error('Could not save counselling', json.error?.message)
    }
  }

  // ── Approval Workflow ────────────────────────────────────────────────────
  const handleApproveApplication = async (action: string = 'APPROVE', notes?: string) => {
    if (!inspector.formId) return
    setBusy(true)
    const res = await fetch(`/api/v1/applications/${inspector.formId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, notes }),
    })
    const json = await res.json()
    setBusy(false)
    if (json.success) {
      if (action === 'NEED_MORE_INFORMATION') {
        toast.info('Information Requested', 'Application marked as Under Review')
        openInspector(inspector.formId, 'overview')
      } else {
        toast.success('Application Approved! 🎉', 'Ready for fee quote & offer letter generation')
        openInspector(inspector.formId, 'decision')
      }
      loadData()
    } else {
      toast.error('Approval failed', json.error?.message)
    }
  }

  const handleRejectApplication = async (reason: string) => {
    if (!inspector.formId) return
    setBusy(true)
    const res = await fetch(`/api/v1/applications/${inspector.formId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    const json = await res.json()
    setBusy(false)
    if (json.success) {
      toast.info('Application Rejected', `Reason: ${reason}`)
      setRejectReasonModal({ open: false })
      setRejectReasonText('')
      openInspector(inspector.formId, 'overview')
      loadData()
    } else {
      toast.error('Could not reject', json.error?.message)
    }
  }

  // ── Offer Generation & Acceptance ────────────────────────────────────────
  const handleGenerateOffer = async (validityDays: number = 7) => {
    if (!inspector.formId) return
    setBusy(true)
    const res = await fetch(`/api/v1/applications/${inspector.formId}/offer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        validityDays,
        feePlanId: selectedFeePlanId || undefined,
        branchId: selectedBranchId,
        academicYearId: selectedSessionId,
      }),
    })
    const json = await res.json()
    setBusy(false)
    if (json.success) {
      toast.success('Admission Offer Issued! 📜', `${json.data.offer.offerNumber} valid for ${validityDays} days`)
      openInspector(inspector.formId, 'decision')
      loadData()
    } else {
      toast.error('Failed to issue offer', json.error?.message)
    }
  }

  const handleAcceptOffer = async () => {
    if (!inspector.formId) return
    setBusy(true)
    const res = await fetch(`/api/v1/applications/${inspector.formId}/offer/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ACCEPT' }),
    })
    const json = await res.json()
    setBusy(false)
    if (json.success) {
      toast.success('Offer Accepted by Parent! ✓', 'Application is ready for final staff confirmation and enrollment')
      openInspector(inspector.formId, 'final_confirmation')
      loadData()
    } else {
      toast.error('Could not record acceptance', json.error?.message)
    }
  }

  const handleDeclineOffer = async (declineReason: string) => {
    if (!inspector.formId) return
    setBusy(true)
    const res = await fetch(`/api/v1/applications/${inspector.formId}/offer/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'DECLINE', declineReason }),
    })
    const json = await res.json()
    setBusy(false)
    if (json.success) {
      toast.info('Offer Declined', 'Application status updated to Withdrawn')
      openInspector(inspector.formId, 'overview')
      loadData()
    } else {
      toast.error('Could not record decline', json.error?.message)
    }
  }

  // ── Final Enrollment & Orchestration ──────────────────────────────────────
  const handleExecuteFinalEnrollment = async () => {
    if (!inspector.formId) return
    setConfirmAdmissionDialog(false)
    setBusy(true)

    // Human-readable enrollment sequence simulation
    setEnrollmentProgressStep('Creating Student Profile...')
    await new Promise((r) => setTimeout(r, 200))
    setEnrollmentProgressStep('Setting up Parent & Family Profile...')
    await new Promise((r) => setTimeout(r, 200))
    setEnrollmentProgressStep('Reserving Classroom Seat...')
    await new Promise((r) => setTimeout(r, 150))
    setEnrollmentProgressStep('Generating Initial Fee Invoice...')

    const res = await fetch(`/api/v1/applications/${inspector.formId}/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classroomId: selectedClassId || undefined,
        academicYearId: selectedSessionId,
      }),
    })
    const json = await res.json()
    setBusy(false)
    setEnrollmentProgressStep(null)

    if (json.success) {
      toast.success('Admission Completed! 🎉', `Student ${json.data.admissionNo} enrolled in ${json.data.classroomName}`)
      setSuccessModal({
        open: true,
        data: json.data.successDetails || {
          student: {
            id: json.data.studentId,
            admissionNo: json.data.admissionNo,
            classroom: json.data.classroomName,
            fullName: `${inspector.data?.application?.childFirstName || ''} ${inspector.data?.application?.childLastName || ''}`.trim(),
            programType: inspector.data?.application?.programType || 'NURSERY',
          },
          parent: {
            primaryParent: { name: inspector.data?.application?.parentName || 'Parent' },
            familyPolicy: 'M01 Canonical Family (Max 2 Parents)',
          },
          finance: {
            feePlan: 'Enrolled Program Fee Plan',
            annualPayableCents: json.data.annualPayableCents || 0,
            installments: 1,
            invoiceGenerated: true,
          },
          timeline: {
            enrolledAt: new Date().toISOString(),
            status: 'ENROLLED',
          },
        },
      })
      openInspector(inspector.formId, 'timeline')
      loadData()
    } else {
      toast.error('Admission could not be completed', json.error?.message || 'No partial admission was created.')
    }
  }

  // ── M03.4 Waiting List Handlers ───────────────────────────────────────────
  const openWaitlistModal = (app: any) => {
    setWaitlistModal({
      open: true,
      applicationId: app.id,
      applicationNumber: app.applicationNumber,
      childName: `${app.childFirstName || ''} ${app.childLastName || ''}`.trim(),
      programType: app.programType,
      reason: 'NO_SEAT_AVAILABLE',
      reasonNotes: '',
      priority: 'NORMAL',
    })
  }

  const handleWaitlist = (formId: string) => {
    const app = applications?.find((a) => a.id === formId) || inspector.data?.application
    if (app) {
      openWaitlistModal(app)
    }
  }

  const openWaitlistInspector = async (entryId: string) => {
    setWlInspector({ open: true, entryId, data: null, loading: true, tab: 'overview' })
    try {
      const res = await fetch(`/api/v1/admissions/waitlist/${entryId}`)
      const json = await res.json()
      if (json.success) {
        setWlInspector({ open: true, entryId, data: json.data, loading: false, tab: 'overview' })
      } else {
        toast.error('Could not load waitlist candidate', json.error?.message)
        setWlInspector((prev) => ({ ...prev, loading: false }))
      }
    } catch {
      toast.error('Failed to load waitlist entry')
      setWlInspector((prev) => ({ ...prev, loading: false }))
    }
  }

  const handleConfirmAddToWaitlist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!waitlistModal.applicationId) return
    if (waitlistModal.reason === 'OTHER' && !waitlistModal.reasonNotes?.trim()) {
      toast.error('Mandatory notes required', 'Please provide detailed rationale when selecting "Other"')
      return
    }

    setBusy(true)
    try {
      const res = await fetch('/api/v1/admissions/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: waitlistModal.applicationId,
          reason: waitlistModal.reason,
          reasonNotes: waitlistModal.reasonNotes || undefined,
          priority: waitlistModal.priority,
          branchId: selectedBranchId,
          academicYearId: selectedSessionId,
        }),
      })
      const json = await res.json()
      setBusy(false)
      if (json.success) {
        toast.success(
          json.data.isExisting ? 'Existing Entry Retrieved' : 'Placed on Waiting List! 📋',
          `Queue Position #${json.data.position || 1} for ${waitlistModal.childName || 'applicant'}`
        )
        setWaitlistModal({ open: false, applicationId: null, reason: 'NO_SEAT_AVAILABLE', reasonNotes: '', priority: 'NORMAL' })
        loadData()
        if (inspector.open && inspector.formId === waitlistModal.applicationId) {
          openInspector(waitlistModal.applicationId, 'overview')
        }
      } else {
        toast.error('Waitlist action failed', json.error?.message)
      }
    } catch {
      setBusy(false)
      toast.error('Failed to place on waiting list')
    }
  }

  const handleConfirmChangePriority = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!priorityModal.entryId || !priorityModal.reason?.trim()) {
      toast.error('Reason required', 'Auditable justification is required for priority changes')
      return
    }

    setBusy(true)
    try {
      const res = await fetch(`/api/v1/admissions/waitlist/${priorityModal.entryId}/priority`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priority: priorityModal.newPriority,
          reason: priorityModal.reason,
        }),
      })
      const json = await res.json()
      setBusy(false)
      if (json.success) {
        toast.success(`Priority updated to ${priorityModal.newPriority}`, 'Queue positions re-evaluated')
        setPriorityModal({ open: false, entryId: null, newPriority: 'HIGH', reason: '' })
        loadData()
        if (wlInspector.open && wlInspector.entryId === priorityModal.entryId) {
          openWaitlistInspector(priorityModal.entryId)
        }
      } else {
        toast.error('Priority update failed', json.error?.message)
      }
    } catch {
      setBusy(false)
      toast.error('Failed to change priority')
    }
  }

  const handleMarkSeatAvailable = async (entryId: string, childName?: string) => {
    if (!confirm(`Mark seat available for ${childName || 'candidate'}? This triggers an opportunity alert reminding that notification != admission approval.`)) {
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/admissions/waitlist/${entryId}/seat-available`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId: selectedBranchId, academicYearId: selectedSessionId }),
      })
      const json = await res.json()
      setBusy(false)
      if (json.success) {
        toast.success('Seat Opportunity Notified', 'Status updated to SEAT_AVAILABLE. Ready to issue offer.')
        loadData()
        if (wlInspector.open && wlInspector.entryId === entryId) {
          openWaitlistInspector(entryId)
        }
      } else {
        toast.error('Action failed', json.error?.message)
      }
    } catch {
      setBusy(false)
      toast.error('Failed to mark seat available')
    }
  }

  const handleConfirmCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!wlOfferModal.entryId) return
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/admissions/waitlist/${wlOfferModal.entryId}/offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          validDays: wlOfferModal.validDays || 7,
          feePlanId: wlOfferModal.feePlanId || undefined,
          terms: wlOfferModal.terms || undefined,
          branchId: selectedBranchId,
          academicYearId: selectedSessionId,
        }),
      })
      const json = await res.json()
      setBusy(false)
      if (json.success) {
        toast.success('Seat Offer Issued! 📜', `Offer ${json.data.offer?.offerNumber} created with ${wlOfferModal.validDays} days validity`)
        setWlOfferModal({ open: false, entryId: null, validDays: 7, feePlanId: '', terms: '' })
        loadData()
        if (wlInspector.open && wlInspector.entryId === wlOfferModal.entryId) {
          openWaitlistInspector(wlOfferModal.entryId)
        }
      } else {
        toast.error('Failed to issue offer', json.error?.message)
      }
    } catch {
      setBusy(false)
      toast.error('Failed to issue seat offer')
    }
  }

  const handleConfirmParentResponse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!wlResponseModal.entryId) return
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/admissions/waitlist/${wlResponseModal.entryId}/parent-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: wlResponseModal.response,
          notes: wlResponseModal.notes || undefined,
          branchId: selectedBranchId,
          academicYearId: selectedSessionId,
        }),
      })
      const json = await res.json()
      setBusy(false)
      if (json.success) {
        toast.success(
          wlResponseModal.response === 'ACCEPTED' ? 'Parent Accepted Offer! 🎉' : 'Parent Declined Offer',
          wlResponseModal.response === 'ACCEPTED' ? 'Ready for authorized staff approval' : 'Offer marked declined'
        )
        setWlResponseModal({ open: false, entryId: null, response: 'ACCEPTED', notes: '' })
        loadData()
        if (wlInspector.open && wlInspector.entryId === wlResponseModal.entryId) {
          openWaitlistInspector(wlResponseModal.entryId)
        }
      } else {
        toast.error('Failed to record response', json.error?.message)
      }
    } catch {
      setBusy(false)
      toast.error('Failed to record parent response')
    }
  }

  const handleApproveWaitlistAdmission = async (entryId: string, childName?: string) => {
    const notes = prompt(`Enter staff approval notes for ${childName || 'candidate'}:`) || 'Authorized reviewer sign-off from waiting list promotion'
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/admissions/waitlist/${entryId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, branchId: selectedBranchId, academicYearId: selectedSessionId }),
      })
      const json = await res.json()
      setBusy(false)
      if (json.success) {
        toast.success('Admission Formally Approved! ✓', 'Candidate is now ready for classroom allocation and completion.')
        loadData()
        if (wlInspector.open && wlInspector.entryId === entryId) {
          openWaitlistInspector(entryId)
        }
      } else {
        toast.error('Approval failed', json.error?.message)
      }
    } catch {
      setBusy(false)
      toast.error('Failed to approve admission')
    }
  }

  const handleConfirmCompleteAdmission = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!wlCompleteModal.entryId) return
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/admissions/waitlist/${wlCompleteModal.entryId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classroomId: wlCompleteModal.classroomId || undefined,
          branchId: selectedBranchId,
          academicYearId: selectedSessionId,
        }),
      })
      const json = await res.json()
      setBusy(false)
      if (json.success) {
        toast.success('Unified Admission Completed! 🎉', `Student ${json.data.student?.admissionNo} enrolled. Portal initialized.`)
        setWlCompleteModal({ open: false, entryId: null, classroomId: '' })
        loadData()
        if (wlInspector.open) {
          setWlInspector({ open: false, entryId: null, data: null, loading: false, tab: 'overview' })
        }
      } else {
        toast.error('Completion failed', json.error?.message)
      }
    } catch {
      setBusy(false)
      toast.error('Failed to complete admission')
    }
  }

  const handleConfirmWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!wlWithdrawModal.entryId || !wlWithdrawModal.reason?.trim()) {
      toast.error('Reason required', 'Mandatory withdrawal rationale is required')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/admissions/waitlist/${wlWithdrawModal.entryId}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: wlWithdrawModal.reason,
          branchId: selectedBranchId,
          academicYearId: selectedSessionId,
        }),
      })
      const json = await res.json()
      setBusy(false)
      if (json.success) {
        toast.info('Candidate Withdrawn', 'Candidate status updated to WITHDRAWN')
        setWlWithdrawModal({ open: false, entryId: null, reason: '' })
        loadData()
        if (wlInspector.open) {
          setWlInspector({ open: false, entryId: null, data: null, loading: false, tab: 'overview' })
        }
      } else {
        toast.error('Withdrawal failed', json.error?.message)
      }
    } catch {
      setBusy(false)
      toast.error('Failed to withdraw candidate')
    }
  }

  // ── Pipeline & Operational KPI Aggregates ────────────────────────────────
  const pipelineMetrics = useMemo(() => {
    const enqCount = enquiries?.length || 0
    const appCount = applications?.length || 0

    const newEnquiries = enquiries?.filter((e) => e.status === 'NEW').length || 0
    const followupsDue = enquiries?.filter((e) => e.nextFollowUpAt && new Date(e.nextFollowUpAt) <= new Date()).length || 0
    const visitsScheduled = enquiries?.filter((e) => e.status === 'QUALIFIED').length || 0
    const underReview = applications?.filter((a) => ['SUBMITTED', 'UNDER_REVIEW', 'DOCUMENTS_PENDING'].includes(a.status)).length || 0
    const offersAwaitingParent = applications?.filter((a) => a.status === 'OFFER_SENT').length || 0
    const readyForConfirmation = applications?.filter((a) => a.status === 'OFFER_ACCEPTED').length || 0
    const waitlisted = applications?.filter((a) => a.status === 'WAITLISTED').length || 0
    const admissionsCompleted = applications?.filter((a) => ['ENROLLED', 'ADMITTED'].includes(a.status)).length || 0

    // 12-Stage Admissions Journey Counts
    const stageCounts: Record<number, { total: number; pending: number; attention: number }> = {
      1: { total: enquiries?.filter((e) => e.status === 'NEW').length || 0, pending: newEnquiries, attention: newEnquiries > 5 ? 1 : 0 },
      2: { total: enquiries?.filter((e) => e.status === 'CONTACTED').length || 0, pending: followupsDue, attention: followupsDue },
      3: { total: visitsScheduled || enquiries?.filter((e) => e.status === 'QUALIFIED').length || 0, pending: visitsScheduled, attention: 0 },
      4: { total: enquiries?.filter((e) => Boolean(e.childDob)).length || 0, pending: 0, attention: 0 },
      5: { total: applications?.filter((a) => a.status === 'SUBMITTED').length || 0, pending: underReview, attention: 0 },
      6: { total: applications?.filter((a) => (a.documents || []).some((d) => !d.verified && d.status !== 'VERIFIED')).length || 0, pending: underReview, attention: 0 },
      7: { total: applications?.filter((a) => a.status === 'COUNSELLING').length || 0, pending: 0, attention: 0 },
      8: { total: applications?.filter((a) => ['UNDER_REVIEW', 'WAITLISTED'].includes(a.status)).length || 0, pending: waitlisted, attention: waitlisted },
      9: { total: applications?.filter((a) => a.status === 'OFFER_SENT').length || 0, pending: offersAwaitingParent, attention: offersAwaitingParent },
      10: { total: applications?.filter((a) => a.status === 'OFFER_ACCEPTED').length || 0, pending: readyForConfirmation, attention: readyForConfirmation },
      11: { total: readyForConfirmation, pending: readyForConfirmation, attention: readyForConfirmation },
      12: { total: admissionsCompleted, pending: 0, attention: 0 },
    }

    return {
      cards: {
        newEnquiries,
        followupsDue,
        visitsScheduled,
        underReview,
        offersAwaitingParent,
        readyForConfirmation,
        waitlisted,
        admissionsCompleted,
      },
      stageCounts,
    }
  }, [enquiries, applications])

  // ── Lightweight Recent Activity Feed (Derived from live enquiries & applications) ──
  const recentEvents = useMemo(() => {
    const events: { title: string; detail: string; time: string; timestamp: number }[] = []

    if (applications) {
      applications.forEach((app) => {
        if (app.status === 'ENROLLED' || app.status === 'ADMITTED') {
          events.push({
            title: `${app.childFirstName} enrolled in ${app.programType}`,
            detail: 'Admission confirmed · Seat allocated to student',
            time: app.verifiedAt ? fmtDate(app.verifiedAt) : 'Recently',
            timestamp: app.verifiedAt ? new Date(app.verifiedAt).getTime() : Date.now(),
          })
        } else if (app.status === 'OFFER_ACCEPTED') {
          events.push({
            title: `Fee offer accepted for ${app.childFirstName}`,
            detail: 'Parent accepted terms · Ready for staff confirmation',
            time: 'Awaiting final review',
            timestamp: Date.now() - 1800000,
          })
        } else if (app.status === 'OFFER_SENT') {
          events.push({
            title: `Admission offer issued for ${app.childFirstName}`,
            detail: `Formal offer sent to ${app.parentName}`,
            time: fmtDate(app.submittedAt),
            timestamp: new Date(app.submittedAt).getTime(),
          })
        } else {
          const docs = app.documents || []
          events.push({
            title: `Application received for ${app.childFirstName}`,
            detail: `${app.programType} dossier · ${docs.filter((d) => d.verified).length}/${docs.length} verified`,
            time: fmtDate(app.submittedAt),
            timestamp: new Date(app.submittedAt).getTime(),
          })
        }
      })
    }

    if (enquiries) {
      enquiries.forEach((e) => {
        if (e.status === 'QUALIFIED') {
          events.push({
            title: `Campus tour scheduled for ${e.parentName}`,
            detail: `Child: ${e.childName || 'Prospective pupil'} · ${e.interestedProgram || 'Nursery'}`,
            time: e.nextFollowUpAt ? fmtDate(e.nextFollowUpAt) : 'Scheduled',
            timestamp: e.nextFollowUpAt ? new Date(e.nextFollowUpAt).getTime() : Date.now() - 3600000,
          })
        } else if (e.status === 'NEW') {
          events.push({
            title: `New lead enquiry: ${e.parentName}`,
            detail: `Source: ${e.source} · Phone: ${e.phone}`,
            time: fmtDate(e.createdAt),
            timestamp: new Date(e.createdAt).getTime(),
          })
        }
      })
    }

    return events.sort((a, b) => b.timestamp - a.timestamp).slice(0, 6)
  }, [applications, enquiries])

  return (
    <div className="w-full max-w-[1680px] mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5 space-y-4 sm:space-y-5 pb-28">
      {/* ── 1. ADMISSIONS WORKSPACE HEADER (Ambient Background — No giant white box) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="micro-eyebrow">
              ADMISSIONS & ENROLLMENT
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-primary/10 text-primary border border-primary/20">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              M03 Control Plane
            </span>
          </div>
          <h1 className="page-title">
            Admissions
          </h1>
          <p className="page-description">
            Manage enquiries, applications, offers and final admissions from first contact to a bright new beginning.
          </p>
        </div>

        {/* Action Buttons: Equal on mobile, compact on desktop */}
        <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto pt-1 sm:pt-0">
          <button
            type="button"
            className="btn btn-ghost btn-sm h-9 px-3.5 gap-1.5 text-xs font-semibold rounded-xl border border-border/80 hover:bg-muted/50 flex-1 sm:flex-initial justify-center"
            onClick={() => { setCsvType('leads'); setCsvStep(0); setCsvModalOpen(true); }}
          >
            <Download size={14} />
            <span>Import Enquiries</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm h-9 px-4 gap-1.5 text-xs font-semibold rounded-xl shadow-xs flex-1 sm:flex-initial justify-center"
            onClick={() => setEnquiryModal(true)}
          >
            <Plus size={14} />
            <span>+ New Enquiry</span>
          </button>
        </div>
      </div>

      {/* ── 2. CONTEXT COMMAND BAR (Single Compact Row on Desktop) ── */}
      <div className="p-2.5 sm:p-3 rounded-2xl border border-border/80 bg-card/90 backdrop-blur-sm shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 items-center">
          {/* Academic Session */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-background border border-border/60">
            <Calendar size={13} className="text-primary shrink-0" />
            <span className="text-[11px] font-semibold text-muted-foreground shrink-0">Session:</span>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-foreground focus:outline-none w-full cursor-pointer"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.isCurrent ? '★' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Branch */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-background border border-border/60">
            <Building size={13} className="text-primary shrink-0" />
            <span className="text-[11px] font-semibold text-muted-foreground shrink-0">Branch:</span>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-foreground focus:outline-none w-full cursor-pointer"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.isMain ? '(Main Campus)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Program */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-background border border-border/60">
            <Filter size={13} className="text-primary shrink-0" />
            <span className="text-[11px] font-semibold text-muted-foreground shrink-0">Program:</span>
            <select
              value={filterProgram}
              onChange={(e) => setFilterProgram(e.target.value)}
              className="bg-transparent text-xs font-semibold text-foreground focus:outline-none w-full cursor-pointer"
            >
              <option value="">All Programs</option>
              {programs.map((p) => (
                <option key={p.id} value={p.programType || p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search + Refresh */}
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                className="input text-xs pl-7.5 pr-7 h-8.5 rounded-xl bg-background w-full"
                placeholder="Search child, parent, phone, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={loadData}
              disabled={busy}
              className="btn btn-ghost btn-sm h-8.5 w-8.5 p-0 rounded-xl border border-border/60 hover:bg-muted/50 shrink-0"
              title="Refresh admissions records"
            >
              <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. WORKSPACE SEGMENTED NAVIGATION ── */}
      <div className="w-full overflow-x-auto no-scrollbar pb-0.5">
        <div
          role="tablist"
          aria-label="Admissions workspaces"
          className="inline-flex items-center gap-1.5 p-1 rounded-2xl bg-card border border-border/80 shadow-2xs text-xs"
        >
          {NAV_TABS.map((t) => {
            const isActive = tab === t.key
            let count = 0
            if (t.key === 'enquiries') count = enquiries?.length || 0
            else if (t.key === 'followups') count = pipelineMetrics.cards.followupsDue
            else if (t.key === 'applications') count = applications?.length || 0
            else if (t.key === 'waitlist') count = pipelineMetrics.cards.waitlisted
            else if (t.key === 'admissions') count = pipelineMetrics.cards.admissionsCompleted

            const showCount = count > 0 && t.key !== 'overview' && t.key !== 'reports'

            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(t.key)}
                className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
                  isActive
                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium'
                }`}
              >
                <span>{t.label}</span>
                {showCount && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          A. OVERVIEW WORKSPACE (Command Center Dashboard)
      ═══════════════════════════════════════════════════════════════════════ */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {/* ── Section 12 & 13: PRIMARY METRIC + SUPPORTING METRICS STRIP ── */}
          <div className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-card/90 shadow-xs">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              {/* PRIMARY METRIC */}
              <div className="flex items-center gap-4 xl:pr-6 xl:border-r border-border/80 shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">
                  <Layers size={22} />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Admissions Activity
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-baseline gap-2">
                    {(enquiries?.length || 0) + (applications?.length || 0)}
                    <span className="text-xs font-semibold text-muted-foreground">active prospects</span>
                  </div>
                </div>
              </div>

              {/* SUPPORTING METRIC CHIPS (6 Compact Metro Tiles) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 flex-1">
                {[
                  {
                    label: 'New Enquiries',
                    value: pipelineMetrics.cards.newEnquiries,
                    sub: '+2 this week',
                    icon: UserPlus,
                    iconBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
                    targetTab: 'enquiries',
                  },
                  {
                    label: 'Follow-ups Due',
                    value: pipelineMetrics.cards.followupsDue,
                    sub: pipelineMetrics.cards.followupsDue > 0 ? 'Urgent today' : 'Up to date',
                    icon: Clock,
                    iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                    valueColor: pipelineMetrics.cards.followupsDue > 0 ? 'text-amber-600 dark:text-amber-400' : undefined,
                    targetTab: 'followups',
                  },
                  {
                    label: 'Visits Booked',
                    value: pipelineMetrics.cards.visitsScheduled,
                    sub: 'Campus tours',
                    icon: Calendar,
                    iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                    targetTab: 'followups',
                  },
                  {
                    label: 'Under Review',
                    value: pipelineMetrics.cards.underReview,
                    sub: 'Dossiers',
                    icon: ClipboardList,
                    iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
                    targetTab: 'applications',
                  },
                  {
                    label: 'Offers Sent',
                    value: pipelineMetrics.cards.offersAwaitingParent,
                    sub: 'Awaiting parent',
                    icon: Send,
                    iconBg: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
                    targetTab: 'applications',
                  },
                  {
                    label: 'Ready to Enroll',
                    value: pipelineMetrics.cards.readyForConfirmation,
                    sub: pipelineMetrics.cards.readyForConfirmation > 0 ? 'Staff review' : '0 ready',
                    icon: ThumbsUp,
                    iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                    valueColor: pipelineMetrics.cards.readyForConfirmation > 0 ? 'text-emerald-600 dark:text-emerald-400' : undefined,
                    targetTab: 'applications',
                  },
                ].map((m, idx) => {
                  const Icon = m.icon
                  return (
                    <div
                      key={idx}
                      onClick={() => setTab(m.targetTab)}
                      className="p-2.5 sm:p-3 rounded-xl border border-border/70 bg-background/60 hover:bg-background transition-all cursor-pointer group flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
                          {m.label}
                        </span>
                        <div className={`w-5.5 h-5.5 rounded-lg flex items-center justify-center shrink-0 ${m.iconBg}`}>
                          <Icon size={12} />
                        </div>
                      </div>
                      <div className="mt-1">
                        <div className={`text-lg sm:text-xl font-bold tracking-tight ${m.valueColor || 'text-foreground'}`}>
                          {m.value}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {m.sub}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── Section 14 & 17: TWO-COLUMN MAIN OPERATIONAL WORKSPACE (65/35 SPLIT) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* ── LEFT PANEL (~65%): JOURNEY SUMMARY CARD ── */}
            <div className="lg:col-span-8 space-y-5">
              <div className="rounded-2xl border border-border/80 bg-card shadow-xs p-4 sm:p-5 flex flex-col justify-between gap-5">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/80">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                      <Layers size={17} className="text-primary" />
                      <span>Admissions Journey</span>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      From initial enquiry to first day of preschool across 12 canonical milestones
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPipelineModalOpen(true)}
                    className="btn btn-outline btn-sm h-8.5 px-3 rounded-xl gap-1.5 text-xs font-semibold hover:bg-primary/5 hover:text-primary transition-colors"
                  >
                    <span>View Full Journey (12 Stages)</span>
                    <ArrowRight size={13} />
                  </button>
                </div>

                {/* 12-Stage Horizontal Progression Strip */}
                <div>
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center justify-between">
                    <span>Journey Pipeline Health</span>
                    <span className="text-[10px] lowercase text-muted-foreground">click any stage to filter</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2">
                    {ADMISSION_JOURNEY_STAGES.map((s) => {
                      const Icon = s.icon
                      const countInfo = pipelineMetrics.stageCounts[s.step] || { total: 0, pending: 0, attention: 0 }
                      const hasAttention = countInfo.attention > 0
                      const hasItems = countInfo.total > 0

                      const targetTab =
                        s.step === 1 ? 'enquiries' :
                        s.step === 2 || s.step === 3 ? 'followups' :
                        s.step === 4 ? 'enquiries' :
                        s.step >= 5 && s.step <= 11 ? 'applications' :
                        'admissions'

                      return (
                        <div
                          key={s.step}
                          onClick={() => setTab(targetTab)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 group hover:shadow-2xs ${
                            hasAttention
                              ? 'border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10'
                              : hasItems
                              ? 'border-primary/20 bg-primary/5 hover:border-primary/40 hover:bg-primary/10'
                              : 'border-border/70 bg-background/50 hover:bg-background'
                          }`}
                          title={`${s.label}: ${s.desc}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="w-5 h-5 rounded-md bg-background/80 text-[10px] font-mono font-bold text-muted-foreground flex items-center justify-center shrink-0">
                              {s.short}
                            </span>
                            <div className="w-5 h-5 rounded-md flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                              <Icon size={12} />
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] font-bold text-foreground group-hover:text-primary transition-colors truncate">
                              {s.label.replace(/^\d+\s*—\s*/, '')}
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className={`text-xs font-extrabold ${hasAttention ? 'text-amber-600 dark:text-amber-400' : hasItems ? 'text-primary' : 'text-muted-foreground'}`}>
                                {countInfo.total}
                              </span>
                              {hasAttention ? (
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Action required" />
                              ) : hasItems ? (
                                <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Highlighted Next Step Box */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        {pipelineMetrics.cards.readyForConfirmation > 0
                          ? `Classroom Placement: ${pipelineMetrics.cards.readyForConfirmation} candidate(s) ready to enroll`
                          : pipelineMetrics.cards.underReview > 0
                          ? `Document Verification: ${pipelineMetrics.cards.underReview} application(s) awaiting review`
                          : pipelineMetrics.cards.followupsDue > 0
                          ? `Parent Outreach: ${pipelineMetrics.cards.followupsDue} follow-up call(s) due today`
                          : pipelineMetrics.cards.newEnquiries > 0
                          ? `New Leads: ${pipelineMetrics.cards.newEnquiries} fresh enquiries awaiting first contact`
                          : 'Admissions Pipeline Running Smoothly'}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {pipelineMetrics.cards.readyForConfirmation > 0
                          ? 'Parent accepted fee offer. Confirm staff verification and seat allocation to finalize.'
                          : pipelineMetrics.cards.underReview > 0
                          ? 'Dossiers require mandatory certificate checks or age-eligibility validation.'
                          : pipelineMetrics.cards.followupsDue > 0
                          ? 'Engage prospective families to schedule campus tours or answer queries.'
                          : pipelineMetrics.cards.newEnquiries > 0
                          ? 'Review intake notes and initiate introductory parent conversation.'
                          : 'All daily operational bottlenecks and prospective queues are up to date.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (pipelineMetrics.cards.readyForConfirmation > 0 || pipelineMetrics.cards.underReview > 0) {
                        setTab('applications')
                      } else if (pipelineMetrics.cards.followupsDue > 0) {
                        setTab('followups')
                      } else {
                        setTab('enquiries')
                      }
                    }}
                    className="btn btn-primary btn-sm h-8 px-3 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0"
                  >
                    <span>Proceed →</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ── RIGHT PANEL (~35%): ACTION REQUIRED ── */}
            <div className="lg:col-span-4 space-y-5">
              <div className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-border/80 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                      <AlertCircle size={16} className="text-amber-500" />
                      <span>Action Required</span>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Bottlenecks needing attention today
                    </p>
                  </div>
                  {(pipelineMetrics.cards.readyForConfirmation + pipelineMetrics.cards.followupsDue + pipelineMetrics.cards.underReview + pipelineMetrics.cards.offersAwaitingParent) > 0 ? (
                    <span className="badge b-amber text-[10px] font-bold">
                      {pipelineMetrics.cards.readyForConfirmation + pipelineMetrics.cards.followupsDue + pipelineMetrics.cards.underReview + pipelineMetrics.cards.offersAwaitingParent} pending
                    </span>
                  ) : (
                    <span className="badge b-green text-[10px] font-bold">0 pending</span>
                  )}
                </div>

                <div className="p-4 sm:p-5 space-y-3">
                  {/* Task 1: Parent Accepted Offer (Ready for Final Confirmation) */}
                  {pipelineMetrics.cards.readyForConfirmation > 0 && (
                    <div className="p-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          <ThumbsUp size={13} />
                          <span>Parent Accepted Offer</span>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                          {pipelineMetrics.cards.readyForConfirmation} ready
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Fee offer accepted by parent. Allocate classroom section and enroll.
                      </p>
                      <button
                        type="button"
                        onClick={() => setTab('applications')}
                        className="btn btn-sm h-7.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 w-full justify-center"
                      >
                        Confirm & Enroll →
                      </button>
                    </div>
                  )}

                  {/* Task 2: Follow-ups Due */}
                  {pipelineMetrics.cards.followupsDue > 0 && (
                    <div className="p-3 rounded-xl border border-amber-500/25 bg-amber-500/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                          <Clock size={13} />
                          <span>Follow-ups Due Today</span>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300">
                          {pipelineMetrics.cards.followupsDue} due
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Scheduled parent outreach calls or campus tours waiting for response.
                      </p>
                      <button
                        type="button"
                        onClick={() => setTab('followups')}
                        className="btn btn-sm h-7.5 rounded-lg bg-amber-600 text-white font-semibold text-xs hover:bg-amber-700 w-full justify-center"
                      >
                        Open Task Queue →
                      </button>
                    </div>
                  )}

                  {/* Task 3: Under Review */}
                  {pipelineMetrics.cards.underReview > 0 && (
                    <div className="p-3 rounded-xl border border-blue-500/25 bg-blue-500/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-400">
                          <FileCheck2 size={13} />
                          <span>Applications Under Review</span>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-blue-500/20 text-blue-700 dark:text-blue-300">
                          {pipelineMetrics.cards.underReview} pending
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Applicant dossiers awaiting mandatory document checks or principal decision.
                      </p>
                      <button
                        type="button"
                        onClick={() => setTab('applications')}
                        className="btn btn-sm h-7.5 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 w-full justify-center"
                      >
                        Review Dossiers →
                      </button>
                    </div>
                  )}

                  {/* Task 4: Offers Awaiting Parent */}
                  {pipelineMetrics.cards.offersAwaitingParent > 0 && (
                    <div className="p-3 rounded-xl border border-purple-500/25 bg-purple-500/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-400">
                          <Send size={13} />
                          <span>Offers Sent to Parents</span>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-purple-500/20 text-purple-700 dark:text-purple-300">
                          {pipelineMetrics.cards.offersAwaitingParent} sent
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Admission offers issued. Waiting for parent acceptance in portal.
                      </p>
                      <button
                        type="button"
                        onClick={() => setTab('applications')}
                        className="btn btn-sm h-7.5 rounded-lg bg-purple-600 text-white font-semibold text-xs hover:bg-purple-700 w-full justify-center"
                      >
                        View Offers →
                      </button>
                    </div>
                  )}

                  {/* Empty State */}
                  {pipelineMetrics.cards.readyForConfirmation === 0 &&
                    pipelineMetrics.cards.followupsDue === 0 &&
                    pipelineMetrics.cards.underReview === 0 &&
                    pipelineMetrics.cards.offersAwaitingParent === 0 && (
                      <div className="p-5 text-center text-muted-foreground border border-dashed border-border/80 rounded-xl space-y-1.5">
                        <CheckCircle2 size={24} className="text-emerald-500 mx-auto" />
                        <div className="text-xs font-bold text-foreground">All caught up!</div>
                        <p className="text-[11px] leading-relaxed">
                          No urgent bottlenecks blocking progress today.
                        </p>
                      </div>
                    )}
                </div>
              </div>
            </div>
          </div>

          {/* ── SECONDARY OPERATIONAL AREA (3-COLUMN SPLIT) ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* COLUMN 1: Today's Follow-ups & Scheduled Visits */}
            <div className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-4 border-b border-border/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Clock size={14} />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-foreground">
                        Today's Follow-ups & Visits
                      </h4>
                      <p className="text-[10.5px] text-muted-foreground">
                        Campus visits and prospective parent calls
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab('followups')}
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    View All
                  </button>
                </div>

                <div className="p-3 divide-y divide-border/50">
                  {enquiries && enquiries.filter((e) => (e.nextFollowUpAt && new Date(e.nextFollowUpAt) <= new Date()) || e.status === 'QUALIFIED').slice(0, 4).length > 0 ? (
                    enquiries
                      .filter((e) => (e.nextFollowUpAt && new Date(e.nextFollowUpAt) <= new Date()) || e.status === 'QUALIFIED')
                      .slice(0, 4)
                      .map((e) => (
                        <div
                          key={e.id}
                          onClick={() => openLeadInspector(e.id, 'overview')}
                          className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2.5 cursor-pointer group"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                              {e.parentName}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {e.childName ? `Child: ${e.childName}` : e.phone} · <span className="font-medium text-foreground/80">{e.interestedProgram || 'Nursery'}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              e.status === 'QUALIFIED' ? 'bg-blue-500/10 text-blue-600' : 'bg-amber-500/10 text-amber-600'
                            }`}>
                              {e.status === 'QUALIFIED' ? 'Visit' : 'Follow-up'}
                            </span>
                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              {e.nextFollowUpAt ? fmtDate(e.nextFollowUpAt) : 'Today'}
                            </div>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      No follow-ups due right now.
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 bg-muted/20 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setEnquiryModal(true)}
                  className="btn btn-outline btn-sm w-full h-8 text-xs font-semibold rounded-lg gap-1.5 justify-center"
                >
                  <UserPlus size={13} />
                  <span>Log New Follow-up / Enquiry</span>
                </button>
              </div>
            </div>

            {/* COLUMN 2: Applications Requiring Review */}
            <div className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-4 border-b border-border/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <ClipboardList size={14} />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-foreground">
                        Applications Under Review
                      </h4>
                      <p className="text-[10.5px] text-muted-foreground">
                        Dossiers pending document verification
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab('applications')}
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    View All
                  </button>
                </div>

                <div className="p-3 divide-y divide-border/50">
                  {applications && applications.filter((a) => ['SUBMITTED', 'UNDER_REVIEW', 'DOCUMENTS_PENDING'].includes(a.status)).slice(0, 4).length > 0 ? (
                    applications
                      .filter((a) => ['SUBMITTED', 'UNDER_REVIEW', 'DOCUMENTS_PENDING'].includes(a.status))
                      .slice(0, 4)
                      .map((a) => {
                        const docs = a.documents || []
                        const verifiedDocs = docs.filter((d) => d.verified || d.status === 'VERIFIED').length
                        const totalDocs = docs.length
                        return (
                          <div
                            key={a.id}
                            onClick={() => openInspector(a.id, 'documents')}
                            className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2.5 cursor-pointer group"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                                {a.childFirstName} {a.childLastName}
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate">
                                {a.programType} · Parent: {a.parentName}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-600">
                                {verifiedDocs}/{totalDocs} Docs
                              </span>
                              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                {fmtDate(a.submittedAt)}
                              </div>
                            </div>
                          </div>
                        )
                      })
                  ) : (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      No applications waiting for review.
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 bg-muted/20 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setFormModal(true)}
                  className="btn btn-outline btn-sm w-full h-8 text-xs font-semibold rounded-lg gap-1.5 justify-center"
                >
                  <FileText size={13} />
                  <span>New Direct Admission Form</span>
                </button>
              </div>
            </div>

            {/* COLUMN 3: Recent Activity & Shortcuts */}
            <div className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-4 border-b border-border/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                      <Clock size={14} />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-foreground">
                        Recent Activity
                      </h4>
                      <p className="text-[10.5px] text-muted-foreground">
                        Chronological milestone feed
                      </p>
                    </div>
                  </div>
                  <span className="badge b-purple text-[10px]">Live</span>
                </div>

                <div className="p-3 space-y-2.5">
                  {recentEvents.length > 0 ? (
                    recentEvents.slice(0, 4).map((ev, i) => (
                      <div key={i} className="flex items-start justify-between gap-2 text-left">
                        <div className="flex items-start gap-2 min-w-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {ev.title}
                            </p>
                            <p className="text-[10.5px] text-muted-foreground truncate">
                              {ev.detail}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                          {ev.time}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      No recent admissions activity recorded.
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 bg-muted/20 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => { setCsvType('leads'); setCsvStep(0); setCsvModalOpen(true); }}
                  className="btn btn-outline btn-sm w-full h-8 text-xs font-semibold rounded-lg gap-1.5 justify-center"
                >
                  <Download size={13} />
                  <span>Batch Import CSV</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          B. ENQUIRIES WORKSPACE
      ═══════════════════════════════════════════════════════════════════════ */}
      {tab === 'enquiries' && (
        <div className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-border/80 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-foreground">
                Authoritative Enquiries Ledger
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Track initial interest, phone calls, walk-ins, and automated duplicate prevention
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => { setCsvType('leads'); setCsvStep(0); setCsvModalOpen(true); }}
              >
                <Download size={13} /> Import CSV
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setEnquiryModal(true)}
              >
                <Plus size={14} /> + New Enquiry
              </button>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block" style={{ overflowX: 'auto' }}>
            <table className="dtable" style={{ width: '100%', fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th>Enquiry ID</th>
                  <th>Parent / Guardian</th>
                  <th>Phone</th>
                  <th>Child</th>
                  <th>Age</th>
                  <th>Program / Class</th>
                  <th>Lead Source</th>
                  <th>Enquiry Date</th>
                  <th>Next Follow-up</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {enquiries && enquiries.length > 0 ? (
                  enquiries.map((e) => {
                    const childAge = e.childDob ? calculateAgeMonths(e.childDob) : null
                    const hasAgeAdvisory = e.notes?.includes('Age Advisory')
                    return (
                      <tr
                        key={e.id}
                        onClick={() => openLeadInspector(e.id)}
                        className="cursor-pointer hover:bg-muted/40 transition-colors"
                      >
                        <td>
                          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{e.leadNumber}</span>
                          {hasAgeAdvisory && (
                            <span className="ml-1 text-[10px] text-amber-600 font-semibold" title="Age Advisory Flagged">
                              ⚠️
                            </span>
                          )}
                        </td>
                        <td>
                          <FamilyIdentityChip
                            name={e.parentName}
                            email={e.email}
                            phone={e.phone}
                          />
                        </td>
                        <td>
                          <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{e.phone}</span>
                        </td>
                        <td>
                          {e.childName ? (
                            <StudentIdentityChip
                              name={e.childName}
                              subtext={childAge !== null ? `${childAge} mos` : undefined}
                              size="sm"
                            />
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td>{childAge !== null ? `${childAge} mos` : '—'}</td>
                        <td>
                          <span className="badge b-purple">{e.interestedProgram || 'Unassigned'}</span>
                        </td>
                        <td>{e.source}</td>
                        <td>{fmtDate(e.createdAt)}</td>
                        <td>
                          {e.nextFollowUpAt ? (
                            <span style={{ color: new Date(e.nextFollowUpAt) <= new Date() ? 'var(--danger)' : 'var(--text-primary)', fontWeight: 600 }}>
                              {fmtDate(e.nextFollowUpAt)}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td>
                          <StatusPill status={e.status} />
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={(ev) => ev.stopPropagation()}>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => openLeadInspector(e.id)}
                              style={{ padding: '3px 8px', fontSize: 11.5 }}
                              title="Open enquiry inspector"
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => setFollowUpModal({ open: true, enquiry: e, defaultType: 'Phone Call' })}
                              title="Log follow-up"
                              style={{ padding: '3px 8px', fontSize: 11.5 }}
                            >
                              <Phone size={13} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => setVisitModal({ open: true, enquiry: e })}
                              title="Schedule campus visit"
                              style={{ padding: '3px 8px', fontSize: 11.5 }}
                            >
                              <Calendar size={13} />
                            </button>
                            {e.status === 'APPLICATION_STARTED' ? (
                              <button
                                type="button"
                                className="btn btn-outline btn-sm text-primary"
                                onClick={() => {
                                  if (e.convertedApplicationId) openInspector(e.convertedApplicationId)
                                  else setTab('applications')
                                }}
                                style={{ padding: '3px 8px', fontSize: 11.5 }}
                              >
                                View Form
                              </button>
                            ) : e.status === 'CONVERTED' ? (
                              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
                                Enrolled
                              </span>
                            ) : e.status === 'LOST' ? (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm text-muted-foreground text-[11px]"
                                onClick={() => openLeadInspector(e.id)}
                              >
                                Closed
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleConvertEnquiry(e.id)}
                                style={{ padding: '3px 8px', fontSize: 11.5 }}
                              >
                                Start Form
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={11} style={{ padding: 0 }}>
                      <EmptyState
                        illustration="enquiries"
                        eyebrow="Admissions"
                        title={enquirySearch ? `No enquiries match "${enquirySearch}"` : 'No enquiries yet'}
                        description={
                          enquirySearch
                            ? 'Check for spelling mistakes or clear your search to view all enquiries.'
                            : 'Your admissions pipeline is ready. Register your first parent enquiry to begin tracking prospective families.'
                        }
                        action={
                          enquirySearch
                            ? {
                                label: 'Clear Search',
                                onClick: () => setEnquirySearch(''),
                                variant: 'secondary',
                              }
                            : {
                                label: '+ Register First Enquiry',
                                onClick: () => setEnquiryModal(true),
                              }
                        }
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card-Based View (Section 58 Lead Cards) */}
          <div className="sm:hidden p-3 space-y-2.5">
            {enquiries && enquiries.length > 0 ? (
              enquiries.map((e) => {
                const childAge = e.childDob ? calculateAgeMonths(e.childDob) : null
                return (
                  <div
                    key={e.id}
                    onClick={() => openLeadInspector(e.id)}
                    className="p-3.5 rounded-xl border border-border/80 bg-background/80 hover:border-primary/40 transition-all flex flex-col gap-2.5 cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-foreground flex items-center gap-1.5">
                          <span>{e.childName || 'Child Unassigned'}</span>
                          {childAge !== null && (
                            <span className="text-[10px] text-muted-foreground font-normal">({childAge} mos)</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Parent: <strong className="text-foreground">{e.parentName}</strong> · {e.phone}
                        </div>
                      </div>
                      <span className={`badge shrink-0 ${
                        e.status === 'NEW' ? 'b-blue' :
                        e.status === 'CONTACTED' ? 'b-amber' :
                        e.status === 'QUALIFIED' ? 'b-purple' :
                        e.status === 'APPLICATION_STARTED' ? 'b-success' :
                        e.status === 'CONVERTED' ? 'b-success' :
                        e.status === 'LOST' ? 'b-danger' :
                        'b-gray'
                      }`}>
                        {e.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="badge b-purple">{e.interestedProgram || 'Nursery'}</span>
                      <span className="badge b-gray">{e.source}</span>
                      <span className="font-mono">{e.leadNumber}</span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/60">
                      <span className="text-[11px] text-muted-foreground">
                        {e.nextFollowUpAt ? `Next: ${fmtDate(e.nextFollowUpAt)}` : `Captured: ${fmtDate(e.createdAt)}`}
                      </span>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm h-7 px-2.5 text-xs font-semibold rounded-lg"
                        onClick={(ev) => {
                          ev.stopPropagation()
                          openLeadInspector(e.id)
                        }}
                      >
                        OPEN ENQUIRY
                      </button>
                    </div>
                  </div>
                )
              })
            ) : (
              <EmptyState
                compact
                illustration="enquiries"
                eyebrow="Admissions"
                title={enquirySearch ? `No enquiries match "${enquirySearch}"` : 'No enquiries yet'}
                description={
                  enquirySearch
                    ? 'Check for spelling mistakes or clear your search to view all enquiries.'
                    : 'Your admissions pipeline is ready. Register your first parent enquiry to begin tracking prospective families.'
                }
                action={
                  enquirySearch
                    ? {
                        label: 'Clear Search',
                        onClick: () => setEnquirySearch(''),
                        variant: 'secondary',
                      }
                    : {
                        label: '+ Register First Enquiry',
                        onClick: () => setEnquiryModal(true),
                      }
                }
              />
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          C. FOLLOW-UPS & VISITS WORKSPACE
      ═══════════════════════════════════════════════════════════════════════ */}
      {tab === 'followups' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Sub-filter tabs with authoritative counter integration */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              {
                key: 'DUE_TODAY',
                label: 'Due Today',
                count: workspaceVisits?.counts?.dueToday ?? (enquiries?.filter((e) => e.nextFollowUpAt && new Date(e.nextFollowUpAt) <= new Date()).length || 0),
              },
              {
                key: 'OVERDUE',
                label: 'Overdue',
                count: workspaceVisits?.counts?.overdue ?? (enquiries?.filter((e) => e.nextFollowUpAt && new Date(e.nextFollowUpAt) < new Date(Date.now() - 24 * 60 * 60 * 1000)).length || 0),
              },
              {
                key: 'UPCOMING',
                label: 'Upcoming Visits',
                count: workspaceVisits?.counts?.upcomingVisits ?? (enquiries?.filter((e) => e.status === 'QUALIFIED').length || 0),
              },
              {
                key: 'COMPLETED',
                label: 'Completed / History',
                count: workspaceVisits?.counts?.completed ?? (enquiries?.filter((e) => ['CONTACTED', 'APPLICATION_STARTED', 'CONVERTED'].includes(e.status)).length || 0),
              },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                className={`btn btn-sm ${followUpFilter === f.key ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setFollowUpFilter(f.key as any)}
                style={{ borderRadius: 8, fontWeight: 750, display: 'inline-flex', alignItems: 'center' }}
              >
                <span>{f.label}</span>
                <span
                  className="badge"
                  style={{
                    marginLeft: 6,
                    background: followUpFilter === f.key ? '#fff' : 'var(--bg-subtle)',
                    color: followUpFilter === f.key ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: 800,
                  }}
                >
                  {f.count}
                </span>
              </button>
            ))}
          </div>

          {/* Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
            {workspaceVisits?.items && workspaceVisits.items.length > 0 ? (
              workspaceVisits.items.map((item) => {
                const isVisit = item.sourceType === 'SchoolVisit'
                const lead = item.lead
                const detail = item.parsedDetail || {}
                const isResolved = ['RESOLVED', 'CLOSED'].includes(item.status)

                return (
                  <div
                    key={item.id}
                    style={{
                      background: 'var(--surface)',
                      border: isVisit ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid var(--border-default)',
                      borderRadius: 14,
                      padding: 18,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--primary)' }}>
                          {lead?.leadNumber || 'ENQUIRY'}
                        </span>
                        {isVisit ? (
                          <span className="badge b-purple" style={{ fontSize: 11 }}>
                            <Calendar size={11} style={{ marginRight: 4 }} /> School Visit
                          </span>
                        ) : (
                          <span className="badge b-blue" style={{ fontSize: 11 }}>
                            <Phone size={11} style={{ marginRight: 4 }} /> Phone Outreach
                          </span>
                        )}
                      </div>
                      <span className="badge" style={{ fontSize: 11, background: 'var(--bg-subtle)' }}>
                        {lead?.interestedProgram || 'NURSERY'}
                      </span>
                    </div>

                    {/* Prospect Info */}
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                        {lead?.parentName || item.title}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Child: <strong>{lead?.childName || 'Child'}</strong>{' '}
                        {lead?.childDob ? `(${calculateAgeMonths(lead.childDob)} mos)` : ''}
                      </div>
                      {lead?.phone && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                          Contact: <strong>{lead.phone}</strong>
                        </div>
                      )}
                    </div>

                    {/* Schedule / Timing Indicator */}
                    <div
                      style={{
                        background: isVisit ? 'rgba(99, 102, 241, 0.06)' : 'var(--bg-subtle)',
                        borderRadius: 8,
                        padding: 10,
                        fontSize: 12.5,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {isVisit ? 'Visit Scheduled:' : 'Due Date:'}
                        </span>
                        <strong style={{ color: 'var(--text-primary)' }}>
                          {item.dueAt ? new Date(item.dueAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Flexible'}
                        </strong>
                      </div>
                      {isVisit && detail.visitorCount && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Visitors:</span>
                          <span>{detail.visitorCount} ({detail.attendees || 'Parents with Child'})</span>
                        </div>
                      )}
                      {isVisit && detail.tourFocus && (
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                          <b>Tour Focus:</b> {detail.tourFocus}
                        </div>
                      )}
                    </div>

                    {/* Outcome / Observation Summary if Completed */}
                    {isResolved && (
                      <div style={{ background: '#f8fafc', border: '1px solid var(--border-default)', borderRadius: 8, padding: 10, fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontWeight: 750, color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: 11 }}>Outcome:</span>
                          <span className={`badge ${detail.outcome === 'READY_TO_PROCEED' ? 'b-success' : detail.outcome === 'NOT_PROCEEDING' || detail.visitStatus === 'NO_SHOW' ? 'b-danger' : 'b-warning'}`} style={{ fontWeight: 800 }}>
                            {detail.outcome || detail.visitStatus || item.outcome || 'RESOLVED'}
                          </span>
                        </div>
                        {detail.childInteraction && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                            {detail.childInteraction.comfort && <span className="badge" style={{ fontSize: 10.5 }}>Comfort: {detail.childInteraction.comfort}</span>}
                            {detail.childInteraction.educatorInteraction && <span className="badge" style={{ fontSize: 10.5 }}>Educator: {detail.childInteraction.educatorInteraction}</span>}
                            {detail.childInteraction.activityResponse && <span className="badge" style={{ fontSize: 10.5 }}>Activity: {detail.childInteraction.activityResponse}</span>}
                          </div>
                        )}
                        {detail.staffNotes && (
                          <div style={{ color: 'var(--text-primary)', fontStyle: 'italic', fontSize: 11.5 }}>
                            &ldquo;{detail.staffNotes}&rdquo;
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes if open */}
                    {!isResolved && detail.notes && (
                      <div style={{ background: 'var(--bg-subtle)', borderRadius: 8, padding: 8, fontSize: 12, color: 'var(--text-primary)' }}>
                        &ldquo;{detail.notes}&rdquo;
                      </div>
                    )}

                    {/* Operational Action Buttons */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid var(--border-default)', paddingTop: 12, marginTop: 'auto' }}>
                      {lead?.phone && (
                        <>
                          <a href={`tel:${lead.phone}`} className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }} title="Call Parent">
                            <Phone size={13} /> Call
                          </a>
                          <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }} title="Message on WhatsApp">
                            <MessageCircle size={13} /> WhatsApp
                          </a>
                        </>
                      )}

                      {/* Visit Open Actions */}
                      {isVisit && !isResolved && (
                        <>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ fontWeight: 800 }}
                            onClick={() => handleOpenVisitOutcome(item)}
                          >
                            <Award size={13} /> Record Outcome
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => setRescheduleModal({ open: true, visitId: item.id, lead, currentDate: item.dueAt })}
                            title="Reschedule Visit"
                          >
                            Reschedule
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{ color: '#b91c1c' }}
                            onClick={() => handleMarkNoShow(item.id)}
                            title="Mark as No-Show & schedule recovery call"
                          >
                            No-Show
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setCancelVisitModal({ open: true, visitId: item.id, lead })}
                            title="Cancel Visit"
                          >
                            Cancel
                          </button>
                        </>
                      )}

                      {/* General Follow-up Actions */}
                      {!isVisit && !isResolved && lead && (
                        <>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => setFollowUpModal({ open: true, enquiry: lead })}
                          >
                            Log Follow-up
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => setVisitModal({ open: true, enquiry: lead })}
                          >
                            Schedule Visit
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })
            ) : enquiries && enquiries.length > 0 ? (
              // Fallback enquiry list
              enquiries
                .filter((e) => {
                  if (followUpFilter === 'DUE_TODAY') return Boolean(e.nextFollowUpAt && new Date(e.nextFollowUpAt) <= new Date())
                  if (followUpFilter === 'OVERDUE') return Boolean(e.nextFollowUpAt && new Date(e.nextFollowUpAt) < new Date(Date.now() - 24 * 60 * 60 * 1000))
                  if (followUpFilter === 'UPCOMING') return e.status === 'QUALIFIED'
                  return ['CONTACTED', 'APPLICATION_STARTED'].includes(e.status)
                })
                .map((e) => (
                  <div
                    key={e.id}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 14,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11.5, fontWeight: 750, color: 'var(--primary)' }}>{e.leadNumber}</span>
                      <span className="badge b-purple">{e.interestedProgram || 'NURSERY'}</span>
                    </div>

                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{e.parentName}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Child: <strong>{e.childName || 'Child'}</strong> {e.childDob ? `(${calculateAgeMonths(e.childDob)} mos)` : ''}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Phone: <strong>{e.phone}</strong>
                      </div>
                    </div>

                    {e.notes && (
                      <div style={{ background: 'var(--bg-subtle)', borderRadius: 8, padding: 8, fontSize: 12, color: 'var(--text-primary)' }}>
                        &ldquo;{e.notes}&rdquo;
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid var(--border-default)', paddingTop: 10, marginTop: 'auto' }}>
                      <a href={`tel:${e.phone}`} className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>
                        <Phone size={13} /> Call
                      </a>
                      <a href={`https://wa.me/${e.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>
                        <MessageCircle size={13} /> WhatsApp
                      </a>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setFollowUpModal({ open: true, enquiry: e })}
                      >
                        Log Follow-up
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setVisitModal({ open: true, enquiry: e })}
                      >
                        Schedule Visit
                      </button>
                    </div>
                  </div>
                ))
            ) : (
              <div style={{ gridColumn: '1 / -1', padding: 36, textAlign: 'center', color: 'var(--text-secondary)' }}>
                No active follow-ups or visits in this queue.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          D. APPLICATIONS WORKSPACE (Core Operational Ledger)
      ═══════════════════════════════════════════════════════════════════════ */}
      {tab === 'applications' && (
        <div className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-border/80 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-foreground">
                Admission Applications Dossiers
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Authoritative pre-enrollment pipeline with document verification, age checks, offers, and final confirmation
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm h-9 px-3.5 rounded-xl shadow-xs"
              onClick={() => setFormModal(true)}
            >
              <Plus size={14} /> + New Application
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="dtable" style={{ width: '100%', fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th>Application ID</th>
                  <th>Child</th>
                  <th>Parent / Guardian</th>
                  <th>Age</th>
                  <th>Program</th>
                  <th>Documents</th>
                  <th>Status</th>
                  <th>Next Action</th>
                  <th>Updated</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {applications && applications.length > 0 ? (
                  applications.map((app) => {
                    const childAge = calculateAgeMonths(app.childDob)
                    const docs = app.documents || []
                    const verifiedDocs = docs.filter((d) => d.verified || d.status === 'VERIFIED').length
                    const totalDocs = docs.length
                    const nextAct = computeNextAction(app)

                    return (
                      <tr key={app.id} style={{ cursor: 'pointer' }} onClick={() => openInspector(app.id, 'overview')}>
                        <td>
                          <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{app.applicationNumber}</span>
                        </td>
                        <td>
                          <StudentIdentityChip
                            name={`${app.childFirstName} ${app.childLastName || ''}`}
                            subtext={app.childGender}
                            size="sm"
                          />
                        </td>
                        <td>
                          <FamilyIdentityChip
                            name={app.parentName}
                            phone={app.parentPhone}
                          />
                        </td>
                        <td>{childAge !== null ? `${childAge} mos` : '—'}</td>
                        <td>
                          <span className="badge b-purple">{app.programType}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 700 }}>
                              {verifiedDocs}/{totalDocs}
                            </span>
                            {verifiedDocs === totalDocs && totalDocs > 0 ? (
                              <CheckCircle2 size={13} style={{ color: 'var(--success)' }} />
                            ) : (
                              <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--warning)' }} />
                            )}
                          </div>
                        </td>
                        <td>
                          <StatusPill status={app.status} />
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              nextAct.status === 'ACTION REQUIRED'
                                ? 'b-blue'
                                : nextAct.status === 'WAITING FOR PARENT'
                                ? 'b-purple'
                                : nextAct.status === 'BLOCKED'
                                ? 'b-danger'
                                : nextAct.status === 'COMPLETED'
                                ? 'b-success'
                                : 'b-gray'
                            }`}
                            style={{ fontSize: 11, fontWeight: 700 }}
                          >
                            {nextAct.action}
                          </span>
                        </td>
                        <td>{fmtDate(app.submittedAt)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={(e) => { e.stopPropagation(); openInspector(app.id, 'overview'); }}
                            style={{ padding: '3px 8px', fontSize: 11.5 }}
                          >
                            <Eye size={13} /> Open
                          </button>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={10} style={{ padding: 0 }}>
                      <EmptyState
                        illustration="applications"
                        eyebrow="Admissions"
                        title="No applications yet"
                        description="Applications will appear here when prospective parents progress from enquiry to formal registration."
                        action={{
                          label: 'View Enquiries Pipeline',
                          onClick: () => setTab('pipeline'),
                          variant: 'secondary',
                        }}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          E. WAITING LIST WORKSPACE (M03.4 Deterministic Queue & Capacity Management)
      ═══════════════════════════════════════════════════════════════════════ */}
      {tab === 'waitlist' && (
        <div className="space-y-4">
          {/* 1. REAL-TIME PROGRAM CAPACITY SUMMARY STRIP */}
          <div className="rounded-2xl border border-border/80 bg-card/90 backdrop-blur-sm p-4 sm:p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground">
                    Classroom Capacity & Seat Availability
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-primary/10 text-primary border border-primary/20">
                    Live Engine
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Real-time seat vacancy across branch classrooms. Click a program tile to quickly filter the waiting list.
                </p>
              </div>
              <div className="text-xs text-muted-foreground font-medium">
                Branch: <strong>{branches.find((b) => b.id === selectedBranchId)?.name || 'Selected Branch'}</strong>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {waitlistCapacities && waitlistCapacities.length > 0 ? (
                waitlistCapacities.map((cap: any) => {
                  const isFiltered = filterProgram === cap.programType
                  const isFull = cap.available === 0
                  return (
                    <div
                      key={cap.programType}
                      onClick={() => setFilterProgram(isFiltered ? '' : cap.programType)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                        isFiltered
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                          : 'border-border/80 bg-card hover:border-primary/50 hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="badge b-purple font-bold text-xs">{cap.programType}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10.5px] font-extrabold ${
                            isFull
                              ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 animate-pulse'
                          }`}
                        >
                          {isFull ? '0 Seats (Full)' : `${cap.available} Available`}
                        </span>
                      </div>

                      <div className="mt-2.5 flex items-baseline justify-between text-xs">
                        <span className="text-muted-foreground">Classroom Capacity:</span>
                        <span className="font-bold text-foreground">
                          {cap.occupied} / {cap.capacity} seats
                        </span>
                      </div>

                      {/* Capacity Progress Bar */}
                      <div className="mt-1.5 w-full h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isFull ? 'bg-amber-500' : 'bg-primary'
                          }`}
                          style={{
                            width: `${Math.min(100, Math.round(((cap.occupied || 0) / Math.max(1, cap.capacity || 1)) * 100))}%`,
                          }}
                        />
                      </div>

                      <div className="mt-2 pt-2 border-t border-border/60 flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Users size={12} className="text-primary" /> Active Waitlist:
                        </span>
                        <span className="font-extrabold text-primary">
                          {cap.activeWaitlistCount} in queue
                        </span>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="col-span-full py-4 text-center text-xs text-muted-foreground">
                  No classroom capacity data configured for this branch and academic session.
                </div>
              )}
            </div>
          </div>

          {/* 2. WAITING LIST CONTROLS & LEDGER */}
          <div className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden">
            {/* Filter and Command Strip */}
            <div className="p-4 sm:p-5 border-b border-border/80 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground">
                    Deterministic FIFO Waiting List Ledger
                  </h3>
                  <span className="badge b-blue font-bold text-[11px]">
                    {waitlistEntries.length} Candidates
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  High priority candidates are strictly ranked ahead of Normal priority; within each tier, FIFO timestamp enforces fair seat progression.
                </p>
              </div>

              {/* Sub-Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Priority Filter */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-background border border-border/60 text-xs">
                  <span className="text-[11px] font-semibold text-muted-foreground">Priority:</span>
                  <select
                    value={wlPriorityFilter}
                    onChange={(e) => setWlPriorityFilter(e.target.value as any)}
                    className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">All Priorities</option>
                    <option value="NORMAL">Normal Priority</option>
                    <option value="HIGH">High Priority Only</option>
                  </select>
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-background border border-border/60 text-xs">
                  <span className="text-[11px] font-semibold text-muted-foreground">Status:</span>
                  <select
                    value={wlStatusFilter}
                    onChange={(e) => setWlStatusFilter(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">In Queue (Active)</option>
                    <option value="SEAT_AVAILABLE">Seat Available</option>
                    <option value="OFFER_SENT">Offer Sent</option>
                    <option value="PARENT_ACCEPTED">Parent Accepted</option>
                    <option value="READY_FOR_ADMISSION">Ready for Admission</option>
                    <option value="CONVERTED">Enrolled / Converted</option>
                    <option value="WITHDRAWN">Withdrawn</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Waiting List Table */}
            <div style={{ overflowX: 'auto' }}>
              <table className="dtable" style={{ width: '100%', fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>Queue #</th>
                    <th>Priority</th>
                    <th>Application & Child</th>
                    <th>Parent / Contact</th>
                    <th>Program</th>
                    <th>Waiting Since</th>
                    <th>Mandatory Reason</th>
                    <th>Status</th>
                    <th>Primary Next Action</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {waitlistEntries && waitlistEntries.length > 0 ? (
                    waitlistEntries.map((entry) => {
                      const isHigh = entry.priority === 'HIGH'
                      const isConverted = entry.status === 'CONVERTED'
                      const isWithdrawn = entry.status === 'WITHDRAWN' || entry.status === 'OFFER_DECLINED'

                      return (
                        <tr
                          key={entry.id}
                          className="hover:bg-muted/40 transition-colors cursor-pointer"
                          onClick={() => openWaitlistInspector(entry.id)}
                        >
                          {/* Queue Position */}
                          <td>
                            {entry.queuePosition > 0 ? (
                              <span
                                className={`inline-flex items-center justify-center font-black px-2 py-0.5 rounded-lg text-xs ${
                                  isHigh
                                    ? 'bg-purple-600 text-white shadow-xs ring-2 ring-purple-300 dark:ring-purple-900'
                                    : 'bg-primary/10 text-primary font-bold'
                                }`}
                              >
                                #{entry.queuePosition < 10 ? `0${entry.queuePosition}` : entry.queuePosition}
                              </span>
                            ) : (
                              <span className="text-muted-foreground font-mono text-[11px]">
                                {isConverted ? 'Enrolled' : isWithdrawn ? 'Closed' : 'Offer Phase'}
                              </span>
                            )}
                          </td>

                          {/* Priority Badge */}
                          <td>
                            {isHigh ? (
                              <span className="badge b-purple font-extrabold gap-1 text-[11px] shadow-2xs">
                                ★ HIGH
                              </span>
                            ) : (
                              <span className="badge b-gray text-[11px]">Normal</span>
                            )}
                          </td>

                          {/* Application & Child */}
                          <td>
                            <StudentIdentityChip
                              name={`${entry.childFirstName} ${entry.childLastName || ''}`}
                              subtext={entry.application?.applicationNumber || undefined}
                              size="sm"
                            />
                          </td>

                          {/* Parent & Contact */}
                          <td>
                            <FamilyIdentityChip
                              name={entry.parentName}
                              phone={entry.parentPhone}
                            />
                          </td>

                          {/* Program */}
                          <td>
                            <span className="badge b-purple">{entry.programType}</span>
                          </td>

                          {/* Waiting Since */}
                          <td>
                            <div className="text-xs font-medium text-foreground">
                              {fmtDate(entry.waitingSince || entry.createdAt)}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              {Math.max(0, Math.floor((Date.now() - new Date(entry.waitingSince || entry.createdAt).getTime()) / (1000 * 60 * 60 * 24)))} days waiting
                            </div>
                          </td>

                          {/* Reason */}
                          <td>
                            <div className="text-xs font-semibold text-foreground">
                              {entry.reason === 'NO_SEAT_AVAILABLE'
                                ? 'No Seat Available'
                                : entry.reason === 'PARENT_REQUESTED_LATER'
                                ? 'Parent Requested Later'
                                : entry.reason === 'FUTURE_TERM'
                                ? 'Future Term Admission'
                                : entry.reason === 'PROGRAM_CAPACITY'
                                ? 'Program Capacity Reached'
                                : 'Other Ground'}
                            </div>
                            {entry.reasonNotes && (
                              <div className="text-[11px] text-muted-foreground truncate max-w-[180px]" title={entry.reasonNotes}>
                                {entry.reasonNotes}
                              </div>
                            )}
                          </td>

                          {/* Status Badge */}
                          <td>
                            <StatusPill
                              status={
                                entry.status === 'SEAT_AVAILABLE'
                                  ? 'READY'
                                  : entry.status === 'ACTIVE'
                                  ? 'WAITLISTED'
                                  : entry.status === 'CONVERTED'
                                  ? 'ENROLLED'
                                  : entry.status === 'OFFER_DECLINED' || entry.status === 'WITHDRAWN'
                                  ? 'WITHDRAWN'
                                  : entry.status
                              }
                              label={
                                entry.status === 'ACTIVE'
                                  ? 'In Queue'
                                  : entry.status === 'SEAT_AVAILABLE'
                                  ? 'Seat Available'
                                  : entry.status === 'OFFER_SENT'
                                  ? 'Offer Sent'
                                  : entry.status === 'PARENT_ACCEPTED'
                                  ? 'Parent Accepted'
                                  : entry.status === 'READY_FOR_ADMISSION'
                                  ? 'Ready to Admit'
                                  : entry.status === 'CONVERTED'
                                  ? 'Enrolled'
                                  : entry.status === 'OFFER_DECLINED'
                                  ? 'Declined'
                                  : 'Withdrawn'
                              }
                            />
                          </td>

                          {/* Primary Next Action */}
                          <td>
                            {entry.status === 'ACTIVE' ? (
                              <span className="text-xs font-semibold text-blue-600">
                                Awaiting Seat / Review
                              </span>
                            ) : entry.status === 'SEAT_AVAILABLE' ? (
                              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                                <Sparkles size={12} /> Issue Seat Offer
                              </span>
                            ) : entry.status === 'OFFER_SENT' ? (
                              <span className="text-xs font-semibold text-purple-600 flex items-center gap-1">
                                <Clock size={12} /> Awaiting Parent Acceptance
                              </span>
                            ) : entry.status === 'PARENT_ACCEPTED' ? (
                              <span className="text-xs font-bold text-teal-600 flex items-center gap-1">
                                <CheckCircle2 size={12} /> Authorized Approval Due
                              </span>
                            ) : entry.status === 'READY_FOR_ADMISSION' ? (
                              <span className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                                <Award size={12} /> Complete Unified Admission
                              </span>
                            ) : entry.status === 'CONVERTED' ? (
                              <span className="text-xs font-semibold text-emerald-700">
                                Student STU-{entry.studentId ? entry.studentId.slice(-4) : 'Enrolled'}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Closed</span>
                            )}
                          </td>

                          {/* Quick Actions */}
                          <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                className="btn btn-outline btn-sm h-7.5 px-2 text-[11px] font-semibold"
                                onClick={() => openWaitlistInspector(entry.id)}
                              >
                                <Eye size={12} /> Inspector
                              </button>

                              {entry.status === 'ACTIVE' && (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm h-7.5 px-2 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => handleMarkSeatAvailable(entry.id, entry.childFirstName)}
                                  title="Notify parent of seat opportunity (Notification != Admission Approval)"
                                >
                                  Seat Available
                                </button>
                              )}

                              {entry.status === 'SEAT_AVAILABLE' && (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm h-7.5 px-2 text-[11px] font-bold"
                                  onClick={() =>
                                    setWlOfferModal({
                                      open: true,
                                      entryId: entry.id,
                                      childName: entry.childFirstName,
                                      validDays: 7,
                                      feePlanId: selectedFeePlanId || '',
                                      terms: `Seat offer for ${entry.programType} from Waiting List promotion.`,
                                    })
                                  }
                                >
                                  Create Offer
                                </button>
                              )}

                              {entry.status === 'OFFER_SENT' && (
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm h-7.5 px-2 text-[11px] font-bold text-purple-600 border-purple-200 hover:bg-purple-50"
                                  onClick={() =>
                                    setWlResponseModal({
                                      open: true,
                                      entryId: entry.id,
                                      childName: entry.childFirstName,
                                      response: 'ACCEPTED',
                                      notes: '',
                                    })
                                  }
                                >
                                  Record Response
                                </button>
                              )}

                              {entry.status === 'PARENT_ACCEPTED' && (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm h-7.5 px-2 text-[11px] font-bold bg-teal-600 hover:bg-teal-700"
                                  onClick={() => handleApproveWaitlistAdmission(entry.id, entry.childFirstName)}
                                >
                                  Approve
                                </button>
                              )}

                              {entry.status === 'READY_FOR_ADMISSION' && (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm h-7.5 px-2.5 text-[11px] font-extrabold shadow-xs"
                                  onClick={() => {
                                    const matchingClass = classrooms.find(
                                      (c) => c.programType === entry.programType
                                    )
                                    setWlCompleteModal({
                                      open: true,
                                      entryId: entry.id,
                                      childName: entry.childFirstName,
                                      programType: entry.programType,
                                      classroomId: matchingClass?.id || '',
                                    })
                                  }}
                                >
                                  Complete Admission
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} style={{ padding: 0 }}>
                        <EmptyState
                          illustration="waitinglist"
                          eyebrow="Admissions"
                          title="Waiting list is empty"
                          description="There are currently no applicants on the waiting list. Candidates enter the waiting list when classroom capacity is full or when admission is deferred."
                          compact
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          F. ADMITTED STUDENTS WORKSPACE (Admissions Completion Ledger)
      ═══════════════════════════════════════════════════════════════════════ */}
      {tab === 'admissions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* 1. ELIGIBLE CANDIDATES QUEUE (Candidates ready for Classroom Placement) */}
          <div className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border/80 flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground">
                    Candidates Ready for Classroom Placement
                  </h3>
                  <span className="badge b-purple font-bold">
                    {applications ? applications.filter((a) => ['OFFER_ACCEPTED', 'APPROVED'].includes(a.status) && !a.studentId).length : 0} Candidates
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Approved candidates with accepted offers ready for seat allocation, automatic teacher resolution, and canonical student creation
                </p>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="dtable" style={{ width: '100%', fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th>Application ID</th>
                    <th>Candidate Child</th>
                    <th>Parent / Contact</th>
                    <th>Program</th>
                    <th>Stage & Status</th>
                    <th>Offer Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {applications && applications.filter((a) => ['OFFER_ACCEPTED', 'APPROVED'].includes(a.status) && !a.studentId).length > 0 ? (
                    applications
                      .filter((a) => ['OFFER_ACCEPTED', 'APPROVED'].includes(a.status) && !a.studentId)
                      .map((app) => (
                        <tr key={app.id}>
                          <td>
                            <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{app.applicationNumber}</span>
                          </td>
                          <td>
                            <strong>{app.childFirstName} {app.childLastName || ''}</strong>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Age: {calculateAgeMonths(app.childDob)} mos</div>
                          </td>
                          <td>
                            <div>{app.parentName}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{app.parentPhone}</div>
                          </td>
                          <td>
                            <span className="badge b-purple">{app.programType}</span>
                          </td>
                          <td>
                            <span className="badge b-amber font-bold">
                              {app.status === 'OFFER_ACCEPTED' ? '✓ OFFER ACCEPTED' : '✓ APPROVED'}
                            </span>
                          </td>
                          <td>
                            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                              <CheckCircle2 size={12} /> Ready for Placement
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => openInspector(app.id, 'allocation')}
                              style={{ padding: '4px 10px', fontSize: 11.5, fontWeight: 700 }}
                            >
                              <Building size={12} className="mr-1 inline" /> Place in Classroom
                            </button>
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ padding: '32px 16px' }}>
                        <EmptyState
                          illustration="classroom"
                          eyebrow="Classrooms"
                          title="No candidates waiting for placement"
                          description="All approved candidates with accepted offers have already been allocated to classrooms."
                          compact
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. ADMITTED STUDENTS COMPLETION LEDGER */}
          <div className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border/80">
              <h3 className="text-base font-bold text-foreground">
                Classroom Placements & Completed Admissions Ledger
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Completed admissions with connected Student records, Parent portal accounts, and initial Fee Invoices
              </p>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="dtable" style={{ width: '100%', fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th>Application ID</th>
                    <th>Child / Student</th>
                    <th>Parent / Guardian</th>
                    <th>Program</th>
                    <th>Status</th>
                    <th>Enrolled On</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {applications && applications.filter((a) => ['ENROLLED', 'ADMITTED'].includes(a.status)).length > 0 ? (
                    applications
                      .filter((a) => ['ENROLLED', 'ADMITTED'].includes(a.status))
                      .map((app) => (
                        <tr key={app.id}>
                          <td>
                            <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{app.applicationNumber}</span>
                          </td>
                          <td>
                            <strong>{app.childFirstName} {app.childLastName || ''}</strong>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Age: {calculateAgeMonths(app.childDob)} mos</div>
                          </td>
                          <td>
                            <div>{app.parentName}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{app.parentPhone}</div>
                          </td>
                          <td>
                            <span className="badge b-purple">{app.programType}</span>
                          </td>
                          <td>
                            <span className="badge b-success">✓ ENROLLED</span>
                          </td>
                          <td>{fmtDate(app.verifiedAt || app.submittedAt)}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => openInspector(app.id, 'timeline')}
                                style={{ padding: '3px 8px', fontSize: 11.5 }}
                              >
                                <History size={12} /> Admission History
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => { window.location.href = `/app/students` }}
                                style={{ padding: '3px 8px', fontSize: 11.5 }}
                              >
                                <GraduationCap size={12} /> Student 360
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => { window.location.href = `/app/users` }}
                                style={{ padding: '3px 8px', fontSize: 11.5 }}
                              >
                                <Users size={12} /> Family
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => { window.location.href = `/app/finance` }}
                                style={{ padding: '3px 8px', fontSize: 11.5 }}
                              >
                                <DollarSign size={12} /> Fees
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ padding: '32px 16px' }}>
                        <EmptyState
                          illustration="students"
                          eyebrow="Admissions Ledger"
                          title="No completed admissions yet"
                          description="Once candidates complete their offer acceptance and fee settlement, their enrollment ledger records will appear here."
                          compact
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          G. REPORTS WORKSPACE (CRM Analytics & Conversion Funnel)
      ═══════════════════════════════════════════════════════════════════════ */}
      {tab === 'reports' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-6 shadow-xs">
            <h3 className="text-base font-bold text-foreground">
              Admissions Conversion Funnel
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 mb-4">
              Conversion rates across the 9 stages of the canonical journey
            </p>

            <FunnelChart
              data={[
                { label: 'Enquiries', value: enquiries?.length || 0 },
                { label: 'Followed Up', value: enquiries?.filter((e) => e.status !== 'NEW').length || 0 },
                { label: 'Campus Visits', value: enquiries?.filter((e) => e.status === 'QUALIFIED').length || 0 },
                { label: 'Applications', value: applications?.length || 0 },
                { label: 'Approved', value: applications?.filter((a) => ['APPROVED', 'OFFER_SENT', 'OFFER_ACCEPTED', 'ENROLLED'].includes(a.status)).length || 0 },
                { label: 'Offers Sent', value: applications?.filter((a) => ['OFFER_SENT', 'OFFER_ACCEPTED', 'ENROLLED'].includes(a.status)).length || 0 },
                { label: 'Parent Accepted', value: applications?.filter((a) => ['OFFER_ACCEPTED', 'ENROLLED'].includes(a.status)).length || 0 },
                { label: 'Enrolled Students', value: applications?.filter((a) => ['ENROLLED', 'ADMITTED'].includes(a.status)).length || 0 },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {/* Program Breakdown */}
            <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs">
              <h4 className="text-sm font-bold text-foreground mb-3">Program Distribution</h4>
              <div className="divide-y divide-border/60">
                {programs.map((p) => {
                  const count = applications?.filter((a) => a.programType === p.programType).length || 0
                  return (
                    <div key={p.id} className="flex items-center justify-between py-2 text-xs">
                      <span className="font-medium text-foreground">{p.name}</span>
                      <strong className="text-muted-foreground font-mono">{count} applications</strong>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Lead Sources */}
            <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs">
              <h4 className="text-sm font-bold text-foreground mb-3">Lead Sources</h4>
              <div className="divide-y divide-border/60">
                {['WALK_IN', 'PHONE', 'WEBSITE', 'REFERRAL', 'SOCIAL_MEDIA'].map((src) => {
                  const count = enquiries?.filter((e) => e.source === src).length || 0
                  return (
                    <div key={src} className="flex items-center justify-between py-2 text-xs">
                      <span className="font-medium text-foreground">{src.replace(/_/g, ' ')}</span>
                      <strong className="text-muted-foreground font-mono">{count} leads</strong>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          APPLICATION INSPECTOR DRAWER (Right Sliding Flyout Modal)
      ═══════════════════════════════════════════════════════════════════════ */}
      {inspector.open && (
        <div className="adm-drawer-backdrop" onClick={() => setInspector({ open: false, formId: null, data: null, tab: 'overview' })}>
          <div
            className="adm-drawer-panel"
            ref={drawerPanelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Application Inspector"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(900px, 94vw)' }}
          >
            {/* Drawer Header */}
            <div className="adm-drawer-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.05em' }}>
                    ADMISSION DOSSIER
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>·</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {inspector.data?.application.applicationNumber}
                  </span>
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 0' }}>
                  {inspector.data?.application.childFirstName} {inspector.data?.application.childLastName || ''}
                </h2>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Parent: <strong>{inspector.data?.application.parentName}</strong> ({inspector.data?.application.parentPhone}) · Program: <span className="badge b-purple">{inspector.data?.application.programType}</span>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setInspector({ open: false, formId: null, data: null, tab: 'overview' })}
                style={{ width: 32, height: 32, borderRadius: 8 }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Horizontal 9-Stage Admission Journey Indicator */}
            {inspector.data && (
              <div style={{ padding: '12px 20px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-default)', overflowX: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 720 }}>
                  {ADMISSION_JOURNEY_STAGES.map((st, idx) => {
                    const currentStageNumber =
                      inspector.data?.application.status === 'ENROLLED' ? 9 :
                      inspector.data?.application.status === 'OFFER_ACCEPTED' ? 8 :
                      inspector.data?.application.status === 'OFFER_SENT' ? 6 :
                      inspector.data?.application.status === 'APPROVED' ? 6 :
                      inspector.data?.application.status === 'WAITLISTED' ? 5 :
                      inspector.data?.requirements.documentsCheck.isComplete ? 5 : 4

                    const isPast = st.step < currentStageNumber
                    const isCurrent = st.step === currentStageNumber

                    return (
                      <React.Fragment key={st.step}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 8px',
                            borderRadius: 6,
                            background: isCurrent ? 'var(--primary)' : isPast ? 'var(--success-soft)' : 'transparent',
                            color: isCurrent ? '#fff' : isPast ? 'var(--success)' : 'var(--text-muted)',
                            fontWeight: isCurrent ? 800 : 600,
                            fontSize: 11,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <span style={{ width: 16, height: 16, borderRadius: 999, background: isCurrent ? '#fff' : isPast ? 'var(--success)' : 'var(--border-default)', color: isCurrent ? 'var(--primary)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>
                            {isPast ? '✓' : st.step}
                          </span>
                          <span>{st.label}</span>
                        </div>
                        {idx < ADMISSION_JOURNEY_STAGES.length - 1 && (
                          <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        )}
                      </React.Fragment>
                    )
                  })}
                </div>
              </div>
            )}

            {/* The 4 Core Questions Banner */}
            {inspector.data && (() => {
              const nextAct = computeNextAction(inspector.data.application, inspector.data.requirements)
              return (
                <div style={{
                  padding: '12px 20px',
                  background: nextAct.isBlocked
                    ? '#FEF2F2'
                    : nextAct.status === 'COMPLETED'
                    ? '#F0FDF4'
                    : '#F8FAFC',
                  borderBottom: '1px solid var(--border-default)',
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 750, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        1. Where are we?
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: nextAct.isBlocked ? 'var(--danger)' : 'var(--text-primary)', marginTop: 2 }}>
                        {nextAct.whereAreWe}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 750, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        2. What happened?
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.3 }}>
                        {nextAct.whatHappened}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 750, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        3. What needs to happen now?
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-primary)', marginTop: 2, lineHeight: 1.3 }}>
                        {nextAct.whatNeedsToHappen}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}>
                      <div style={{ fontSize: 10.5, fontWeight: 750, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: 4 }}>
                        4. What should I click?
                      </div>
                      {nextAct.primaryActionType === 'START_FINAL_REVIEW' ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ fontWeight: 800, padding: '5px 12px', fontSize: 12 }}
                          onClick={() => setInspector((prev) => ({ ...prev, tab: 'final_confirmation' }))}
                        >
                          <Sparkles size={13} /> START FINAL REVIEW
                        </button>
                      ) : nextAct.primaryActionType === 'VERIFY_DOCUMENTS' ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ fontWeight: 800, padding: '5px 12px', fontSize: 12 }}
                          onClick={() => setInspector((prev) => ({ ...prev, tab: 'documents' }))}
                        >
                          <FileCheck2 size={13} /> VERIFY DOCUMENTS
                        </button>
                      ) : nextAct.primaryActionType === 'CREATE_FEE_OFFER' ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ fontWeight: 800, padding: '5px 12px', fontSize: 12 }}
                          onClick={() => setInspector((prev) => ({ ...prev, tab: 'decision_offer' }))}
                        >
                          <Send size={13} /> CREATE FEE OFFER
                        </button>
                      ) : nextAct.primaryActionType === 'REVIEW_APPLICATION' ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ fontWeight: 800, padding: '5px 12px', fontSize: 12 }}
                          onClick={() => setInspector((prev) => ({ ...prev, tab: 'decision_offer' }))}
                        >
                          <ClipboardList size={13} /> REVIEW APPLICATION
                        </button>
                      ) : nextAct.primaryActionType === 'VIEW_STUDENT' ? (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ fontWeight: 800, padding: '5px 12px', fontSize: 12 }}
                          onClick={() => { window.location.href = '/app/students' }}
                        >
                          <Eye size={13} /> VIEW STUDENT
                        </button>
                      ) : (
                        <span className="badge b-gray" style={{ padding: '4px 8px', fontSize: 11.5 }}>
                          {nextAct.whatShouldIClick}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Drawer Sub-tabs (8 Functional Workspaces) */}
            {inspector.data && (
              <div className="adm-drawer-subtabs">
                {[
                  { key: 'overview', label: 'Overview' },
                  { key: 'child_family', label: 'Child & Family' },
                  { key: 'application', label: 'Application' },
                  { key: 'documents', label: `Documents (${inspector.data.requirements.documentsCheck.verified}/${inspector.data.requirements.documentsCheck.total})` },
                  { key: 'followup_visit', label: 'Follow-up & Visit' },
                  { key: 'decision_offer', label: 'Decision & Offer' },
                  { key: 'final_confirmation', label: 'Final Confirmation' },
                  { key: 'timeline', label: 'Timeline' },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`adm-drawer-subtab-btn ${inspector.tab === t.key ? 'is-active' : ''}`}
                    onClick={() => setInspector((prev) => ({ ...prev, tab: t.key }))}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {/* Drawer Body Content */}
            <div className="adm-drawer-body">
              {inspector.data && (
                <>
                  {/* TAB 1: OVERVIEW */}
                  {inspector.tab === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>Current Status</div>
                          <div style={{ marginTop: 4 }}><StatusBadge status={inspector.data.application.status} /></div>
                        </div>

                        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>Submitted Date</div>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                            {fmtDate(inspector.data.application.submittedAt || new Date().toISOString())}
                          </div>
                        </div>

                        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>Classroom Allocation</div>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                            {inspector.data.application.classroomId ? 'Allocated' : 'Pending Allocation'}
                          </div>
                        </div>
                      </div>

                      {/* Quick Cards: Child, Parent, Documents, Offer */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 14 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>Child</div>
                          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>
                            {inspector.data.application.childFirstName} {inspector.data.application.childLastName || ''}
                          </div>
                          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                            Age: {inspector.data.requirements.ageRequirement.ageMonths} months ({inspector.data.application.childGender})
                          </div>
                        </div>

                        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 14 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>Primary Parent</div>
                          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>
                            {inspector.data.application.parentName}
                          </div>
                          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {inspector.data.application.parentPhone} · {inspector.data.application.parentEmail || 'No email'}
                          </div>
                        </div>
                      </div>

                      {inspector.data.application.notes && (
                        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 14 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>
                            Admission Notes
                          </div>
                          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-line' }}>
                            {inspector.data.application.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: CHILD & FAMILY */}
                  {inspector.tab === 'child_family' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {/* Section A: Child Master Info */}
                      <div>
                        <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                          Child Profile
                        </h4>
                        <div className="form-grid">
                          <div className="field">
                            <label>Child Full Name</label>
                            <input className="input" readOnly value={`${inspector.data.application.childFirstName} ${inspector.data.application.childLastName || ''}`.trim()} />
                          </div>
                          <div className="field">
                            <label>Date of Birth</label>
                            <input className="input" readOnly value={fmtDate(inspector.data.application.childDob)} />
                          </div>
                          <div className="field">
                            <label>Calculated Age</label>
                            <input className="input" readOnly value={`${inspector.data.requirements.ageRequirement.ageMonths} months`} />
                          </div>
                          <div className="field">
                            <label>Gender</label>
                            <input className="input" readOnly value={inspector.data.application.childGender} />
                          </div>
                          <div className="field">
                            <label>Previous School</label>
                            <input className="input" readOnly value={inspector.data.application.previousSchool || 'None'} />
                          </div>
                        </div>
                      </div>

                      {/* Section B: Parent & Family IAM */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                            Parent & Family Relationships
                          </h4>
                          <span className="badge b-purple" style={{ fontSize: 11 }}>
                            Max 2 Parents Rule Enforced
                          </span>
                        </div>

                        {/* Sibling Detection Banner */}
                        {inspector.data.requirements.siblingConcession.hasSibling && (
                          <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, padding: 10, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                            <div style={{ fontSize: 12.5, color: '#065F46' }}>
                              <strong>Existing Family Found!</strong> Sibling already enrolled: {inspector.data.requirements.siblingConcession.existingChildren.map((c) => `${c.name} (${c.classroom})`).join(', ')}. Parent account will be reused automatically.
                            </div>
                          </div>
                        )}

                        <div className="form-grid">
                          <div className="field">
                            <label>Primary Parent / Guardian</label>
                            <input className="input" readOnly value={inspector.data.application.parentName} />
                          </div>
                          <div className="field">
                            <label>Phone Number</label>
                            <input className="input" readOnly value={inspector.data.application.parentPhone} />
                          </div>
                          <div className="field">
                            <label>Email Address</label>
                            <input className="input" readOnly value={inspector.data.application.parentEmail || '—'} />
                          </div>
                        </div>

                        {/* Max 2 Parents policy notice */}
                        <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                          <strong>PreOne Family Policy:</strong> A child can have up to 2 primary parents assigned the <code>PARENT</code> role for the parent portal. Additional caregivers (grandparents, local guardians, drivers) are registered as authorized guardians with pickup permissions.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: APPLICATION */}
                  {inspector.tab === 'application' && (
                    <div className="form-grid">
                      <div className="field">
                        <label>Application Number</label>
                        <input className="input" readOnly value={inspector.data.application.applicationNumber} />
                      </div>
                      <div className="field">
                        <label>Academic Session</label>
                        <input className="input" readOnly value={inspector.data.application.academicSession?.name || 'Academic Year 2026-27'} />
                      </div>
                      <div className="field">
                        <label>Program / Class</label>
                        <input className="input" readOnly value={inspector.data.application.programType} />
                      </div>
                      <div className="field">
                        <label>Submitted At</label>
                        <input className="input" readOnly value={fmtDate(inspector.data.application.submittedAt || new Date().toISOString())} />
                      </div>
                    </div>
                  )}

                  {/* TAB 4: DOCUMENTS VERIFICATION */}
                  {inspector.tab === 'documents' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Required Documents Checklist</h4>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            All mandatory documents must be verified before the admission decision can be approved.
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={handleVerifyAllDocuments}
                          disabled={busy}
                        >
                          <CheckCircle2 size={13} /> Verify All Pending
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {inspector.data.application.documents.map((doc) => (
                          <div
                            key={doc.id}
                            style={{
                              background: 'var(--surface)',
                              border: '1px solid var(--border-default)',
                              borderRadius: 10,
                              padding: '12px 16px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <FileText size={18} style={{ color: doc.verified ? 'var(--success)' : 'var(--text-secondary)' }} />
                              <div>
                                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{doc.docType.replace(/_/g, ' ')}</div>
                                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{doc.fileName}</div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span className={`badge ${doc.verified ? 'b-success' : doc.status === 'REJECTED' ? 'b-danger' : 'b-warning'}`}>
                                {doc.verified ? '✓ VERIFIED' : doc.status}
                              </span>
                              {!doc.verified && (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleVerifyDocument(doc.id, 'VERIFY')}
                                  disabled={busy}
                                  style={{ padding: '3px 8px', fontSize: 11.5 }}
                                >
                                  Verify
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => handleVerifyDocument(doc.id, 'REJECT', 'Document illegible or expired')}
                                disabled={busy}
                                style={{ padding: '3px 8px', fontSize: 11.5 }}
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 5: FOLLOW-UP & VISIT */}
                  {inspector.tab === 'followup_visit' && (
                    <form onSubmit={handleSaveCounselling} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Counselling Session & Parent Meeting</h4>
                      <div className="form-grid">
                        <div className="field">
                          <label>Meeting Date & Time</label>
                          <input
                            type="datetime-local"
                            className="input"
                            value={counsellingForm.scheduledAt}
                            onChange={(e) => setCounsellingForm((prev) => ({ ...prev, scheduledAt: e.target.value }))}
                          />
                        </div>
                        <div className="field">
                          <label>Staff / Coordinator Name</label>
                          <input
                            className="input"
                            placeholder="e.g. Principal / Lead Teacher"
                            value={counsellingForm.counselorName}
                            onChange={(e) => setCounsellingForm((prev) => ({ ...prev, counselorName: e.target.value }))}
                          />
                        </div>
                        <div className="field">
                          <label>Mode</label>
                          <select
                            className="input"
                            value={counsellingForm.mode}
                            onChange={(e) => setCounsellingForm((prev) => ({ ...prev, mode: e.target.value }))}
                          >
                            <option value="IN_PERSON">In-Person Campus Walkthrough</option>
                            <option value="PHONE">Phone Discussion</option>
                            <option value="VIRTUAL">Video Call</option>
                          </select>
                        </div>
                        <div className="field">
                          <label>Outcome</label>
                          <select
                            className="input"
                            value={counsellingForm.outcome}
                            onChange={(e) => setCounsellingForm((prev) => ({ ...prev, outcome: e.target.value }))}
                          >
                            <option value="POSITIVE">Positive / Ready for Admission</option>
                            <option value="NEUTRAL">Neutral / Considering</option>
                            <option value="REQUIRES_ASSESSMENT">Requires Child Developmental Observation</option>
                          </select>
                        </div>
                      </div>

                      <div className="field">
                        <label>Parent Expectations & Child Interaction Notes</label>
                        <textarea
                          className="input"
                          rows={3}
                          placeholder="Note discussions on child temperament, diet, allergies, transport requirements..."
                          value={counsellingForm.notes}
                          onChange={(e) => setCounsellingForm((prev) => ({ ...prev, notes: e.target.value }))}
                        />
                      </div>

                      <button type="submit" className="btn btn-primary" disabled={busy} style={{ alignSelf: 'flex-start' }}>
                        Save Counselling Record
                      </button>
                    </form>
                  )}

                  {/* TAB 6: DECISION & OFFER */}
                  {inspector.tab === 'decision_offer' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {/* Section 1: Admission Review Checklist */}
                      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', borderRadius: 12, padding: 16 }}>
                        <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800 }}>Pre-Approval Review Checklist</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                            {inspector.data.requirements.ageRequirement.eligible ? (
                              <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                            ) : (
                              <XCircle size={16} style={{ color: 'var(--danger)' }} />
                            )}
                            <span>Age Eligibility: <strong>{inspector.data.requirements.ageRequirement.reason}</strong></span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                            {inspector.data.requirements.documentsCheck.isComplete ? (
                              <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                            ) : (
                              <XCircle size={16} style={{ color: 'var(--danger)' }} />
                            )}
                            <span>Mandatory Documents: <strong>{inspector.data.requirements.documentsCheck.verified}/{inspector.data.requirements.documentsCheck.total} Verified</strong></span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                            {inspector.data.requirements.capacityCheck.hasAvailableCapacity ? (
                              <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                            ) : (
                              <XCircle size={16} style={{ color: 'var(--danger)' }} />
                            )}
                            <span>Classroom Seat Capacity Available</span>
                          </div>
                        </div>

                        {/* Decision Actions */}
                        {inspector.data.application.status === 'SUBMITTED' || inspector.data.application.status === 'UNDER_REVIEW' ? (
                          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={!inspector.data.requirements.isReadyForApproval || busy}
                              onClick={() => handleApproveApplication('APPROVE')}
                            >
                              Authorize & Approve
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline"
                              onClick={() => handleApproveApplication('NEED_MORE_INFORMATION', 'Missing address proof')}
                            >
                              Request More Info
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline"
                              onClick={() => handleWaitlist(inspector.data!.application.id)}
                            >
                              Move to Waiting List
                            </button>
                          </div>
                        ) : (
                          <div style={{ marginTop: 10 }}>
                            <span className="badge b-success">Status: {inspector.data.application.status}</span>
                          </div>
                        )}
                      </div>

                      {/* Section 2: Fee Template & Offer Generation */}
                      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', borderRadius: 12, padding: 16 }}>
                        <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800 }}>Fee Template & Admission Offer</h4>

                        <div className="field" style={{ maxWidth: 360, marginBottom: 12 }}>
                          <label>Select Fee Template</label>
                          <select
                            className="input"
                            value={selectedFeePlanId}
                            onChange={(e) => setSelectedFeePlanId(e.target.value)}
                          >
                            {feePlans.map((fp) => (
                              <option key={fp.id} value={fp.id}>
                                {fp.name} — ₹{((fp.totalAnnualCents || 0) / 100).toLocaleString('en-IN')}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Sibling Concession Banner */}
                        {inspector.data.requirements.siblingConcession.hasSibling && (
                          <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, padding: 10, fontSize: 12.5, color: '#065F46', marginBottom: 12 }}>
                            ★ <strong>Sibling Concession Available:</strong> 10% dynamic tuition discount applied for enrolled sibling.
                          </div>
                        )}

                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                          <em>Notice: This fee snapshot is locked for this admission offer. Future tuition fee schedule changes will not alter signed or accepted offers.</em>
                        </div>

                        {/* Offer Status & Parent Acceptance Actions */}
                        {inspector.data.application.offers && inspector.data.application.offers.length > 0 ? (
                          <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                              Active Offer: {inspector.data.application.offers[0].offerNumber} ({inspector.data.application.offers[0].status})
                            </div>

                            {inspector.data.application.offers[0].status === 'ISSUED' && (
                              <div style={{ display: 'flex', gap: 10 }}>
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  onClick={handleAcceptOffer}
                                  disabled={busy}
                                >
                                  Record Parent Acceptance
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline"
                                  onClick={() => handleDeclineOffer('Parent opted for another preschool')}
                                  disabled={busy}
                                >
                                  Record Offer Decline
                                </button>
                              </div>
                            )}

                            {inspector.data.application.offers[0].status === 'ACCEPTED' && (
                              <div style={{ background: 'var(--success-soft)', padding: 10, borderRadius: 8, color: 'var(--success)', fontWeight: 700, fontSize: 13 }}>
                                ✓ Offer Accepted by Parent! Ready for Final Confirmation.
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={inspector.data.application.status !== 'APPROVED' || busy}
                            onClick={() => handleGenerateOffer(7)}
                          >
                            Generate & Issue Offer Letter
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 7: FINAL CONFIRMATION */}
                  {inspector.tab === 'final_confirmation' && (() => {
                    const isAgeEligible = Boolean(inspector.data?.requirements.ageRequirement.eligible)
                    const isDocsVerified = Boolean(inspector.data?.requirements.documentsCheck.isComplete)
                    const isSeatAvailable = Boolean(inspector.data?.requirements.capacityCheck.hasAvailableCapacity)
                    const isOfferAccepted = inspector.data?.application.status === 'OFFER_ACCEPTED' || inspector.data?.application.offers[0]?.status === 'ACCEPTED'
                    const isFeeReady = Boolean(inspector.data?.application.offers && inspector.data.application.offers.length > 0)
                    const allGatesPassed = isAgeEligible && isDocsVerified && isSeatAvailable && isOfferAccepted && isFeeReady

                    const checks = [
                      {
                        name: 'Age eligible',
                        passed: isAgeEligible,
                        detail: isAgeEligible ? `${inspector.data.requirements.ageRequirement.ageMonths} months satisfies program bounds` : (inspector.data.requirements.ageRequirement.reason || 'Age criteria not met'),
                      },
                      {
                        name: 'Documents verified',
                        passed: isDocsVerified,
                        detail: isDocsVerified ? 'All mandatory documents verified' : `${inspector.data.requirements.documentsCheck.total - inspector.data.requirements.documentsCheck.verified} mandatory document(s) pending verification`,
                      },
                      {
                        name: 'Classroom seat available',
                        passed: isSeatAvailable,
                        detail: isSeatAvailable ? 'Section capacity available' : 'No seat available in selected program',
                      },
                      {
                        name: 'Parent accepted offer',
                        passed: isOfferAccepted,
                        detail: isOfferAccepted ? 'Parent agreed to admission & fee terms' : 'Parent offer acceptance pending',
                      },
                      {
                        name: 'Fee setup ready',
                        passed: isFeeReady,
                        detail: isFeeReady ? `Fee plan locked: ${inspector.data.application.offers[0]?.offerNumber || 'Offer Active'}` : 'Fee offer not generated yet',
                      },
                    ]

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <div style={{ background: 'var(--primary-light, #EEF2FF)', border: '1px solid var(--border-default)', borderRadius: 12, padding: 16 }}>
                          <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                            Staff Final Review & Admission Gate
                          </h3>
                          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                            Verify all 5 admission requirements before officially creating the student record and completing admission.
                          </p>
                        </div>

                        {/* Summary Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                          <div style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 12 }}>
                            <div style={{ fontSize: 11, fontWeight: 750, color: 'var(--primary)', textTransform: 'uppercase' }}>Child</div>
                            <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2 }}>{inspector.data.application.childFirstName} {inspector.data.application.childLastName || ''}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>DOB: {fmtDate(inspector.data.application.childDob)} ({inspector.data.requirements.ageRequirement.ageMonths} mos)</div>
                          </div>

                          <div style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 12 }}>
                            <div style={{ fontSize: 11, fontWeight: 750, color: 'var(--primary)', textTransform: 'uppercase' }}>Parent & Family</div>
                            <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2 }}>{inspector.data.application.parentName}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Phone: {inspector.data.application.parentPhone}</div>
                          </div>

                          <div style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 12 }}>
                            <div style={{ fontSize: 11, fontWeight: 750, color: 'var(--primary)', textTransform: 'uppercase' }}>Classroom Section</div>
                            <select
                              className="input"
                              style={{ marginTop: 4, height: 32, fontSize: 12 }}
                              value={selectedClassId}
                              onChange={(e) => setSelectedClassId(e.target.value)}
                            >
                              {inspector.data.requirements.capacityCheck.sections.map((sec) => (
                                <option key={sec.id} value={sec.id} disabled={!sec.hasSeat}>
                                  {sec.name} ({sec.available} seats available)
                                </option>
                              ))}
                            </select>
                          </div>

                          <div style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 12 }}>
                            <div style={{ fontSize: 11, fontWeight: 750, color: 'var(--primary)', textTransform: 'uppercase' }}>Offer & Fees</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                              {inspector.data.application.offers[0]?.offerNumber || 'Offer Accepted'}
                            </div>
                            <div style={{ fontSize: 12, color: isOfferAccepted ? 'var(--success)' : 'var(--warning)', fontWeight: 700 }}>
                              {isOfferAccepted ? '✓ Parent Accepted' : '⏳ Awaiting Acceptance'}
                            </div>
                          </div>
                        </div>

                        {/* Section 11: Final Admission Check Table */}
                        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', borderRadius: 12, overflow: 'hidden' }}>
                          <div style={{ padding: '12px 16px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-default)', fontSize: 13, fontWeight: 800 }}>
                            Final Admission Check
                          </div>
                          <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {checks.map((c) => (
                              <div key={c.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 15 }}>{c.passed ? '✅' : '❌'}</span>
                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 750, color: 'var(--text-primary)' }}>{c.name}</div>
                                    <div style={{ fontSize: 11.5, color: c.passed ? 'var(--text-secondary)' : 'var(--danger)', fontWeight: c.passed ? 400 : 600 }}>
                                      {c.detail}
                                    </div>
                                  </div>
                                </div>
                                <span className={`badge ${c.passed ? 'b-success' : 'b-danger'}`} style={{ fontSize: 11 }}>
                                  {c.passed ? 'READY' : 'ACTION NEEDED'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* PRIMARY FINAL CTA */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{
                              height: 44,
                              padding: '0 24px',
                              fontSize: 14,
                              fontWeight: 800,
                              letterSpacing: '0.02em',
                              boxShadow: allGatesPassed ? '0 2px 8px rgba(91,61,245,0.3)' : 'none',
                              opacity: allGatesPassed ? 1 : 0.6,
                            }}
                            onClick={() => setConfirmAdmissionDialog(true)}
                            disabled={!allGatesPassed || busy}
                          >
                            CONFIRM & CREATE ADMISSION
                          </button>
                        </div>
                      </div>
                    )
                  })()}

                  {/* TAB 8: TIMELINE */}
                  {inspector.tab === 'timeline' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800 }}>Immutable Admission Audit History</h4>
                      {inspector.data.timeline.map((entry) => (
                        <div
                          key={entry.id}
                          style={{
                            borderLeft: '2px solid var(--primary)',
                            paddingLeft: 12,
                            marginLeft: 4,
                            position: 'relative',
                          }}
                        >
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {fmtDate(entry.createdAt)} · {entry.actorName || 'System'} ({entry.actorRole || 'SYSTEM'})
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {entry.action}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {entry.summary}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          LEAD / ENQUIRY INSPECTOR DRAWER (Metro-Inspired Slide-out)
      ═══════════════════════════════════════════════════════════════════════ */}
      {leadInspector.open && (
        <div className="adm-drawer-backdrop" onClick={() => setLeadInspector((prev) => ({ ...prev, open: false, data: null }))}>
          <div
            className="adm-drawer-panel"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(900px, 94vw)' }}
          >
            {/* Header */}
            <div className="adm-drawer-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.05em' }}>
                    PROSPECT ENQUIRY DOSSIER
                  </span>
                  <span className={`badge ${
                    leadInspector.data?.status === 'NEW' ? 'b-blue' :
                    leadInspector.data?.status === 'CONTACTED' ? 'b-amber' :
                    leadInspector.data?.status === 'QUALIFIED' ? 'b-purple' :
                    leadInspector.data?.status === 'APPLICATION_STARTED' ? 'b-success' :
                    leadInspector.data?.status === 'CONVERTED' ? 'b-success' :
                    leadInspector.data?.status === 'LOST' ? 'b-danger' :
                    'b-gray'
                  }`}>
                    {leadInspector.data?.status?.replace(/_/g, ' ') || 'NEW'}
                  </span>
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 850, margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span>{leadInspector.data?.leadNumber || 'Enquiry'}</span>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 16 }}>—</span>
                  <span style={{ fontWeight: 700 }}>{leadInspector.data?.childName || 'Child'}</span>
                </h2>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Parent: <strong>{leadInspector.data?.parentName}</strong> · Program: <strong>{leadInspector.data?.interestedProgram || 'Nursery'}</strong> · Source: <strong>{leadInspector.data?.source}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {leadInspector.data?.status !== 'APPLICATION_STARTED' && leadInspector.data?.status !== 'CONVERTED' && leadInspector.data?.status !== 'LOST' && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleConvertEnquiry(leadInspector.data.id)}
                  >
                    <ClipboardList size={13} /> Start Application
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setLeadInspector((prev) => ({ ...prev, open: false, data: null }))}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="adm-drawer-tabs">
              <button
                type="button"
                className={`adm-drawer-tab ${leadInspector.tab === 'overview' ? 'active' : ''}`}
                onClick={() => setLeadInspector((prev) => ({ ...prev, tab: 'overview' }))}
              >
                Overview
              </button>
              <button
                type="button"
                className={`adm-drawer-tab ${leadInspector.tab === 'activity' ? 'active' : ''}`}
                onClick={() => setLeadInspector((prev) => ({ ...prev, tab: 'activity' }))}
              >
                Activity Timeline ({leadInspector.activity?.length || 0})
              </button>
              <button
                type="button"
                className={`adm-drawer-tab ${leadInspector.tab === 'edit' ? 'active' : ''}`}
                onClick={() => setLeadInspector((prev) => ({ ...prev, tab: 'edit' }))}
              >
                Edit Enquiry
              </button>
            </div>

            {/* Body */}
            <div className="adm-drawer-body">
              {leadInspector.loading ? (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <Skeleton w="100%" h={120} />
                </div>
              ) : leadInspector.tab === 'overview' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Age Advisory Alert Banner if present */}
                  {leadInspector.data?.notes?.includes('Age Advisory') && (
                    <div className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 flex items-start gap-3">
                      <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-amber-800 dark:text-amber-300">
                          Age Eligibility Advisory Flagged
                        </div>
                        <div className="text-[11.5px] text-amber-750 dark:text-amber-400 mt-0.5">
                          Child's age is outside the standard configured bounds for {leadInspector.data?.interestedProgram || 'this program'}. Enquiry is captured safely without blocking prospect interest.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 4-Card Metro Context Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* 1. Child Details Card */}
                    <div className="p-3.5 rounded-xl border border-border/80 bg-card">
                      <div className="flex items-center justify-between pb-2 border-b border-border/60">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <User size={13} className="text-primary" /> Child Profile
                        </span>
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {leadInspector.data?.childDob ? `${calculateAgeMonths(leadInspector.data.childDob)} months old` : 'Age unassigned'}
                        </span>
                      </div>
                      <div className="mt-2.5 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Full Name:</span>
                          <span className="font-semibold text-foreground">{leadInspector.data?.childName || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Date of Birth:</span>
                          <span className="font-semibold text-foreground">{leadInspector.data?.childDob ? fmtDate(leadInspector.data.childDob) : '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Program Interest:</span>
                          <span className="badge b-purple">{leadInspector.data?.interestedProgram || 'Nursery'}</span>
                        </div>
                      </div>
                    </div>

                    {/* 2. Parent / Guardian Card */}
                    <div className="p-3.5 rounded-xl border border-border/80 bg-card">
                      <div className="flex items-center justify-between pb-2 border-b border-border/60">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Users size={13} className="text-primary" /> Primary Guardian
                        </span>
                        <span className="text-[11px] text-muted-foreground">Parent</span>
                      </div>
                      <div className="mt-2.5 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Name:</span>
                          <span className="font-semibold text-foreground">{leadInspector.data?.parentName}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Phone:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground">{leadInspector.data?.phone}</span>
                            <a href={`tel:${leadInspector.data?.phone}`} className="p-1 rounded hover:bg-muted text-primary" title="Call">
                              <Phone size={11} />
                            </a>
                            <a href={`https://wa.me/${leadInspector.data?.phone?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="p-1 rounded hover:bg-muted text-emerald-600" title="WhatsApp">
                              <MessageCircle size={11} />
                            </a>
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Email:</span>
                          <span className="font-semibold text-foreground">{leadInspector.data?.email || '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* 3. School & Intake Channel */}
                    <div className="p-3.5 rounded-xl border border-border/80 bg-card">
                      <div className="flex items-center justify-between pb-2 border-b border-border/60">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Building size={13} className="text-primary" /> Intake & School
                        </span>
                        <span className="badge b-blue">{leadInspector.data?.source || 'WALK_IN'}</span>
                      </div>
                      <div className="mt-2.5 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Branch:</span>
                          <span className="font-semibold text-foreground">{branches.find((b) => b.id === leadInspector.data?.branchId)?.name || 'Main Campus'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Academic Cycle:</span>
                          <span className="font-semibold text-foreground">{sessions.find((s) => s.id === selectedSessionId)?.name || '2026-27'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Enquiry Date:</span>
                          <span className="font-semibold text-foreground">{fmtDate(leadInspector.data?.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* 4. Ownership & Follow-up Pointer */}
                    <div className="p-3.5 rounded-xl border border-border/80 bg-card">
                      <div className="flex items-center justify-between pb-2 border-b border-border/60">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Clock size={13} className="text-primary" /> Ownership & Action
                        </span>
                        <button
                          type="button"
                          className="text-[11px] text-primary hover:underline font-semibold"
                          onClick={(ev) => handleOpenAssignModal(ev, leadInspector.data.id, leadInspector.data.leadNumber, leadInspector.data.assignedToId)}
                        >
                          Reassign
                        </button>
                      </div>
                      <div className="mt-2.5 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Assigned Staff:</span>
                          <span className="font-semibold text-foreground">{leadInspector.data?.assignedToId ? 'Assigned Counselor' : 'Unassigned'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Next Follow-up:</span>
                          <span className="font-semibold text-foreground">
                            {leadInspector.data?.nextFollowUpAt ? fmtDate(leadInspector.data.nextFollowUpAt) : 'No scheduled follow-up'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Application Link:</span>
                          <span className="font-semibold text-foreground">
                            {leadInspector.data?.convertedApplicationId ? (
                              <button
                                type="button"
                                className="text-primary hover:underline"
                                onClick={() => openInspector(leadInspector.data.convertedApplicationId)}
                              >
                                View Application
                              </button>
                            ) : (
                              'Not started'
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes & Context */}
                  {leadInspector.data?.notes && (
                    <div className="p-3.5 rounded-xl border border-border/80 bg-card">
                      <div className="text-xs font-bold text-foreground mb-1.5">Notes & Context</div>
                      <div className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {leadInspector.data.notes}
                      </div>
                    </div>
                  )}

                  {/* Action Command Bar */}
                  <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setFollowUpModal({ open: true, enquiry: leadInspector.data, defaultType: 'Phone Call' })}
                      >
                        <Phone size={13} /> Log Outreach
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setVisitModal({ open: true, enquiry: leadInspector.data })}
                      >
                        <Calendar size={13} /> Schedule Visit
                      </button>
                      {leadInspector.data?.status === 'NURTURE' && (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => handleReactivateLead(leadInspector.data.id, leadInspector.data.leadNumber)}
                        >
                          <RefreshCw size={13} /> Re-activate Lead
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {leadInspector.data?.status !== 'LOST' && leadInspector.data?.status !== 'CONVERTED' && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm text-destructive hover:bg-destructive/10"
                          onClick={(ev) => handleOpenLostModal(ev, leadInspector.data.id, leadInspector.data.leadNumber)}
                        >
                          Close as Lost
                        </button>
                      )}
                      {leadInspector.data?.status !== 'APPLICATION_STARTED' && leadInspector.data?.status !== 'CONVERTED' && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleConvertEnquiry(leadInspector.data.id)}
                        >
                          <ClipboardList size={13} /> Start Admission Form
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : leadInspector.tab === 'activity' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="text-xs font-bold text-foreground">Chronological Activity & Audit Ledger</div>
                  {leadInspector.activity && leadInspector.activity.length > 0 ? (
                    <div className="space-y-2.5">
                      {leadInspector.activity.map((act: any) => (
                        <div key={act.id} className="p-3 rounded-xl border border-border/70 bg-card flex items-start justify-between gap-3 text-xs">
                          <div className="flex items-start gap-2.5">
                            <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                              {act.type === 'VISIT' ? <Calendar size={12} /> : act.type === 'FOLLOWUP' ? <Phone size={12} /> : <CheckCircle2 size={12} />}
                            </div>
                            <div>
                              <div className="font-semibold text-foreground">{act.title}</div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                Logged by <strong>{act.actor}</strong> · {act.action}
                              </div>
                            </div>
                          </div>
                          <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                            {fmtDate(act.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                      No activity logged yet for this enquiry.
                    </div>
                  )}
                </div>
              ) : (
                /* Edit Tab */
                <form onSubmit={handleUpdateLead} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div className="field">
                      <label className="text-xs font-semibold text-foreground">Parent Full Name *</label>
                      <input name="parentName" defaultValue={leadInspector.data?.parentName} required className="input text-xs" />
                    </div>
                    <div className="field">
                      <label className="text-xs font-semibold text-foreground">Phone Number *</label>
                      <input name="phone" defaultValue={leadInspector.data?.phone} required className="input text-xs" />
                    </div>
                    <div className="field">
                      <label className="text-xs font-semibold text-foreground">Email Address</label>
                      <input name="email" type="email" defaultValue={leadInspector.data?.email || ''} className="input text-xs" />
                    </div>
                    <div className="field">
                      <label className="text-xs font-semibold text-foreground">Child Name</label>
                      <input name="childName" defaultValue={leadInspector.data?.childName || ''} className="input text-xs" />
                    </div>
                    <div className="field">
                      <label className="text-xs font-semibold text-foreground">Date of Birth</label>
                      <input name="childDob" type="date" defaultValue={leadInspector.data?.childDob?.slice(0, 10) || ''} className="input text-xs" />
                    </div>
                    <div className="field">
                      <label className="text-xs font-semibold text-foreground">Interested Program</label>
                      <select name="interestedProgram" defaultValue={leadInspector.data?.interestedProgram || 'NURSERY'} className="input text-xs">
                        {programs.map((p) => (
                          <option key={p.id} value={p.programType || p.code}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="field">
                    <label className="text-xs font-semibold text-foreground">Notes</label>
                    <textarea name="notes" defaultValue={leadInspector.data?.notes || ''} rows={3} className="input text-xs" />
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-border/80">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLeadInspector((prev) => ({ ...prev, tab: 'overview' }))}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                      Save Changes
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CLOSE AS LOST (Mandatory Reason) ── */}
      <Modal
        open={lostModal.open}
        onClose={() => setLostModal({ open: false, leadId: null, leadNumber: '', reason: 'CHOSE_ANOTHER_SCHOOL', notes: '' })}
        title="Close Enquiry as Lost"
        subtitle={`Select mandatory drop-off reason for analytics on ${lostModal.leadNumber}`}
        icon={<UserX size={22} />}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label className="text-xs font-semibold text-foreground">Drop-off Reason *</label>
            <select
              className="input text-xs"
              value={lostModal.reason}
              onChange={(e) => setLostModal((prev) => ({ ...prev, reason: e.target.value }))}
            >
              <option value="CHOSE_ANOTHER_SCHOOL">Chose another school</option>
              <option value="FEES">Fees / Budget constraint</option>
              <option value="LOCATION">Location / Distance too far</option>
              <option value="TIMING">Timing / Batch mismatch</option>
              <option value="NO_RESPONSE">No response after multiple follow-ups</option>
              <option value="ADMISSION_NOT_REQUIRED">Admission not required this term</option>
              <option value="OTHER">Other reason</option>
            </select>
          </div>
          <div className="field">
            <label className="text-xs font-semibold text-foreground">Staff Notes / Context</label>
            <textarea
              className="input text-xs"
              rows={3}
              placeholder="e.g. Parent decided on a school closer to residence..."
              value={lostModal.notes}
              onChange={(e) => setLostModal((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border/80">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setLostModal({ open: false, leadId: null, leadNumber: '', reason: 'CHOSE_ANOTHER_SCHOOL', notes: '' })}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm bg-destructive hover:bg-destructive/90 text-white"
              onClick={handleConfirmLostLead}
              disabled={busy}
            >
              Confirm Close as Lost
            </button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: ASSIGN LEAD ── */}
      <Modal
        open={assignModal.open}
        onClose={() => setAssignModal({ open: false, leadId: null, leadNumber: '', assignedToId: '' })}
        title="Assign Enquiry Owner"
        subtitle={`Select staff counselor responsible for ${assignModal.leadNumber}`}
        icon={<UserCheck size={22} />}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label className="text-xs font-semibold text-foreground">Select Staff Member *</label>
            <select
              className="input text-xs"
              value={assignModal.assignedToId}
              onChange={(e) => setAssignModal((prev) => ({ ...prev, assignedToId: e.target.value }))}
            >
              <option value="">-- Choose staff counselor --</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.fullName} ({s.role || 'Staff'})</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border/80">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setAssignModal({ open: false, leadId: null, leadNumber: '', assignedToId: '' })}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleConfirmAssignLead}
              disabled={busy || !assignModal.assignedToId}
            >
              Assign Staff
            </button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: NEW ENQUIRY (Clean 4-Section Form) ── */}
      <Modal
        open={enquiryModal}
        onClose={() => setEnquiryModal(false)}
        title="Record New Enquiry"
        subtitle="Capture initial parent inquiry with automated phone duplicate detection"
        icon={<UserPlus size={22} />}
        iconClass="ic-purple"
        maxWidth="760px"
      >
        <form onSubmit={handleCreateEnquiry} className="space-y-5">
          {/* SECTION 1: PARENT / GUARDIAN */}
          <div className="p-3.5 rounded-xl border border-border/70 bg-card/60 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
              <span className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center font-mono text-[10px]">1</span>
              <span>Parent / Guardian</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Parent Full Name *</label>
                <input name="parentName" required className="input h-9 text-xs" placeholder="e.g. Rahul Sharma" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Phone Number *</label>
                <MaskedInput mask="phone" name="phone" required placeholder="10-digit mobile" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Email Address</label>
                <input name="email" type="email" className="input h-9 text-xs" placeholder="e.g. parent@example.com" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Relationship</label>
                <select name="relationship" className="input h-9 text-xs">
                  <option value="FATHER">Father</option>
                  <option value="MOTHER">Mother</option>
                  <option value="GUARDIAN">Guardian</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: CHILD DETAILS */}
          <div className="p-3.5 rounded-xl border border-border/70 bg-card/60 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
              <span className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center font-mono text-[10px]">2</span>
              <span>Child Details</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Child Full Name</label>
                <input name="childName" className="input h-9 text-xs" placeholder="e.g. Aarav Sharma" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Date of Birth</label>
                <input
                  name="childDob"
                  type="date"
                  className="input h-9 text-xs"
                  value={enquiryDob}
                  onChange={(e) => setEnquiryDob(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Gender</label>
                <select name="childGender" className="input h-9 text-xs">
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Previous School (if any)</label>
                <input name="previousSchool" className="input h-9 text-xs" placeholder="e.g. Playgroup Academy" />
              </div>
            </div>
          </div>

          {/* SECTION 3: ADMISSION & BATCH */}
          <div className="p-3.5 rounded-xl border border-border/70 bg-card/60 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
              <span className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center font-mono text-[10px]">3</span>
              <span>Admission & Batch</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Interested Program *</label>
                <select name="interestedProgram" required className="input h-9 text-xs">
                  {programs.map((p) => (
                    <option key={p.id} value={p.programType || p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Preferred Batch / Shift</label>
                <select name="preferredBatch" className="input h-9 text-xs">
                  <option value="MORNING">Morning (9:00 AM – 12:30 PM)</option>
                  <option value="AFTERNOON">Afternoon (1:00 PM – 4:30 PM)</option>
                  <option value="FULL_DAY">Full Day (8:30 AM – 5:30 PM)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Branch</label>
                <select name="branchId" defaultValue={selectedBranchId} className="input h-9 text-xs">
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.isMain ? '(Main)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 4: ENQUIRY & FOLLOW-UP */}
          <div className="p-3.5 rounded-xl border border-border/70 bg-card/60 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
              <span className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center font-mono text-[10px]">4</span>
              <span>Enquiry & Follow-up</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Enquiry Source</label>
                <select name="source" className="input h-9 text-xs">
                  <option value="WALK_IN">Walk-in Visit</option>
                  <option value="PHONE">Phone Call</option>
                  <option value="WEBSITE">Website Form</option>
                  <option value="REFERRAL">Parent Referral</option>
                  <option value="SOCIAL_MEDIA">Social Media / Ad</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Next Follow-up Date & Time</label>
                <input
                  name="nextFollowUpAt"
                  type="datetime-local"
                  className="input h-9 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Notes / Parent Questions</label>
              <textarea
                name="notes"
                className="input text-xs py-2"
                rows={2}
                placeholder="Preferred batch, transport needs, campus tour observations, parent expectations..."
              />
            </div>
          </div>

          {/* Duplicate Warning Prompt */}
          {enquiryDuplicateWarning && (
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                <AlertCircle size={15} />
                <span>Possible Existing Record Found</span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-snug">
                {enquiryDuplicateWarning.warning} Existing lead: <span className="font-mono font-semibold">{enquiryDuplicateWarning.lead?.leadNumber}</span> ({enquiryDuplicateWarning.lead?.parentName}).
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  className="btn btn-outline btn-sm h-8 text-xs font-semibold rounded-lg"
                  onClick={() => setEnquiryModal(false)}
                >
                  Open Existing
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm h-8 text-xs font-semibold rounded-lg"
                  onClick={handleConfirmDuplicateEnquiry}
                >
                  Continue Anyway
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/70">
            <button
              type="button"
              className="btn btn-ghost btn-sm h-8.5 px-3 text-xs font-semibold rounded-lg"
              onClick={() => setEnquiryModal(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm h-8.5 px-4 text-xs font-semibold rounded-lg"
              disabled={busy}
            >
              {busy ? 'Saving...' : 'Save Enquiry'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL: APPLICATION WIZARD (3-Step Dossier Form) ── */}
      <Modal
        open={formModal}
        onClose={() => setFormModal(false)}
        title="New Admission Application"
        subtitle="Step 1 of 3: Comprehensive Child & Family dossier intake"
        icon={<ClipboardList size={22} />}
        wide
      >
        <form onSubmit={handleCreateApplication}>
          {appStep === 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', marginBottom: 12 }}>
                Step 1: Child Information & Medical Profile
              </div>
              <div className="form-grid">
                <div className="field">
                  <label>Program Type *</label>
                  <select
                    name="programType"
                    required
                    className="input"
                    value={appProgramType}
                    onChange={(e) => setAppProgramType(e.target.value)}
                  >
                    {programs.map((p) => (
                      <option key={p.id} value={p.programType || p.code}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Child First Name *</label>
                  <input name="childFirstName" required className="input" placeholder="e.g. Aarav" />
                </div>
                <div className="field">
                  <label>Child Last Name</label>
                  <input name="childLastName" className="input" placeholder="e.g. Sharma" />
                </div>
                <div className="field">
                  <label>Date of Birth *</label>
                  <input
                    name="childDob"
                    type="date"
                    required
                    className="input"
                    value={appDob}
                    onChange={(e) => setAppDob(e.target.value)}
                  />
                  {appAgeEligibility && (
                    <div style={{ fontSize: 11, marginTop: 4, fontWeight: 650, color: appAgeEligibility.eligible ? 'var(--success)' : 'var(--danger)' }}>
                      {appAgeEligibility.reason}
                    </div>
                  )}
                </div>
                <div className="field">
                  <label>Gender *</label>
                  <select name="childGender" required className="input">
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="field">
                  <label>Blood Group</label>
                  <select name="bloodGroup" className="input">
                    <option value="">Unknown</option>
                    <option value="A_POSITIVE">A+</option>
                    <option value="B_POSITIVE">B+</option>
                    <option value="O_POSITIVE">O+</option>
                    <option value="AB_POSITIVE">AB+</option>
                    <option value="A_NEGATIVE">A-</option>
                    <option value="B_NEGATIVE">B-</option>
                    <option value="O_NEGATIVE">O-</option>
                    <option value="AB_NEGATIVE">AB-</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                <button type="button" className="btn btn-primary" onClick={nextStep}>
                  Next: Parent & Family →
                </button>
              </div>
            </div>
          )}

          {appStep === 1 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', marginBottom: 12 }}>
                Step 2: Parent & Family Details
              </div>
              <div className="form-grid">
                <div className="field">
                  <label>Primary Parent / Guardian Name *</label>
                  <input name="parentName" required className="input" placeholder="e.g. Rahul Sharma" />
                </div>
                <div className="field">
                  <label>Phone Number *</label>
                  <MaskedInput mask="phone" name="parentPhone" required placeholder="10-digit mobile" />
                </div>
                <div className="field">
                  <label>Email Address</label>
                  <input name="parentEmail" type="email" className="input" placeholder="parent@example.com" />
                </div>
                <div className="field">
                  <label>Relationship *</label>
                  <select name="relationship" required className="input">
                    <option value="FATHER">Father</option>
                    <option value="MOTHER">Mother</option>
                    <option value="GUARDIAN">Guardian</option>
                  </select>
                </div>
              </div>

              {/* Max 2 Parents Policy Notice */}
              <div style={{ marginTop: 12, padding: 10, background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }}>
                <strong>Max 2 Parents Policy:</strong> A child may have up to 2 primary parents. Any additional caregivers will be provisioned as authorized guardians.
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setAppStep(0)}>← Back</button>
                <button type="button" className="btn btn-primary" onClick={nextStep}>Next: Review & Submit →</button>
              </div>
            </div>
          )}

          {appStep === 2 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', marginBottom: 12 }}>
                Step 3: Review Application Dossier
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 12.5, background: 'var(--bg-subtle)', padding: 14, borderRadius: 10 }}>
                {appSummary.map((s) => (
                  <div key={s.k}>
                    <span style={{ color: 'var(--text-secondary)' }}>{s.k}:</span> <strong>{s.v}</strong>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setAppStep(1)}>← Back</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  Create Application Dossier
                </button>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* ── MODAL: CONFIRM FINAL ADMISSION (Confirmation Gate) ── */}
      <Modal
        open={confirmAdmissionDialog}
        onClose={() => setConfirmAdmissionDialog(false)}
        title="Confirm Admission?"
        subtitle={inspector.data ? `You are about to complete admission for ${inspector.data.application.childFirstName} ${inspector.data.application.childLastName || ''}`.trim() : 'Complete Admission'}
        icon={<Award size={22} />}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {inspector.data && (
            <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 14, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, fontSize: 13 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Program:</span>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{inspector.data.application.programType}</div>
              </div>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Academic Session:</span>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{inspector.data.application.academicSession?.name || 'Academic Year 2026-27'}</div>
              </div>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Classroom:</span>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                  {inspector.data.requirements.capacityCheck.sections.find((s) => s.id === selectedClassId)?.name || 'Classroom Section'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Parent:</span>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{inspector.data.application.parentName}</div>
              </div>
              <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--border-default)', paddingTop: 8, marginTop: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Accepted Fee Plan:</span>
                <div style={{ fontWeight: 800, color: 'var(--primary)', marginTop: 2 }}>
                  {inspector.data.application.offers[0]?.offerNumber || 'Standard Program Fee Plan'} — Terms Accepted
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setConfirmAdmissionDialog(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontWeight: 800, padding: '8px 20px', fontSize: 13.5 }}
              onClick={handleExecuteFinalEnrollment}
            >
              CONFIRM & CREATE ADMISSION
            </button>
          </div>
        </div>
      </Modal>

      {/* ── ENROLLMENT PROGRESS OVERLAY ── */}
      {enrollmentProgressStep && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 14, textAlign: 'center', maxWidth: 360, width: '90%' }}>
            <RefreshCw size={28} className="spin" style={{ color: 'var(--primary)', margin: '0 auto 12px' }} />
            <h4 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800 }}>Enrolling Student...</h4>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>{enrollmentProgressStep}</p>
          </div>
        </div>
      )}

      {/* ── MODAL: ADMISSION COMPLETE CONFIRMATION (Section 17 Canonical Success Screen) ── */}
      <Modal
        open={successModal.open}
        onClose={() => setSuccessModal({ open: false, data: null })}
        title="🎉 Admission Completed"
        subtitle="Student profile, parent portal, and initial fee setup are ready."
        icon={<Award size={22} />}
        wide
      >
        {successModal.data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Celebration Card */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', borderRadius: 12, padding: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                {/* Child & Admission */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 750, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Student</div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text-primary)', marginTop: 2 }}>
                    {successModal.data.student?.fullName || 'Student'}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                    <b>Admission No:</b> <span className="badge b-blue" style={{ fontSize: 11 }}>{successModal.data.student?.admissionNo}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                    <b>Class:</b> {successModal.data.student?.classroom} ({successModal.data.student?.programType})
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                    <b>Academic Session:</b> 2026–27
                  </div>
                </div>

                {/* Parent */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 750, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Parent</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                    {successModal.data.parent?.primaryParent?.name || 'Parent'}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                    <b>Contact:</b> {successModal.data.parent?.primaryParent?.phone || '—'}
                  </div>
                </div>

                {/* System Readiness (All Green) */}
                <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 12, border: '1px solid var(--border-default)' }}>
                  <div style={{ fontSize: 11, fontWeight: 750, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>System Readiness</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, fontWeight: 700 }}>
                    <div style={{ color: '#065F46' }}>✅ Parent Portal: Ready</div>
                    <div style={{ color: '#065F46' }}>✅ Fee Setup: Ready</div>
                    <div style={{ color: '#065F46' }}>✅ Student Profile: Created</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 17: 5 Canonical Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--border-default)', paddingTop: 14 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => { window.location.href = `/app/students` }}
              >
                <Eye size={14} /> VIEW STUDENT
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => { window.location.href = `/app/finance` }}
              >
                <DollarSign size={14} /> VIEW FEE DETAILS
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => { window.location.href = `/app/users` }}
              >
                <User size={14} /> OPEN PARENT PROFILE
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => { window.print() }}
              >
                <Printer size={14} /> PRINT ADMISSION SLIP
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setSuccessModal({ open: false, data: null })
                  setInspector({ open: false, formId: null, data: null, tab: 'overview' })
                  setEnquiryModal(true)
                }}
              >
                <Plus size={14} /> ENROLL ANOTHER CHILD
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL: FOLLOW-UP FORM ── */}
      <Modal
        open={followUpModal.open}
        onClose={() => setFollowUpModal({ open: false, enquiry: null })}
        title="Log Parent Follow-up"
        subtitle={followUpModal.enquiry ? `Parent: ${followUpModal.enquiry.parentName} · Phone: ${followUpModal.enquiry.phone}` : ''}
        icon={<Phone size={22} />}
      >
        <form onSubmit={handleAddFollowUp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-grid">
            <div className="field">
              <label>Contact Method</label>
              <select name="type" className="input" defaultValue={followUpModal.defaultType || 'Phone Call'}>
                <option value="Phone Call">Phone Call</option>
                <option value="WhatsApp">WhatsApp Message</option>
                <option value="In-Person Discussion">In-Person Discussion</option>
                <option value="Email">Email Communication</option>
              </select>
            </div>
            <div className="field">
              <label>Outcome / Result</label>
              <select name="result" className="input">
                <option value="Interested">Interested / Follow-up Again</option>
                <option value="Visit Planned">Visit Planned</option>
                <option value="Needs More Info">Needs More Information</option>
                <option value="Not Interested">Not Interested</option>
                <option value="No Response">No Response / Unreachable</option>
              </select>
            </div>
            <div className="field">
              <label>Next Follow-up Due Date</label>
              <input type="datetime-local" name="dueAt" className="input" />
            </div>
          </div>
          <div className="field">
            <label>Notes / Discussion Summary</label>
            <textarea name="note" required className="input" rows={3} placeholder="Discussed preschool curriculum, school timings, admission schedule..." />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setFollowUpModal({ open: false, enquiry: null })}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>Save Follow-up</button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL: SCHEDULE SCHOOL VISIT ── */}
      <Modal
        open={visitModal.open}
        onClose={() => setVisitModal({ open: false, enquiry: null })}
        title="Schedule School Visit"
        subtitle={visitModal.enquiry ? `For ${visitModal.enquiry.childName || 'Child'} & Parent: ${visitModal.enquiry.parentName}` : ''}
        icon={<Calendar size={22} />}
      >
        <form onSubmit={handleScheduleVisit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-grid">
            <div className="field">
              <label>Visit Date & Time *</label>
              <input type="datetime-local" name="scheduledAt" required className="input" />
            </div>
            <div className="field">
              <label>Expected Visitors</label>
              <input type="number" name="visitorCount" defaultValue={2} min={1} max={6} className="input" />
            </div>
            <div className="field">
              <label>Attendees</label>
              <input type="text" name="attendees" defaultValue="Both Parents with Child" className="input" />
            </div>
            <div className="field">
              <label>Tour Focus Area</label>
              <input type="text" name="tourFocus" defaultValue="Classroom & Play Area" className="input" />
            </div>
          </div>
          <div className="field">
            <label>Walkthrough Notes / Special Requests</label>
            <textarea name="notes" className="input" rows={2} placeholder="Classroom tour requested, discussion on food/transport, meet head teacher..." />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setVisitModal({ open: false, enquiry: null })}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>Confirm Visit</button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL: RECORD VISIT OUTCOME & CHILD INTERACTION ── */}
      <Modal
        open={visitOutcomeModal.open}
        onClose={() => setVisitOutcomeModal({ open: false, visitId: null, visit: null, lead: null })}
        title="Record School Visit Outcome & Child Interaction"
        subtitle={visitOutcomeModal.lead ? `Child: ${visitOutcomeModal.lead.childName || 'Child'} · Parent: ${visitOutcomeModal.lead.parentName} (${visitOutcomeModal.lead.phone})` : ''}
        icon={<Award size={22} />}
        wide
      >
        <form onSubmit={handleCompleteVisitSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Section 1: Child Interaction Observations (Preschool Friendly) */}
          <div style={{ background: 'var(--bg-subtle)', borderRadius: 12, padding: 14, border: '1px solid var(--border-default)' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🧸 Child Interaction Observations (Non-Clinical Cues)</span>
            </div>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <div className="field">
                <label>Comfort in Environment</label>
                <select name="comfort" className="input" defaultValue="COMFORTABLE">
                  <option value="COMFORTABLE">Comfortable & at ease</option>
                  <option value="TOOK_SOME_TIME">Took some time to warm up</option>
                  <option value="NEEDED_SUPPORT">Needed close parent support</option>
                </select>
              </div>
              <div className="field">
                <label>Educator Interaction</label>
                <select name="educatorInteraction" className="input" defaultValue="ENGAGED">
                  <option value="ENGAGED">Engaged & curious</option>
                  <option value="LIMITED">Limited interaction</option>
                  <option value="OBSERVED">Observed from distance</option>
                </select>
              </div>
              <div className="field">
                <label>Communication & Verbal</label>
                <select name="communication" className="input" defaultValue="COMFORTABLE">
                  <option value="COMFORTABLE">Comfortable / expressive</option>
                  <option value="SOME_INTERACTION">Responded when prompted</option>
                  <option value="LIMITED">Quiet / non-verbal today</option>
                </select>
              </div>
              <div className="field">
                <label>Activity Response</label>
                <select name="activityResponse" className="input" defaultValue="INTERESTED">
                  <option value="INTERESTED">Interested & explored toys</option>
                  <option value="PARTICIPATED_WITH_SUPPORT">Participated with support</option>
                  <option value="OBSERVED_ONLY">Observed only</option>
                </select>
              </div>
              <div className="field">
                <label>Separation Response</label>
                <select name="separation" className="input" defaultValue="COMFORTABLE">
                  <option value="COMFORTABLE">Comfortable exploring</option>
                  <option value="NEEDED_SUPPORT">Needed support / reassurance</option>
                  <option value="NOT_OBSERVED">Stayed with parents</option>
                </select>
              </div>
              <div className="field">
                <label>Strengths / Key Cues</label>
                <input type="text" name="strengthsNotes" className="input" placeholder="e.g. Loves building blocks, friendly smile" />
              </div>
            </div>
          </div>

          {/* Section 2: Parent Feedback & Staff Observations */}
          <div className="form-grid">
            <div className="field">
              <label>Parent Feedback / Reactions</label>
              <textarea name="parentFeedback" rows={2} className="input" placeholder="What questions or positive reactions did the parents share during the visit?" />
            </div>
            <div className="field">
              <label>Staff Internal Assessment & Recommendation</label>
              <textarea name="staffNotes" rows={2} className="input" placeholder="Recommended classroom division, timing, settling-in tips..." />
            </div>
          </div>

          {/* Section 3: Visit Outcome Decision */}
          <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, display: 'block' }}>
              Visit Outcome & Immediate Next Step *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              {[
                {
                  key: 'READY_TO_PROCEED',
                  title: 'Ready to Proceed',
                  desc: 'Start Application with Zero Data Re-entry',
                  color: '#059669',
                  border: '#10b981',
                },
                {
                  key: 'CONSIDERING',
                  title: 'Considering',
                  desc: 'Schedule Next Follow-up Call',
                  color: '#d97706',
                  border: '#f59e0b',
                },
                {
                  key: 'FUTURE_TERM',
                  title: 'Future Term / Young',
                  desc: 'Move to Nurture with Wake-up Date',
                  color: '#2563eb',
                  border: '#3b82f6',
                },
                {
                  key: 'NOT_PROCEEDING',
                  title: 'Not Proceeding',
                  desc: 'Record Drop-off Reason & Mark Lost',
                  color: '#dc2626',
                  border: '#ef4444',
                },
              ].map((opt) => (
                <div
                  key={opt.key}
                  onClick={() => setSelectedOutcomeType(opt.key)}
                  style={{
                    border: `2px solid ${selectedOutcomeType === opt.key ? opt.border : 'var(--border-default)'}`,
                    background: selectedOutcomeType === opt.key ? 'var(--surface)' : 'var(--bg-subtle)',
                    borderRadius: 10,
                    padding: 12,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 13, color: opt.color }}>{opt.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>{opt.desc}</div>
                </div>
              ))}
            </div>

            {/* Dynamic fields based on outcome */}
            {selectedOutcomeType === 'CONSIDERING' && (
              <div className="field" style={{ marginTop: 12 }}>
                <label>Next Follow-up Due Date *</label>
                <input type="datetime-local" name="nextFollowUpAt" required className="input" defaultValue={new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)} />
              </div>
            )}

            {selectedOutcomeType === 'FUTURE_TERM' && (
              <div className="field" style={{ marginTop: 12 }}>
                <label>Wake-up / Re-contact Reminder Date *</label>
                <input type="date" name="nextFollowUpAt" required className="input" defaultValue={new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)} />
              </div>
            )}

            {selectedOutcomeType === 'NOT_PROCEEDING' && (
              <div className="field" style={{ marginTop: 12 }}>
                <label>Reason for Not Proceeding *</label>
                <select name="lostReason" required className="input">
                  <option value="CHOSE_ANOTHER_SCHOOL">Chose another preschool</option>
                  <option value="FEES">Fees out of budget</option>
                  <option value="LOCATION">Distance / Location inconvenience</option>
                  <option value="TIMING">School timing mismatch</option>
                  <option value="NO_RESPONSE">Unresponsive / unreachable</option>
                  <option value="ADMISSION_NOT_REQUIRED">Postponing admission</option>
                  <option value="OTHER">Other specific factor</option>
                </select>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8, borderTop: '1px solid var(--border-default)', paddingTop: 12 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setVisitOutcomeModal({ open: false, visitId: null, visit: null, lead: null })}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy} style={{ fontWeight: 800, padding: '8px 22px' }}>
              {selectedOutcomeType === 'READY_TO_PROCEED' ? 'START ADMISSION APPLICATION →' : 'Save Visit Outcome'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL: RESCHEDULE SCHOOL VISIT (Non-Destructive) ── */}
      <Modal
        open={rescheduleModal.open}
        onClose={() => setRescheduleModal({ open: false, visitId: null, lead: null })}
        title="Reschedule School Visit"
        subtitle={rescheduleModal.lead ? `For ${rescheduleModal.lead.childName || 'Child'} & Parent: ${rescheduleModal.lead.parentName}` : ''}
        icon={<Clock size={22} />}
      >
        <form onSubmit={handleRescheduleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 10, fontSize: 12 }}>
            <strong>History Preserved:</strong> The original appointment will be archived as <code>Rescheduled</code>. A new visit ticket will be generated and linked in the audit log.
          </div>
          <div className="form-grid">
            <div className="field">
              <label>New Visit Date & Time *</label>
              <input type="datetime-local" name="newScheduledAt" required className="input" defaultValue={rescheduleModal.currentDate ? new Date(rescheduleModal.currentDate).toISOString().slice(0, 16) : undefined} />
            </div>
            <div className="field">
              <label>Expected Visitors</label>
              <input type="number" name="visitorCount" defaultValue={2} min={1} max={6} className="input" />
            </div>
          </div>
          <div className="field">
            <label>Reason for Rescheduling</label>
            <textarea name="reason" className="input" rows={2} placeholder="Parent requested weekend slot, doctor appointment conflict..." />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setRescheduleModal({ open: false, visitId: null, lead: null })}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>Confirm Rescheduled Visit</button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL: CANCEL SCHOOL VISIT (Non-Destructive) ── */}
      <Modal
        open={cancelVisitModal.open}
        onClose={() => setCancelVisitModal({ open: false, visitId: null, lead: null })}
        title="Cancel School Visit"
        subtitle={cancelVisitModal.lead ? `For ${cancelVisitModal.lead.childName || 'Child'} & Parent: ${cancelVisitModal.lead.parentName}` : ''}
        icon={<XCircle size={22} />}
      >
        <form onSubmit={handleCancelVisitSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label>Cancellation Reason *</label>
            <textarea name="reason" required className="input" rows={3} placeholder="Parent called to cancel, family travelling, illness..." />
          </div>
          <div className="field">
            <label>Optional: Re-contact / Follow-up Date</label>
            <input type="date" name="nextFollowUpAt" className="input" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setCancelVisitModal({ open: false, visitId: null, lead: null })}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ background: '#dc2626', borderColor: '#dc2626' }} disabled={busy}>
              Confirm Cancellation
            </button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL: CSV BULK IMPORT WIZARD ── */}
      <Modal
        open={csvModalOpen}
        onClose={() => { setCsvModalOpen(false); setCsvStep(0); }}
        title="CSV Bulk Import Engine"
        subtitle="Batch import admissions enquiries with field mapping & duplicate guard"
        icon={<Download size={22} />}
        wide
      >
        <div>
          {csvStep === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                Upload or paste a CSV file containing lead enquiry records.
              </p>
              <textarea
                className="input"
                rows={6}
                placeholder="Parent Name,Phone Number,Email,Child Name,Date of Birth,Program&#10;Kavita Joshi,9890123456,kavita@example.com,Ishaan Joshi,2023-01-15,Nursery"
                value={csvRawText}
                onChange={(e) => setCsvRawText(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleParseCsv(csvRawText)}
              >
                Parse CSV & Map Columns →
              </button>
            </div>
          )}

          {csvStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Map CSV Columns to Lead Fields</div>
              <div className="form-grid">
                {['parentName', 'phone', 'email', 'childName', 'dob', 'program'].map((f) => (
                  <div key={f} className="field">
                    <label>{f}</label>
                    <select
                      className="input"
                      value={csvMapping[f] || ''}
                      onChange={(e) => setCsvMapping((prev) => ({ ...prev, [f]: e.target.value }))}
                    >
                      <option value="">-- Ignore --</option>
                      {csvHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setCsvStep(0)}>Back</button>
                <button type="button" className="btn btn-primary" onClick={handleValidateCsv}>Validate & Preview →</button>
              </div>
            </div>
          )}

          {csvStep === 2 && csvValidationResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <span className="badge b-success">Ready: {csvValidationResult.validCount}</span>
                <span className="badge b-warning">Duplicates: {csvValidationResult.duplicateCount}</span>
                <span className="badge b-danger">Invalid: {csvValidationResult.invalidCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setCsvStep(1)}>Back</button>
                <button type="button" className="btn btn-primary" onClick={handleExecuteCsvImport}>Execute Import</button>
              </div>
            </div>
          )}

          {csvStep === 4 && csvImportResult && (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <CheckCircle2 size={32} style={{ color: 'var(--success)', margin: '0 auto 8px' }} />
              <h3>Batch {csvImportResult.batchId} Executed</h3>
              <p>Imported: {csvImportResult.success}, Skipped: {csvImportResult.skipped}</p>
              <button type="button" className="btn btn-primary" onClick={() => setCsvModalOpen(false)}>Done</button>
            </div>
          )}
        </div>
      </Modal>

      {/* ── MODAL: CLASS & DIVISION ALLOCATION ENGINE ── */}
      <Modal
        open={allocModal.open}
        onClose={() => setAllocModal({ open: false, applicationId: null, data: null, loading: false })}
        title="Classroom Division Allocation"
        subtitle="Evaluate classroom division capacities and allocate seats"
        icon={<Building size={22} />}
      >
        {allocModal.data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Select Division:</div>
            {allocModal.data.divisions.map((div: any) => (
              <div
                key={div.id}
                style={{
                  border: `1.5px solid ${allocModal.selectedClassId === div.id ? 'var(--primary)' : 'var(--border-default)'}`,
                  background: allocModal.selectedClassId === div.id ? 'var(--primary-light)' : 'var(--surface)',
                  padding: 12,
                  borderRadius: 8,
                  cursor: div.isFull ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                onClick={() => { if (!div.isFull) setAllocModal((prev) => ({ ...prev, selectedClassId: div.id })) }}
              >
                <div>
                  <strong>{div.name}</strong>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Capacity: {div.capacity} · Enrolled: {div.allocated} · Available: {div.availableSeats}</div>
                </div>
                <input type="radio" checked={allocModal.selectedClassId === div.id} disabled={div.isFull} readOnly />
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setAllocModal({ open: false, applicationId: null, data: null, loading: false })}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={() => handleConfirmAllocation('allocate')} disabled={!allocModal.selectedClassId}>Confirm Allocation</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL: 12-STAGE CANONICAL ADMISSIONS JOURNEY (Windows/Metro-Inspired) ── */}
      <Modal
        open={pipelineModalOpen}
        onClose={() => setPipelineModalOpen(false)}
        title="12-Stage Canonical Admissions Journey"
        subtitle="End-to-end preschool intake progression from initial parent touchpoint to final enrollment"
        icon={<Layers size={22} />}
        iconClass="ic-purple"
        maxWidth="1020px"
      >
        <div className="space-y-6">
          {[
            {
              phaseName: 'Phase 1 — Discovery & Campus Intake',
              phaseDesc: 'Initial family contact, telephone discussion, and scheduled campus walkthrough',
              steps: [1, 2, 3],
            },
            {
              phaseName: 'Phase 2 — Dossier & Assessment',
              phaseDesc: 'Eligibility fit check, application submission, KYC documents, and child interaction',
              steps: [4, 5, 6, 7],
            },
            {
              phaseName: 'Phase 3 — Review, Decision & Formal Offer',
              phaseDesc: 'Leadership evaluation, fee quotation issuance, and parent acceptance verification',
              steps: [8, 9, 10],
            },
            {
              phaseName: 'Phase 4 — Allocation & Onboarding',
              phaseDesc: 'Classroom section placement and final student record activation',
              steps: [11, 12],
            },
          ].map((phase, pIdx) => (
            <div key={pIdx} className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-border/70 pb-1.5">
                <div>
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider">
                    {phase.phaseName}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    {phase.phaseDesc}
                  </p>
                </div>
                <span className="text-[10.5px] font-semibold text-muted-foreground font-mono">
                  Stages {phase.steps[0].toString().padStart(2, '0')}–{phase.steps[phase.steps.length - 1].toString().padStart(2, '0')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {phase.steps.map((stepNum) => {
                  const s = ADMISSION_JOURNEY_STAGES.find((st) => st.step === stepNum)
                  if (!s) return null
                  const Icon = s.icon
                  const countInfo = pipelineMetrics.stageCounts[s.step] || { total: 0, pending: 0, attention: 0 }
                  const hasAttention = countInfo.attention > 0

                  const targetTab =
                    s.step === 1 ? 'enquiries' :
                    s.step === 2 || s.step === 3 ? 'followups' :
                    s.step === 4 ? 'enquiries' :
                    s.step >= 5 && s.step <= 11 ? 'applications' :
                    'admissions'

                  return (
                    <div
                      key={s.step}
                      onClick={() => {
                        setPipelineModalOpen(false)
                        setTab(targetTab)
                      }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 text-left hover:border-primary/50 hover:shadow-xs group ${
                        hasAttention
                          ? 'border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10'
                          : countInfo.total > 0
                          ? 'border-primary/25 bg-card hover:bg-muted/30'
                          : 'border-border/70 bg-card/60 hover:bg-card'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6.5 h-6.5 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center font-mono">
                            {s.short}
                          </span>
                          <div className="w-6.5 h-6.5 rounded-lg bg-muted text-muted-foreground group-hover:text-primary flex items-center justify-center transition-colors">
                            <Icon size={13} />
                          </div>
                        </div>

                        <div className="text-right">
                          <div className={`text-base font-extrabold ${countInfo.total > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {countInfo.total}
                          </div>
                          <div className="text-[9.5px] text-muted-foreground uppercase font-semibold">
                            In Pipeline
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                          <span>{s.label}</span>
                          <ArrowRight size={11} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                          {s.desc}
                        </p>
                      </div>

                      {hasAttention ? (
                        <div className="flex items-center gap-1 text-[10.5px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/10 px-2 py-1 rounded-md">
                          <AlertCircle size={11} className="shrink-0" />
                          <span className="truncate">Attention needed</span>
                        </div>
                      ) : countInfo.total > 0 ? (
                        <div className="flex items-center gap-1 text-[10.5px] text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 size={11} className="shrink-0" />
                          <span>Active queue</span>
                        </div>
                      ) : (
                        <div className="text-[10.5px] text-muted-foreground/60">
                          No active candidates
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-3 border-t border-border/80 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Sparkles size={13} className="text-primary" />
              <span>Select any milestone card to open its dedicated operational queue</span>
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm h-8 px-3 text-xs font-semibold rounded-lg"
              onClick={() => setPipelineModalOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: MOVE TO WAITING LIST (Mandatory Reason & Priority) ── */}
      <Modal
        open={waitlistModal.open}
        onClose={() => setWaitlistModal((prev) => ({ ...prev, open: false }))}
        title="Move Application to Waiting List"
        subtitle={`Queue candidate for deferred admission or classroom capacity opening`}
        icon={<Clock3 size={22} />}
      >
        <form onSubmit={handleConfirmAddToWaitlist} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Candidate Context Pill */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border/60 text-xs flex items-center justify-between">
            <div>
              <span className="text-muted-foreground">Applicant:</span>{' '}
              <strong className="text-foreground">{waitlistModal.childName || 'Applicant'}</strong>
              {waitlistModal.programType && (
                <span className="badge b-purple ml-2">{waitlistModal.programType}</span>
              )}
            </div>
            {waitlistModal.applicationNumber && (
              <span className="font-mono text-primary font-bold">{waitlistModal.applicationNumber}</span>
            )}
          </div>

          <div className="field">
            <label className="text-xs font-semibold text-foreground">Mandatory Waitlist Reason *</label>
            <select
              className="input text-xs"
              value={waitlistModal.reason}
              onChange={(e) => setWaitlistModal((prev) => ({ ...prev, reason: e.target.value as any }))}
              required
            >
              <option value="NO_SEAT_AVAILABLE">Classroom / Section Capacity Full (No Seat Available)</option>
              <option value="PARENT_REQUESTED_LATER">Parent Requested Later Admission Date</option>
              <option value="FUTURE_TERM">Admit in Future Academic Term / Next Session</option>
              <option value="PROGRAM_CAPACITY">Total Program Enrollment Limit Reached</option>
              <option value="OTHER">Other Specific Administrative Ground</option>
            </select>
          </div>

          {waitlistModal.reason === 'OTHER' && (
            <div className="field">
              <label className="text-xs font-semibold text-foreground">
                Documented Rationale * <span className="text-destructive">(Required for Other)</span>
              </label>
              <textarea
                className="input text-xs"
                rows={3}
                placeholder="Specify administrative reason for placing candidate on waiting list..."
                value={waitlistModal.reasonNotes}
                onChange={(e) => setWaitlistModal((prev) => ({ ...prev, reasonNotes: e.target.value }))}
                required
              />
            </div>
          )}

          {waitlistModal.reason !== 'OTHER' && (
            <div className="field">
              <label className="text-xs font-semibold text-foreground">Additional Notes (Optional)</label>
              <textarea
                className="input text-xs"
                rows={2}
                placeholder="Optional context for admissions committee..."
                value={waitlistModal.reasonNotes}
                onChange={(e) => setWaitlistModal((prev) => ({ ...prev, reasonNotes: e.target.value }))}
              />
            </div>
          )}

          <div className="field">
            <label className="text-xs font-semibold text-foreground">Queue Priority Tier</label>
            <select
              className="input text-xs"
              value={waitlistModal.priority}
              onChange={(e) => setWaitlistModal((prev) => ({ ...prev, priority: e.target.value as any }))}
            >
              <option value="NORMAL">Normal Priority (Standard FIFO Queue)</option>
              <option value="HIGH">High Priority (Sibling / Staff Child / Alumni Quota)</option>
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">
              High priority candidates rank ahead of normal candidates in the queue. Within the same priority, chronological timestamp determines order.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/80">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setWaitlistModal((prev) => ({ ...prev, open: false }))}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              Confirm & Add to Waiting List
            </button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL: CHANGE PRIORITY (Audited) ── */}
      <Modal
        open={priorityModal.open}
        onClose={() => setPriorityModal((prev) => ({ ...prev, open: false }))}
        title="Change Candidate Priority"
        subtitle={`Documented priority change with audit logging`}
        icon={<Award size={22} />}
      >
        <form onSubmit={handleConfirmChangePriority} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label className="text-xs font-semibold text-foreground">New Priority Tier *</label>
            <select
              className="input text-xs"
              value={priorityModal.newPriority}
              onChange={(e) => setPriorityModal((prev) => ({ ...prev, newPriority: e.target.value as any }))}
            >
              <option value="NORMAL">NORMAL Priority</option>
              <option value="HIGH">HIGH Priority (Promoted)</option>
            </select>
          </div>

          <div className="field">
            <label className="text-xs font-semibold text-foreground">
              Mandatory Rationale * <span className="text-destructive">(Logged to Audit Trail)</span>
            </label>
            <textarea
              className="input text-xs"
              rows={3}
              placeholder="e.g. Sibling enrolled in Kindergarten, staff quota approval from Principal..."
              value={priorityModal.reason}
              onChange={(e) => setPriorityModal((prev) => ({ ...prev, reason: e.target.value }))}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/80">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setPriorityModal((prev) => ({ ...prev, open: false }))}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              Save Priority & Re-evaluate Queue
            </button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL: WAITING LIST INSPECTOR SHEET ── */}
      <Modal
        open={wlInspector.open}
        onClose={() => setWlInspector((prev) => ({ ...prev, open: false }))}
        title={
          wlInspector.data
            ? `${wlInspector.data.entry?.queuePosition > 0 ? `#${wlInspector.data.entry.queuePosition} · ` : ''}${wlInspector.data.entry?.childFirstName} ${wlInspector.data.entry?.childLastName || ''}`.trim()
            : 'Waiting List Inspector'
        }
        subtitle="M03.4 Waiting List Dossier & Seat Progression Flow"
        icon={<Clock3 size={22} />}
        wide
      >
        {wlInspector.loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-primary" />
            Loading candidate dossier...
          </div>
        ) : wlInspector.data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Top Status & Queue Badge Card */}
            <div className="p-4 rounded-xl border border-border/80 bg-muted/30 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {wlInspector.data.entry?.queuePosition > 0 ? (
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary font-black text-xl flex items-center justify-center font-mono">
                    #{wlInspector.data.entry.queuePosition}
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-muted text-muted-foreground font-bold text-xs flex items-center justify-center">
                    {wlInspector.data.entry?.status === 'CONVERTED' ? 'Enrolled' : 'Offer'}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-foreground">
                      {wlInspector.data.entry?.childFirstName} {wlInspector.data.entry?.childLastName || ''}
                    </h4>
                    {wlInspector.data.entry?.priority === 'HIGH' && (
                      <span className="badge b-purple font-extrabold text-[11px]">★ HIGH PRIORITY</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <span>Program: <strong>{wlInspector.data.entry?.programType}</strong></span>
                    <span>·</span>
                    <span>Application: <strong className="font-mono text-primary">{wlInspector.data.entry?.applicationNumber}</strong></span>
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="text-right">
                <span className="badge b-blue font-bold px-2.5 py-1 text-xs">
                  {wlInspector.data.entry?.status}
                </span>
                <div className="text-[11px] text-muted-foreground mt-1">
                  Waiting since {fmtDate(wlInspector.data.entry?.waitingSince || wlInspector.data.entry?.createdAt)}
                </div>
              </div>
            </div>

            {/* Sub-Tabs: Overview, Capacity, Priority History */}
            <div className="flex border-b border-border/80 text-xs">
              {[
                { key: 'overview', label: 'Candidate & Application' },
                { key: 'capacity', label: 'Classroom Capacity' },
                { key: 'audits', label: `Priority & Audit Trail (${wlInspector.data.audits?.length || 0})` },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setWlInspector((prev) => ({ ...prev, tab: t.key as any }))}
                  className={`px-4 py-2 font-semibold border-b-2 transition-colors ${
                    wlInspector.tab === t.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Overview */}
            {wlInspector.tab === 'overview' && (
              <div className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Child & Parent */}
                  <div className="p-3.5 rounded-xl border border-border/70 bg-card space-y-2">
                    <div className="font-bold text-foreground text-xs uppercase tracking-wider text-muted-foreground">
                      Applicant Profile
                    </div>
                    <div><strong>Gender:</strong> {wlInspector.data.entry?.childGender}</div>
                    <div><strong>Date of Birth:</strong> {fmtDate(wlInspector.data.entry?.childDob)}</div>
                    <div><strong>Primary Parent:</strong> {wlInspector.data.entry?.parentName}</div>
                    <div><strong>Parent Phone:</strong> <span className="font-mono">{wlInspector.data.entry?.parentPhone}</span></div>
                    {wlInspector.data.entry?.parentEmail && (
                      <div><strong>Parent Email:</strong> {wlInspector.data.entry?.parentEmail}</div>
                    )}
                  </div>

                  {/* Waiting List Decision Details */}
                  <div className="p-3.5 rounded-xl border border-border/70 bg-card space-y-2">
                    <div className="font-bold text-foreground text-xs uppercase tracking-wider text-muted-foreground">
                      Waiting List Record
                    </div>
                    <div>
                      <strong>Mandatory Reason:</strong>{' '}
                      <span className="badge b-purple">{wlInspector.data.entry?.reason}</span>
                    </div>
                    {wlInspector.data.entry?.reasonNotes && (
                      <div><strong>Notes / Justification:</strong> {wlInspector.data.entry?.reasonNotes}</div>
                    )}
                    <div>
                      <strong>Priority Tier:</strong>{' '}
                      {wlInspector.data.entry?.priority === 'HIGH' ? (
                        <span className="badge b-purple">HIGH (Prioritized)</span>
                      ) : (
                        <span className="badge b-gray">NORMAL (FIFO)</span>
                      )}
                    </div>
                    {wlInspector.data.entry?.seatOpportunityAt && (
                      <div><strong>Seat Opportunity Alerted:</strong> {fmtDate(wlInspector.data.entry.seatOpportunityAt)}</div>
                    )}
                    {wlInspector.data.entry?.offerSentAt && (
                      <div><strong>Seat Offer Issued:</strong> {fmtDate(wlInspector.data.entry.offerSentAt)}</div>
                    )}
                    {wlInspector.data.entry?.parentRespondedAt && (
                      <div>
                        <strong>Parent Response:</strong>{' '}
                        <span className="badge b-blue">{wlInspector.data.entry.parentResponse}</span> on {fmtDate(wlInspector.data.entry.parentRespondedAt)}
                      </div>
                    )}
                    {wlInspector.data.entry?.admissionApprovedAt && (
                      <div><strong>Staff Approved:</strong> {fmtDate(wlInspector.data.entry.admissionApprovedAt)} by {wlInspector.data.entry.admissionApprovedBy || 'Reviewer'}</div>
                    )}
                  </div>
                </div>

                {/* Safety Guarantee Banner */}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
                  <ShieldAlert size={16} className="shrink-0" />
                  <span>
                    <strong>Strict Boundary Guarantee:</strong> Being placed on the Waiting List or receiving a seat opportunity alert is NOT an admission approval. Formal staff approval and transactional enrollment are required.
                  </span>
                </div>
              </div>
            )}

            {/* Tab 2: Live Capacity */}
            {wlInspector.tab === 'capacity' && (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-muted/40 text-muted-foreground">
                  Classroom sections for <strong>{wlInspector.data.entry?.programType}</strong> at this campus:
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {classrooms
                    .filter((c) => c.programType === wlInspector.data.entry?.programType)
                    .map((cls) => {
                      const enrolled = cls._count?.students || 0
                      const available = Math.max(0, cls.capacity - enrolled)
                      return (
                        <div key={cls.id} className="p-3 rounded-xl border border-border/70 bg-card">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-foreground">{cls.name}</span>
                            <span className={`badge ${available > 0 ? 'b-success' : 'b-danger'}`}>
                              {available > 0 ? `${available} seats free` : 'Full'}
                            </span>
                          </div>
                          <div className="text-muted-foreground mt-1">
                            Capacity: {cls.capacity} seats · Enrolled: {enrolled}
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}

            {/* Tab 3: Priority & Audit Trail */}
            {wlInspector.tab === 'audits' && (
              <div className="space-y-2.5 text-xs">
                {wlInspector.data.audits && wlInspector.data.audits.length > 0 ? (
                  wlInspector.data.audits.map((a: any) => (
                    <div key={a.id} className="p-3 rounded-xl border border-border/70 bg-card flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-foreground">
                          Priority changed from <strong>{a.previous_priority}</strong> to <strong>{a.new_priority}</strong>
                        </div>
                        <div className="text-muted-foreground mt-0.5">
                          Rationale: <em>"{a.reason}"</em>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          Changed by <strong>{a.actor_name || a.actor_id}</strong>
                        </div>
                      </div>
                      <span className="font-mono text-muted-foreground text-[11px] shrink-0">
                        {fmtDate(a.created_at)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-muted-foreground">
                    No priority changes logged. Candidate maintains original FIFO rank.
                  </div>
                )}
              </div>
            )}

            {/* Footer Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/80">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-outline btn-sm text-destructive hover:bg-destructive/10"
                  onClick={() =>
                    setWlWithdrawModal({
                      open: true,
                      entryId: wlInspector.data.entry.id,
                      childName: wlInspector.data.entry.childFirstName,
                      reason: '',
                    })
                  }
                >
                  Withdraw from Waitlist
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() =>
                    setPriorityModal({
                      open: true,
                      entryId: wlInspector.data.entry.id,
                      childName: wlInspector.data.entry.childFirstName,
                      currentPriority: wlInspector.data.entry.priority,
                      newPriority: wlInspector.data.entry.priority === 'HIGH' ? 'NORMAL' : 'HIGH',
                      reason: '',
                    })
                  }
                >
                  Change Priority
                </button>
              </div>

              <div className="flex items-center gap-2">
                {wlInspector.data.entry?.status === 'ACTIVE' && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleMarkSeatAvailable(wlInspector.data.entry.id, wlInspector.data.entry.childFirstName)}
                  >
                    Mark Seat Available
                  </button>
                )}

                {wlInspector.data.entry?.status === 'SEAT_AVAILABLE' && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() =>
                      setWlOfferModal({
                        open: true,
                        entryId: wlInspector.data.entry.id,
                        childName: wlInspector.data.entry.childFirstName,
                        validDays: 7,
                        feePlanId: selectedFeePlanId || '',
                        terms: `Seat offer for ${wlInspector.data.entry.programType} from Waiting List promotion.`,
                      })
                    }
                  >
                    Issue Seat Offer
                  </button>
                )}

                {wlInspector.data.entry?.status === 'OFFER_SENT' && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() =>
                      setWlResponseModal({
                        open: true,
                        entryId: wlInspector.data.entry.id,
                        childName: wlInspector.data.entry.childFirstName,
                        response: 'ACCEPTED',
                        notes: '',
                      })
                    }
                  >
                    Record Parent Response
                  </button>
                )}

                {wlInspector.data.entry?.status === 'PARENT_ACCEPTED' && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm bg-teal-600 hover:bg-teal-700"
                    onClick={() => handleApproveWaitlistAdmission(wlInspector.data.entry.id, wlInspector.data.entry.childFirstName)}
                  >
                    Approve Admission
                  </button>
                )}

                {wlInspector.data.entry?.status === 'READY_FOR_ADMISSION' && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm font-extrabold"
                    onClick={() => {
                      const matchingClass = classrooms.find(
                        (c) => c.programType === wlInspector.data.entry.programType
                      )
                      setWlCompleteModal({
                        open: true,
                        entryId: wlInspector.data.entry.id,
                        childName: wlInspector.data.entry.childFirstName,
                        programType: wlInspector.data.entry.programType,
                        classroomId: matchingClass?.id || '',
                      })
                    }}
                  >
                    Complete Admission
                  </button>
                )}

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setWlInspector((prev) => ({ ...prev, open: false }))}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ── MODAL: CREATE SEAT OFFER (Waitlist) ── */}
      <Modal
        open={wlOfferModal.open}
        onClose={() => setWlOfferModal((prev) => ({ ...prev, open: false }))}
        title="Issue Seat Offer from Waiting List"
        subtitle={`Generate formal admission offer letter for ${wlOfferModal.childName}`}
        icon={<Send size={22} />}
      >
        <form onSubmit={handleConfirmCreateOffer} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label className="text-xs font-semibold text-foreground">Select Fee Plan Template</label>
            <select
              className="input text-xs"
              value={wlOfferModal.feePlanId}
              onChange={(e) => setWlOfferModal((prev) => ({ ...prev, feePlanId: e.target.value }))}
            >
              <option value="">Default Program Fee Plan</option>
              {feePlans.map((fp) => (
                <option key={fp.id} value={fp.id}>
                  {fp.name} — ₹{((fp.totalAnnualCents || 0) / 100).toLocaleString('en-IN')}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="text-xs font-semibold text-foreground">Offer Validity Period (Days) *</label>
            <input
              type="number"
              min={1}
              max={30}
              className="input text-xs"
              value={wlOfferModal.validDays}
              onChange={(e) => setWlOfferModal((prev) => ({ ...prev, validDays: parseInt(e.target.value, 10) || 7 }))}
              required
            />
          </div>

          <div className="field">
            <label className="text-xs font-semibold text-foreground">Offer Terms / Notes</label>
            <textarea
              className="input text-xs"
              rows={2}
              value={wlOfferModal.terms}
              onChange={(e) => setWlOfferModal((prev) => ({ ...prev, terms: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/80">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setWlOfferModal((prev) => ({ ...prev, open: false }))}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              Issue Formal Offer
            </button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL: RECORD PARENT RESPONSE ── */}
      <Modal
        open={wlResponseModal.open}
        onClose={() => setWlResponseModal((prev) => ({ ...prev, open: false }))}
        title="Record Parent Offer Response"
        subtitle={`Parent response for candidate ${wlResponseModal.childName}`}
        icon={<CheckCircle2 size={22} />}
      >
        <form onSubmit={handleConfirmParentResponse} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label className="text-xs font-semibold text-foreground">Parent Decision *</label>
            <select
              className="input text-xs"
              value={wlResponseModal.response}
              onChange={(e) => setWlResponseModal((prev) => ({ ...prev, response: e.target.value as any }))}
            >
              <option value="ACCEPTED">ACCEPTED — Parent accepted offer and terms</option>
              <option value="DECLINED">DECLINED — Parent declined the seat offer</option>
            </select>
          </div>

          <div className="field">
            <label className="text-xs font-semibold text-foreground">Discussion Notes / Parent Remarks</label>
            <textarea
              className="input text-xs"
              rows={3}
              placeholder="e.g. Parent confirmed acceptance on phone; fee payment pending..."
              value={wlResponseModal.notes}
              onChange={(e) => setWlResponseModal((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/80">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setWlResponseModal((prev) => ({ ...prev, open: false }))}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              Save Parent Response
            </button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL: COMPLETE WAITLIST ADMISSION & ALLOCATE CLASSROOM ── */}
      <Modal
        open={wlCompleteModal.open}
        onClose={() => setWlCompleteModal((prev) => ({ ...prev, open: false }))}
        title="Complete Admission & Class Allocation"
        subtitle={`Unified enrollment for candidate ${wlCompleteModal.childName}`}
        icon={<Award size={22} />}
      >
        <form onSubmit={handleConfirmCompleteAdmission} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs text-primary space-y-1">
            <div className="font-bold">Automated Unified Admission Fan-out:</div>
            <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
              <li>Creates canonical Student master with sequential Admission Number</li>
              <li>Allocates child to selected classroom section</li>
              <li>Creates parent user account for Family & Parent Portal</li>
              <li>Generates initial Tuition Fee invoice in Finance</li>
            </ul>
          </div>

          <div className="field">
            <label className="text-xs font-semibold text-foreground">Classroom Section Allocation *</label>
            <select
              className="input text-xs"
              value={wlCompleteModal.classroomId}
              onChange={(e) => setWlCompleteModal((prev) => ({ ...prev, classroomId: e.target.value }))}
              required
            >
              <option value="">Select Classroom Section...</option>
              {classrooms
                .filter((c) => !wlCompleteModal.programType || c.programType === wlCompleteModal.programType)
                .map((cls) => {
                  const enrolled = cls._count?.students || 0
                  const available = Math.max(0, cls.capacity - enrolled)
                  return (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} ({available} seats available / {cls.capacity} capacity)
                    </option>
                  )
                })}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/80">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setWlCompleteModal((prev) => ({ ...prev, open: false }))}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm font-bold" disabled={busy}>
              Confirm & Enroll Student
            </button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL: WITHDRAW FROM WAITING LIST ── */}
      <Modal
        open={wlWithdrawModal.open}
        onClose={() => setWlWithdrawModal((prev) => ({ ...prev, open: false }))}
        title="Withdraw from Waiting List"
        subtitle={`Mandatory cancellation reason for ${wlWithdrawModal.childName}`}
        icon={<UserX size={22} />}
      >
        <form onSubmit={handleConfirmWithdraw} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label className="text-xs font-semibold text-foreground">Mandatory Withdrawal Reason *</label>
            <textarea
              className="input text-xs"
              rows={3}
              placeholder="e.g. Parent opted for another school closer to residence, or requested fee refund..."
              value={wlWithdrawModal.reason}
              onChange={(e) => setWlWithdrawModal((prev) => ({ ...prev, reason: e.target.value }))}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/80">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setWlWithdrawModal((prev) => ({ ...prev, open: false }))}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm bg-destructive hover:bg-destructive/90 text-white"
              disabled={busy}
            >
              Confirm Withdrawal
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
