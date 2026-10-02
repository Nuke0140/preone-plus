/**
 * M01 — Follow-up / Operational Exception Engine (Impact Map I-2, Spec §14/§32/§42/§43)
 *
 * The ONE reusable exception + follow-up aggregate. Rules of the house:
 *  · Raising a follow-up NEVER resolves anything — status starts OPEN and a
 *    human must transition it (notification ≠ resolution).
 *  · `dedupeKey` makes raising idempotent per source (e.g. one absence
 *    follow-up per child per day).
 *  · Every transition is audited via the existing audit architecture.
 */

import { db } from './db'
import { audit } from './sequence'

type PrismaEnum<T> = T

export type FollowUpDomain =
  | 'ATTENDANCE' | 'HEALTH' | 'SAFETY' | 'LEARNING' | 'CARE' | 'ADMISSION' | 'FINANCE' | 'OPERATIONS'
export type FollowUpSeverity = 'INFO' | 'WARNING' | 'URGENT' | 'EMERGENCY'
import { SchoolRole } from '@/lib/auth'

export type FollowUpStatus = 'OPEN' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED'

/** Severity → responsible default role (who should act). */
export const RESPONSIBLE_ROLE: Record<FollowUpSeverity | 'DEFAULT', SchoolRole> = {
  EMERGENCY: 'PRINCIPAL',
  URGENT: 'PRINCIPAL',
  WARNING: 'TEACHER',
  INFO: 'TEACHER',
  DEFAULT: 'TEACHER',
}

export interface RaiseFollowUpInput {
  tenantId: string
  domain: FollowUpDomain
  severity: FollowUpSeverity
  title: string
  detail?: string
  sourceType: string
  sourceId?: string
  dedupeKey?: string
  studentId?: string | null
  classroomId?: string | null
  branchId?: string | null
  academicSessionId?: string | null
  responsibleRole?: SchoolRole
  dueAt?: Date | null
  actorId?: string | null
  actorName?: string | null
}

/**
 * Raise a follow-up. Idempotent when dedupeKey matches an existing row —
 * returns the existing one instead of duplicating (unless it is already
 * resolved/closed, in which case a fresh one is opened for the new occurrence).
 */
export async function raiseFollowUp(input: RaiseFollowUpInput) {
  if (input.dedupeKey) {
    const existing = await db.followUp.findUnique({ where: { dedupeKey: input.dedupeKey } })
    if (existing) {
      if (!['RESOLVED', 'CLOSED'].includes(existing.status)) {
        return { followUp: existing, created: false }
      }
      // Re-open existing resolved ticket for new occurrence safely
      const reopened = await db.followUp.update({
        where: { id: existing.id },
        data: {
          status: 'OPEN',
          severity: input.severity,
          title: input.title,
          detail: input.detail,
          resolvedAt: null,
          resolvedByName: null,
          closedAt: null,
          actionTaken: null,
          outcome: null,
        },
      })
      return { followUp: reopened, created: true }
    }
  }

  const fu = await db.followUp.create({
    data: {
      tenantId: input.tenantId,
      domain: input.domain,
      severity: input.severity,
      title: input.title,
      detail: input.detail,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      dedupeKey: input.dedupeKey,
      studentId: input.studentId ?? undefined,
      classroomId: input.classroomId ?? undefined,
      branchId: input.branchId ?? undefined,
      academicSessionId: input.academicSessionId ?? undefined,
      responsibleRole: (input.responsibleRole ?? RESPONSIBLE_ROLE[input.severity] ?? 'TEACHER') as any,
      dueAt: input.dueAt ?? undefined,
      status: 'OPEN',
      createdById: input.actorId ?? undefined,
      createdByName: input.actorName ?? 'System',
    },
  })

  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    actorName: input.actorName ?? 'System',
    action: 'FOLLOWUP_RAISED',
    entity: 'FollowUp',
    entityId: fu.id,
    summary: `[${input.severity}] ${input.domain}: ${input.title}`,
  })

  return { followUp: fu, created: true }
}

/** Allowed transitions (Spec §42 status machine, reopen allowed for CLOSED). */
const TRANSITIONS: Record<FollowUpStatus, FollowUpStatus[]> = {
  OPEN: ['ACKNOWLEDGED', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'],
  ACKNOWLEDGED: ['IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['WAITING', 'RESOLVED', 'CLOSED'],
  WAITING: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED'],
  CLOSED: ['OPEN'], // reopen
}

export interface TransitionInput {
  id: string
  tenantId: string
  action: 'acknowledge' | 'start' | 'wait' | 'resolve' | 'close' | 'reopen'
  note?: string          // actionTaken / outcome / reopen reason
  outcome?: string       // resolution outcome
  actorId?: string | null
  actorName?: string | null
}

const ACTION_TARGET: Record<TransitionInput['action'], FollowUpStatus> = {
  acknowledge: 'ACKNOWLEDGED',
  start: 'IN_PROGRESS',
  wait: 'WAITING',
  resolve: 'RESOLVED',
  close: 'CLOSED',
  reopen: 'OPEN',
}

export async function transitionFollowUp(input: TransitionInput) {
  const fu = await db.followUp.findFirst({ where: { id: input.id, tenantId: input.tenantId } })
  if (!fu) return { error: 'NOT_FOUND' as const }

  const target = ACTION_TARGET[input.action]
  if (!TRANSITIONS[fu.status as FollowUpStatus].includes(target)) {
    return { error: 'INVALID_TRANSITION' as const, from: fu.status, to: target }
  }

  const data: Record<string, unknown> = { status: target }
  if (input.action === 'resolve') {
    data.resolvedAt = new Date()
    data.resolvedByName = input.actorName ?? 'System'
    data.outcome = input.outcome ?? input.note ?? 'Resolved'
    if (input.note) data.actionTaken = input.note
  }
  if (input.action === 'close') data.closedAt = new Date()
  if (input.action === 'reopen') {
    data.resolvedAt = null
    data.closedAt = null
    data.resolvedByName = null
    if (input.note) data.detail = input.note
  }
  if (input.action !== 'resolve' && input.action !== 'reopen' && input.note) {
    data.actionTaken = input.note
  }

  const updated = await db.followUp.update({ where: { id: fu.id }, data })

  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    actorName: input.actorName ?? 'System',
    action: `FOLLOWUP_${input.action.toUpperCase()}`,
    entity: 'FollowUp',
    entityId: fu.id,
    summary: `${fu.title}: ${fu.status} → ${target}${input.outcome ? ` — ${input.outcome}` : ''}`,
  })

  return { followUp: updated }
}

/** Resolve by dedupe key — used by auto-resolution flows (e.g. payment received). */
export async function resolveByDedupeKey(
  tenantId: string,
  dedupeKey: string,
  outcome: string,
  actor?: { id?: string | null; name?: string | null }
) {
  const fu = await db.followUp.findUnique({ where: { dedupeKey } })
  if (!fu || ['RESOLVED', 'CLOSED'].includes(fu.status)) return null
  const updated = await db.followUp.update({
    where: { id: fu.id },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolvedByName: actor?.name ?? 'System',
      outcome,
    },
  })
  await audit({
    tenantId,
    actorId: actor?.id,
    actorName: actor?.name ?? 'System',
    action: 'FOLLOWUP_AUTO_RESOLVED',
    entity: 'FollowUp',
    entityId: fu.id,
    summary: `${fu.title} auto-resolved: ${outcome}`,
  })
  return updated
}
