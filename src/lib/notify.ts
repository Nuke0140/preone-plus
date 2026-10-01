/**
 * M01 — Communication funnel (Impact Map §1 row 8, Spec §20/§22)
 *
 * ONE funnel over the EXISTING communication infrastructure — modules never
 * send notifications directly and no second notification engine is created:
 *   · child-scoped events  → TimelineEntry (parent-visible on the child timeline)
 *   · broadcasts           → Announcement (existing audience model)
 *
 * Governance:
 *   · an event type that is disabled in COMMUNICATION config is not delivered
 *   · health/safety alerts ALWAYS raise follow-ups upstream (never only notify)
 *   · delivery record = the TimelineEntry / Announcement row itself (receipt)
 */
import { db } from './db'
import { notificationEventEnabled } from './config'
import { audit } from './sequence'

export type NotificationEvent =
  | 'ATTENDANCE_UPDATE' | 'HEALTH_ALERT' | 'FEE_DUE' | 'FEE_RECEIVED'
  | 'ANNOUNCEMENT' | 'DAILY_SUMMARY' | 'INCIDENT_ALERT'
  | 'TRANSPORT_DELAY' | 'STAFF_ALERT' | 'INVENTORY_ALERT'

export interface ChildEventInput {
  tenantId: string
  studentId: string
  type: 'ARRIVAL' | 'MEAL' | 'NAP' | 'ACTIVITY' | 'BATHROOM' | 'INCIDENT' | 'NOTE' | 'PICKUP' | 'HEALTH_CHECK' | 'MILESTONE' | 'OBSERVATION'
  title: string
  body?: string
  mood?: string
  classroomId?: string | null
  academicSessionId?: string | null
  actorId?: string | null
  observationId?: string | null
  /** notification event that gates delivery (defaults derived from type) */
  notifyEvent?: NotificationEvent
}

const TYPE_TO_EVENT: Record<string, NotificationEvent> = {
  INCIDENT: 'INCIDENT_ALERT',
  HEALTH_CHECK: 'HEALTH_ALERT',
  MEAL: 'DAILY_SUMMARY',
  NAP: 'DAILY_SUMMARY',
  ACTIVITY: 'DAILY_SUMMARY',
  ARRIVAL: 'ATTENDANCE_UPDATE',
  PICKUP: 'ATTENDANCE_UPDATE',
  NOTE: 'DAILY_SUMMARY',
  MILESTONE: 'DAILY_SUMMARY',
  OBSERVATION: 'DAILY_SUMMARY',
  BATHROOM: 'DAILY_SUMMARY',
}

/**
 * Record a child-scoped event on the timeline (single write path) and mark
 * it parent-visible per COMMUNICATION config. Returns null when the event
 * type is not configured for notification AND is not a core care record —
 * care records are always written; `notifyEvent` only controls extra
 * event-gating for alert-style entries.
 */
export async function recordChildEvent(input: ChildEventInput) {
  const entry = await db.timelineEntry.create({
    data: {
      tenantId: input.tenantId,
      studentId: input.studentId,
      classroomId: input.classroomId ?? undefined,
      academicSessionId: input.academicSessionId ?? undefined,
      type: input.type,
      title: input.title,
      body: input.body,
      mood: input.mood,
      authorId: input.actorId ?? undefined,
      observationId: input.observationId ?? undefined,
    },
  })

  const ev = input.notifyEvent ?? TYPE_TO_EVENT[input.type]
  if (ev && !(await notificationEventEnabled(input.tenantId, ev))) {
    // still written to the child timeline (record), just not pushed as alert
    await audit({
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: 'NOTIFY_SUPPRESSED',
      entity: 'TimelineEntry',
      entityId: entry.id,
      summary: `${ev} disabled in COMMUNICATION config — entry kept on timeline only`,
    })
  }

  return entry
}

export interface BroadcastInput {
  tenantId: string
  title: string
  body: string
  type?: 'GENERAL' | 'HOLIDAY' | 'EMERGENCY' | 'EVENT' | 'ACHIEVEMENT' | 'IMPORTANT' | 'FEE_REMINDER' | 'ACADEMIC'
  audience?: 'ALL_PARENTS' | 'BRANCH_PARENTS' | 'CLASS_PARENTS' | 'ALL_STAFF' | 'SCHOOL_WIDE'
  branchId?: string | null
  classroomId?: string | null
  authorId?: string | null
}

/** Broadcast via the existing Announcement aggregate (event-gated). */
export async function broadcast(input: BroadcastInput) {
  const type = input.type ?? 'GENERAL'
  const gated = type === 'EMERGENCY' || type === 'IMPORTANT' || type === 'FEE_REMINDER' || type === 'HOLIDAY'
    ? (type === 'EMERGENCY' ? 'INCIDENT_ALERT' : type === 'FEE_REMINDER' ? 'FEE_DUE' : 'ANNOUNCEMENT')
    : 'ANNOUNCEMENT'

  const enabled = await notificationEventEnabled(input.tenantId, gated)
  if (!enabled && type !== 'GENERAL') return null

  return db.announcement.create({
    data: {
      tenantId: input.tenantId,
      branchId: input.branchId ?? undefined,
      classroomId: input.classroomId ?? undefined,
      title: input.title,
      body: input.body,
      type,
      audience: input.audience ?? 'SCHOOL_WIDE',
      status: 'PUBLISHED',
      authorId: input.authorId ?? undefined,
    },
  })
}
