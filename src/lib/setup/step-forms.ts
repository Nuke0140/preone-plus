/**
 * M00 — Config-domain form schemas for the guided setup step UI.
 * Each SchoolConfig domain renders from this schema (single renderer).
 * Values are stored in SchoolConfig.data JSON — one source of truth per domain.
 */

export interface FormField {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'time' | 'color' | 'textarea' | 'select' | 'checklist' | 'list' | 'checkbox'
  options?: string[]
  required?: boolean
  help?: string
  full?: boolean
}

export interface DomainForm {
  intro: string
  fields: FormField[]
  defaults: Record<string, unknown>
}

export const CONFIG_FORMS: Record<string, DomainForm> = {
  OPERATING: {
    intro: 'School hours, arrival & pickup windows and working days. Daily Operations (attendance, daily sheets) read from here — never duplicate these rules inside modules.',
    fields: [
      { key: 'schoolStartTime', label: 'School start time', type: 'time', required: true },
      { key: 'schoolEndTime', label: 'School end time', type: 'time', required: true },
      { key: 'arrivalWindowStart', label: 'Arrival window from', type: 'time' },
      { key: 'arrivalWindowEnd', label: 'Arrival window to', type: 'time' },
      { key: 'pickupWindowStart', label: 'Pickup window from', type: 'time' },
      { key: 'pickupWindowEnd', label: 'Pickup window to', type: 'time' },
      { key: 'workingDays', label: 'Working days', type: 'checklist', options: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'], required: true, full: true, help: 'Attendance and calendar treat non-working days as closed.' },
      { key: 'lateArrivalRule', label: 'Late arrival rule', type: 'text', full: true, help: 'e.g. Marked LATE after arrival window; parent notified.' },
      { key: 'earlyPickupRule', label: 'Early pickup rule', type: 'text', full: true },
      { key: 'absenceRule', label: 'Absence rule', type: 'text', full: true, help: 'e.g. Uninformed absence triggers parent follow-up after 10:00.' },
      { key: 'closureRule', label: 'Closure rule', type: 'textarea', full: true, help: 'Holidays / weather / emergency closures behaviour.' },
    ],
    defaults: {
      schoolStartTime: '08:30', schoolEndTime: '16:00',
      arrivalWindowStart: '08:00', arrivalWindowEnd: '09:30',
      pickupWindowStart: '15:30', pickupWindowEnd: '17:00',
      workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      lateArrivalRule: 'Marked LATE after arrival window ends', absenceRule: 'Uninformed absence triggers parent follow-up',
    },
  },
  ADMISSION: {
    intro: 'Admission window, fees, required documents and the approval workflow. Applications cannot be accepted while this is incomplete.',
    fields: [
      { key: 'admissionOpenDate', label: 'Admissions open from', type: 'date', required: true },
      { key: 'admissionCloseDate', label: 'Admissions close on', type: 'date' },
      { key: 'registrationFeeRupees', label: 'Registration fee (₹)', type: 'number' },
      { key: 'admissionFeeRupees', label: 'Admission fee (₹)', type: 'number' },
      { key: 'ageEligibilityNote', label: 'Age eligibility note', type: 'text', full: true, help: 'Displayed on the admission form; program age bands are enforced on applications.' },
      { key: 'requiredDocuments', label: 'Required documents', type: 'checklist', options: ['BIRTH_CERTIFICATE', 'AADHAAR', 'PHOTO', 'MEDICAL_CERTIFICATE', 'ADDRESS_PROOF', 'PARENT_ID', 'PREVIOUS_SCHOOL_REPORT'], required: true, full: true },
      { key: 'approvalStages', label: 'Approval workflow stages', type: 'list', required: true, full: true, help: 'One per line, in order. e.g. Document Verification → Principal Approval → Enrolment' },
    ],
    defaults: {
      requiredDocuments: ['BIRTH_CERTIFICATE', 'PHOTO', 'AADHAAR'],
      approvalStages: ['Document Verification', 'Principal Approval', 'Enrolment'],
      registrationFeeRupees: 500,
    },
  },
  STUDENT_PARENT: {
    intro: 'Data you require from students & parents, authorised pickup rules and consent types (with versions). Feeds admissions, health, attendance, pickup and the parent portal.',
    fields: [
      { key: 'requiredStudentFields', label: 'Required student fields beyond basics', type: 'checklist', options: ['PHOTO', 'BLOOD_GROUP', 'ADDRESS', 'MEDICAL_NOTES', 'PREVIOUS_SCHOOL'], full: true },
      { key: 'pickupVerification', label: 'Authorised pickup verification', type: 'select', options: ['PIN_MATCH', 'ID_CARD', 'PHOTO_VERIFICATION'], required: true },
      { key: 'maxAuthorizedPickups', label: 'Max authorised pickups per child', type: 'number' },
      { key: 'consentTypes', label: 'Consent types collected at enrolment', type: 'list', required: true, full: true, help: 'One per line. Each consent is stored with status + timestamp + version. e.g. PHOTO_CONSENT v1' },
      { key: 'communicationPreferenceDefault', label: 'Default parent communication preference', type: 'select', options: ['IN_APP', 'EMAIL', 'SMS'] },
    ],
    defaults: {
      requiredStudentFields: ['PHOTO', 'BLOOD_GROUP', 'ADDRESS', 'MEDICAL_NOTES'],
      pickupVerification: 'PIN_MATCH', maxAuthorizedPickups: 4,
      consentTypes: ['PHOTO_CONSENT v1', 'FIELD_TRIP_CONSENT v1', 'MEDICAL_CONSENT v1'],
      communicationPreferenceDefault: 'IN_APP',
    },
  },
  FINANCE: {
    intro: 'Payment acceptance and penalty rules. Fee heads and per-program plans are managed in Settings → Fees (existing Finance domain).',
    fields: [
      { key: 'paymentMethods', label: 'Accepted payment methods', type: 'checklist', options: ['CASH', 'CHEQUE', 'CARD', 'UPI', 'NET_BANKING', 'BANK_TRANSFER'], full: true },
      { key: 'dueDayOffset', label: 'Invoice due after (days)', type: 'number' },
      { key: 'penaltyRule', label: 'Late payment penalty rule', type: 'text', full: true, help: 'e.g. 2% of balance per overdue month (stored as paise on invoices).' },
    ],
    defaults: { paymentMethods: ['CASH', 'UPI', 'BANK_TRANSFER'], dueDayOffset: 10 },
  },
  CURRICULUM: {
    intro: 'Learning areas, skills and assessment methods per program. Observations and report cards use these — curriculum never exists without academic context.',
    fields: [
      { key: 'milestoneFramework', label: 'Milestone framework', type: 'select', options: ['EYFS', 'MONTESSORI', 'NATIONAL_ECE', 'CUSTOM'] },
      { key: 'learningAreas', label: 'Learning areas', type: 'list', required: true, full: true, help: 'One per line. e.g. Language & Literacy, Numeracy, Motor Skills, Social-Emotional, Creative Arts' },
      { key: 'assessmentMethods', label: 'Assessment methods', type: 'list', full: true, help: 'e.g. Teacher observation, Work samples, Checklist milestones' },
      { key: 'observationStructure', label: 'Observation structure note', type: 'text', full: true },
      { key: 'reportCardStructure', label: 'Report card structure note', type: 'text', full: true },
    ],
    defaults: {
      milestoneFramework: 'EYFS',
      learningAreas: ['Language & Literacy', 'Numeracy', 'Motor Skills', 'Social-Emotional', 'Creative Arts'],
      assessmentMethods: ['Teacher observation', 'Milestone checklist'],
    },
  },
  HEALTH_SAFETY: {
    intro: 'Health checks, allergy & incident categories, emergency contacts and escalation. Emergency workflows can bypass low-priority communication queues.',
    fields: [
      { key: 'healthCheckRules', label: 'Daily health check rule', type: 'textarea', full: true, help: 'e.g. Visual wellness check at arrival; temperature for symptomatic children.' },
      { key: 'allergyCategories', label: 'Allergy categories', type: 'checklist', options: ['FOOD', 'ENVIRONMENTAL', 'INSECT', 'MEDICATION', 'OTHER'], required: true, full: true },
      { key: 'medicationPolicy', label: 'Medication policy', type: 'textarea', full: true },
      { key: 'incidentCategories', label: 'Incident categories', type: 'checklist', options: ['MINOR_INJURY', 'FALL', 'ALLERGIC_REACTION', 'ILLNESS', 'EMERGENCY'], required: true, full: true },
      { key: 'emergencyContacts', label: 'Emergency contacts', type: 'list', required: true, full: true, help: 'One per line: Name — Role — Phone' },
      { key: 'escalationRules', label: 'Escalation rules', type: 'textarea', full: true, help: 'e.g. EMERGENCY incidents alert parents immediately via all channels.' },
      { key: 'pickupVerificationRequired', label: 'Require verified authorised pickup for release', type: 'checkbox' },
    ],
    defaults: {
      healthCheckRules: 'Visual wellness check at arrival; temperature check when symptomatic.',
      allergyCategories: ['FOOD', 'ENVIRONMENTAL', 'MEDICATION'],
      incidentCategories: ['MINOR_INJURY', 'FALL', 'ILLNESS', 'EMERGENCY'],
      emergencyContacts: ['School Admin — Front Desk — +91 90000 00000'],
      escalationRules: 'EMERGENCY incidents alert parents immediately on all channels and bypass quiet hours.',
      pickupVerificationRequired: true,
    },
  },
  COMMUNICATION: {
    intro: 'Channels and the central notification-event → recipient mapping. Modules never send notifications directly — they emit events this configuration consumes.',
    fields: [
      { key: 'channels', label: 'Enabled channels', type: 'checklist', options: ['IN_APP', 'WHATSAPP', 'SMS', 'EMAIL'], required: true, full: true, help: 'In-app is always available; other channels activate when a provider is connected.' },
      { key: 'notificationEvents', label: 'Notification events', type: 'checklist', options: ['ATTENDANCE_UPDATE', 'HEALTH_ALERT', 'FEE_DUE', 'FEE_RECEIVED', 'ANNOUNCEMENT', 'DAILY_SUMMARY', 'INCIDENT_ALERT'], required: true, full: true },
      { key: 'language', label: 'Default message language', type: 'select', options: ['en-IN', 'hi', 'mr', 'ta'] },
      { key: 'escalation', label: 'Escalation note', type: 'text', full: true, help: 'e.g. Unread urgent messages escalate to SMS after 2 hours.' },
    ],
    defaults: {
      channels: ['IN_APP'],
      notificationEvents: ['ATTENDANCE_UPDATE', 'HEALTH_ALERT', 'FEE_DUE', 'ANNOUNCEMENT', 'INCIDENT_ALERT'],
      language: 'en-IN',
    },
  },
  DOCUMENT_TEMPLATES: {
    intro: 'Template registry with school branding applied. Modules consume templates by type — receipts, certificates, report cards fall back to defaults if absent.',
    fields: [
      { key: 'templates', label: 'Templates to register', type: 'checklist', options: ['ADMISSION_FORM', 'CONSENT_FORM', 'MEDICAL_FORM', 'DECLARATION', 'RECEIPT', 'CERTIFICATE', 'REPORT_CARD'], required: true, full: true },
      { key: 'brandingNote', label: 'Branding note', type: 'text', full: true, help: 'All templates automatically carry the school logo and colours from Branding.' },
    ],
    defaults: { templates: ['ADMISSION_FORM', 'CONSENT_FORM', 'RECEIPT', 'REPORT_CARD'] },
  },
  DAILY_OPERATIONS: {
    intro: 'What the preschool records during the day. The daily sheet renders record types from this configuration — nothing is hardcoded in the module.',
    fields: [
      { key: 'attendanceEnabled', label: 'Enable daily attendance', type: 'checkbox', required: true },
      { key: 'recordTypes', label: 'Daily record types on the child timeline', type: 'checklist', options: ['ARRIVAL', 'MEALS', 'NAP', 'BATHROOM', 'MOOD', 'ACTIVITIES', 'NOTES', 'PICKUP', 'DAILY_OBSERVATION'], required: true, full: true, help: 'Teachers see exactly these entries on the daily sheet; parents see them on the child timeline.' },
      { key: 'arrivalNote', label: 'Arrival note', type: 'text', full: true },
      { key: 'departureNote', label: 'Departure / pickup note', type: 'text', full: true },
      { key: 'parentSummaryTime', label: 'Daily parent summary sent at', type: 'time' },
    ],
    defaults: {
      attendanceEnabled: true,
      recordTypes: ['ARRIVAL', 'MEALS', 'NAP', 'BATHROOM', 'MOOD', 'ACTIVITIES', 'PICKUP'],
      parentSummaryTime: '16:30',
    },
  },
  BRANDING: {
    intro: 'Uses the existing PreOne Theme Engine. Logo and colours apply to login, portals, receipts, certificates and communication templates.',
    fields: [
      { key: 'primaryColor', label: 'Primary colour', type: 'color' },
      { key: 'accentColor', label: 'Accent colour', type: 'color' },
      { key: 'bannerUrl', label: 'Banner image URL', type: 'text', full: true },
      { key: 'layout', label: 'Default layout', type: 'select', options: ['WINDOWS_SHELL', 'CLASSIC_SIDEBAR'] },
    ],
    defaults: { primaryColor: '#7C3AED', accentColor: '#3B82F6', layout: 'WINDOWS_SHELL' },
  },
  MOOD_ENVIRONMENT: {
    intro: 'Child wellbeing framework and classroom environment parameters. Feeds daily care logs and teacher wellbeing alerts.',
    fields: [
      { key: 'enabledMoods', label: 'Trackable child moods', type: 'checklist', options: ['HAPPY', 'CALM', 'ENERGETIC', 'SAD', 'CRANKY', 'TIRED', 'SICK'], required: true, full: true },
      { key: 'environmentFactors', label: 'Classroom environment factors', type: 'checklist', options: ['TEMPERATURE', 'NOISE_LEVEL', 'LIGHTING', 'PLAY_CLEANLINESS'], full: true },
      { key: 'alertOnSustainedDistress', label: 'Alert head teacher if child remains distressed across 2 checks', type: 'checkbox' },
      { key: 'notes', label: 'Operating guidance for teachers', type: 'textarea', full: true },
    ],
    defaults: {
      enabledMoods: ['HAPPY', 'CALM', 'ENERGETIC', 'CRANKY', 'TIRED'],
      environmentFactors: ['TEMPERATURE', 'NOISE_LEVEL', 'PLAY_CLEANLINESS'],
      alertOnSustainedDistress: true,
    },
  },
  PROMOTION: {
    intro: 'Academic year-end student promotion rules. Protects immutable historical allocation while setting up next year rosters.',
    fields: [
      { key: 'progressionMappingNote', label: 'Progression sequence', type: 'text', full: true, help: 'e.g. Playgroup → Nursery → LKG → UKG' },
      { key: 'requireTeacherSignOff', label: 'Require primary teacher developmental sign-off before promotion', type: 'checkbox' },
      { key: 'capacityGuardStrategy', label: 'Capacity full strategy', type: 'select', options: ['STRICT_REJECT', 'WAITLIST_IF_FULL'], required: true },
      { key: 'preserveUnpaidBalance', label: 'Carry forward unpaid invoices into next session', type: 'checkbox' },
    ],
    defaults: {
      progressionMappingNote: 'Playgroup → Nursery → LKG → UKG',
      requireTeacherSignOff: true,
      capacityGuardStrategy: 'WAITLIST_IF_FULL',
      preserveUnpaidBalance: true,
    },
  },
}
