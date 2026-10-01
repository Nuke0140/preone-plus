/**
 * M01 — Capacity management (Impact Map I-8, Spec §9)
 *
 * Program Capacity + Section Capacity → Available Seats → Admission/Allocation.
 * No silent overbooking: allocation paths must call these guards.
 * Overrides require an explicit `override` flag + are audited by the caller.
 */
import { db } from './db'

export interface SeatInfo {
  capacity: number
  current: number
  available: number
}

export async function classroomSeats(classroomId: string): Promise<SeatInfo> {
  const c = await db.classroom.findUnique({ where: { id: classroomId }, select: { capacity: true } })
  const current = await db.student.count({
    where: { currentClassroomId: classroomId, status: 'ACTIVE', deletedAt: null },
  })
  const capacity = c?.capacity ?? 0
  return { capacity, current, available: Math.max(0, capacity - current) }
}

export async function classroomHasSeat(classroomId: string): Promise<boolean> {
  const seats = await classroomSeats(classroomId)
  return seats.available > 0
}
