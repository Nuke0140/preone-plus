/**
 * M01 — Configuration Consumption (Impact Map §1)
 *
 * M00's SchoolConfig JSON is the SINGLE source of truth per domain.
 * Domain code reads through this accessor only — never duplicates values,
 * never hardcodes business defaults in modules. Typed defaults exist purely
 * so pre-M00 tenants (and partially configured ones) keep working.
 */
import { db } from './db'

export type OperatingConfig = {
  schoolStartTime: string
  schoolEndTime: string
  arrivalWindowStart: string
  arrivalWindowEnd: string
  pickupWindowStart: string
  pickupWindowEnd: string
  workingDays: string[]
  lateArrivalRule?: string
  earlyPickupRule?: string
  absenceRule?: string
  closureRule?: string
}

export type AdmissionConfig = {
  admissionOpenDate?: string
  admissionCloseDate?: string
  registrationFeeRupees?: number
  admissionFeeRupees?: number
  ageEligibilityNote?: string
  requiredDocuments: string[]
  approvalStages: string[]
}

export type StudentParentConfig = {
  requiredStudentFields: string[]
  pickupVerification: 'PIN_MATCH' | 'ID_CARD' | 'PHOTO_VERIFICATION'
  maxAuthorizedPickups: number
  consentTypes: string[]
  communicationPreferenceDefault: string
}

export type FinanceConfig = {
  paymentMethods: string[]
  dueDayOffset: number
  penaltyRule?: string
}

export type HealthSafetyConfig = {
  healthCheckRules?: string
  allergyCategories: string[]
  medicationPolicy?: string
  incidentCategories: string[]
  emergencyContacts: string[]
  escalationRules?: string
  pickupVerificationRequired: boolean
}

export type CommunicationConfig = {
  channels: string[]
  notificationEvents: string[]
  language: string
  escalation?: string
  templates?: Record<string, string>
  rules?: Record<string, { enabled: boolean; channels?: string[] }>
}

export type DailyOperationsConfig = {
  attendanceEnabled: boolean
  recordTypes: string[]
  arrivalNote?: string
  departureNote?: string
  parentSummaryTime?: string
}

export type CurriculumConfig = {
  milestoneFramework: string
  learningAreas: string[]
  assessmentMethods: string[]
  observationStructure?: string
  reportCardStructure?: string
}

export type InventoryConfig = {
  allowNegativeStock: boolean
  allowOverReceiving: boolean
  expiryWarningDays: number
  lowStockThresholdPercent: number
  requirePRApproval: boolean
  requireIssueApproval: boolean
}

export type ConfigDomainKey =
  | 'OPERATING'
  | 'ADMISSION'
  | 'STUDENT_PARENT'
  | 'FINANCE'
  | 'DAILY_OPERATIONS'
  | 'HEALTH_SAFETY'
  | 'COMMUNICATION'
  | 'DOCUMENT_TEMPLATES'
  | 'CURRICULUM'
  | 'BRANDING'
  | 'INVENTORY'

