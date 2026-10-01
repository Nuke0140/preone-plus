/**
 * M01 — Academic Year integration (Impact Map I-1, Spec §6)
 *
 * Every operational flow resolves: tenant → school → branch → academic year.
 * Operational records carry academicSessionId at write time; historical rows
 * are never rewritten. Defaults resolve to the CURRENT session so pre-M01
 * records and partial setups keep functioning.
 */
import { db } from './db'

export async function currentSession(tenantId: string) {
  return db.academicSession.findFirst({
    where: { tenantId, isCurrent: true },
    orderBy: { startDate: 'desc' },
  })
}

/** Best-effort session for a classroom (the classroom IS year-scoped). */
export async function sessionForClassroom(classroomId: string) {
  const c = await db.classroom.findUnique({
    where: { id: classroomId },
    select: { academicSessionId: true, academicSession: true },
  })
  return c?.academicSession ?? null
}

/**
 * Resolve the session that a write belongs to. Order:
 * explicit → classroom's session → tenant current session → null (legacy row).
 */
export async function resolveSessionId(tenantId: string, opts?: { classroomId?: string | null; sessionId?: string | null }) {
  if (opts?.sessionId) {
    const s = await db.academicSession.findFirst({ where: { id: opts.sessionId, tenantId } })
    if (s) return s
  }
  if (opts?.classroomId) {
    const s = await sessionForClassroom(opts.classroomId)
    if (s) return s
  }
  return currentSession(tenantId)
}