const DEFAULTS: Record<string, Record<string, unknown>> = {
  OPERATING: {
    schoolStartTime: '08:30', schoolEndTime: '16:00',
    arrivalWindowStart: '08:00', arrivalWindowEnd: '09:30',
    pickupWindowStart: '15:30', pickupWindowEnd: '17:00',
    workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    lateArrivalRule: 'Marked LATE after arrival window ends',
    absenceRule: 'Uninformed absence triggers parent follow-up',
  },
  ADMISSION: {
    requiredDocuments: ['BIRTH_CERTIFICATE', 'PHOTO', 'AADHAAR'],
    approvalStages: ['Document Verification', 'Principal Approval', 'Enrolment'],
    registrationFeeRupees: 500,
  },
  STUDENT_PARENT: {
    requiredStudentFields: ['PHOTO', 'BLOOD_GROUP', 'ADDRESS', 'MEDICAL_NOTES'],
    pickupVerification: 'PIN_MATCH', maxAuthorizedPickups: 4,
    consentTypes: ['PHOTO_CONSENT v1', 'FIELD_TRIP_CONSENT v1', 'MEDICAL_CONSENT v1'],
    communicationPreferenceDefault: 'IN_APP',
  },
  FINANCE: { paymentMethods: ['CASH', 'UPI', 'BANK_TRANSFER'], dueDayOffset: 10 },
  CURRICULUM: {
    milestoneFramework: 'EYFS',
    learningAreas: ['Language & Literacy', 'Numeracy', 'Motor Skills', 'Social-Emotional', 'Creative Arts'],
    assessmentMethods: ['Teacher observation', 'Milestone checklist'],
  },
  HEALTH_SAFETY: {
    healthCheckRules: 'Visual wellness check at arrival; temperature check when symptomatic.',
    allergyCategories: ['FOOD', 'ENVIRONMENTAL', 'MEDICATION'],
    incidentCategories: ['MINOR_INJURY', 'FALL', 'ILLNESS', 'EMERGENCY'],
    emergencyContacts: [],
    escalationRules: 'EMERGENCY incidents alert parents immediately on all channels.',
    pickupVerificationRequired: true,
  },
  COMMUNICATION: {
    channels: ['IN_APP'],
    notificationEvents: [
      'ATTENDANCE_UPDATE',
      'HEALTH_ALERT',
      'FEE_DUE',
      'FEE_RECEIVED',
      'ANNOUNCEMENT',
      'INCIDENT_ALERT',
      'DAILY_SUMMARY',
      'TRANSPORT_DELAY',
      'STAFF_ALERT',
      'INVENTORY_ALERT',
    ],
    language: 'en-IN',
    templates: {
      ATTENDANCE_UPDATE: 'Child attendance update: {{studentName}} was marked {{status}} on {{date}}.',
      HEALTH_ALERT: 'Health & Wellness alert: {{title}} for {{studentName}}.',
      FEE_DUE: 'Fee reminder for {{studentName}}: Invoice {{invoiceNumber}} of {{amount}} is due on {{dueDate}}.',
      FEE_RECEIVED: 'Fee receipt confirmed for {{studentName}}: Payment {{paymentNumber}} of {{amount}} received with thanks.',
      TRANSPORT_DELAY: 'School transport delay alert for {{studentName}}: Bus route {{routeName}} delayed by {{delayMinutes}} mins.',
      INVENTORY_ALERT: 'Low stock notification: Item {{itemName}} has reached reorder level ({{availableQuantity}} remaining).',
      STAFF_ALERT: 'Staff notification: {{title}} - {{detail}}',
    },
  },
  DAILY_OPERATIONS: {
    attendanceEnabled: true,
    recordTypes: ['ARRIVAL', 'MEALS', 'NAP', 'BATHROOM', 'MOOD', 'ACTIVITIES', 'PICKUP'],
    parentSummaryTime: '16:30',
  },
  DOCUMENT_TEMPLATES: { templates: ['ADMISSION_FORM', 'CONSENT_FORM', 'RECEIPT', 'REPORT_CARD'] },
  BRANDING: { primaryColor: '#7C3AED', accentColor: '#3B82F6', layout: 'WINDOWS_SHELL' },
  INVENTORY: {
    allowNegativeStock: false,
    allowOverReceiving: false,
    expiryWarningDays: 30,
    lowStockThresholdPercent: 10,
    requirePRApproval: true,
    requireIssueApproval: false,
  },
}

/** Read a domain config merged over typed defaults. Never throws. */
export async function getDomainConfig(
  tenantId: string,
  domain: ConfigDomainKey
): Promise<Record<string, unknown>> {
  try {
    const row = await db.schoolConfig.findUnique({
      where: { tenantId_domain: { tenantId, domain } },
    })
    return { ...(DEFAULTS[domain] || {}), ...((row?.data as Record<string, unknown>) || {}) }
  } catch {
    return { ...(DEFAULTS[domain] || {}) }
  }
}

export function getOperating(t: Record<string, unknown>): OperatingConfig {
  return t as unknown as OperatingConfig
}
export function getAdmissionConfig(t: Record<string, unknown>): AdmissionConfig {
  return t as unknown as AdmissionConfig
}
export function getStudentParentConfig(t: Record<string, unknown>): StudentParentConfig {
  return t as unknown as StudentParentConfig
}
export function getFinanceConfig(t: Record<string, unknown>): FinanceConfig {
  return t as unknown as FinanceConfig
}
export function getHealthSafety(t: Record<string, unknown>): HealthSafetyConfig {
  return t as unknown as HealthSafetyConfig
}
export function getCommunication(t: Record<string, unknown>): CommunicationConfig {
  return t as unknown as CommunicationConfig
}
export function getDailyOps(t: Record<string, unknown>): DailyOperationsConfig {
  return t as unknown as DailyOperationsConfig
}
export function getCurriculum(t: Record<string, unknown>): CurriculumConfig {
  return t as unknown as CurriculumConfig
}
export function getInventoryConfig(t: Record<string, unknown>): InventoryConfig {
  return t as unknown as InventoryConfig
}

/** Is `notificationEvents` enabled for this event? (single notification rule source) */
export async function notificationEventEnabled(tenantId: string, event: string): Promise<boolean> {
  const cfg = getCommunication(await getDomainConfig(tenantId, 'COMMUNICATION'))
  return (cfg.notificationEvents || []).includes(event)
}
