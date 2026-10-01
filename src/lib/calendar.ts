/**
 * M01 — Calendar integration (Impact Map §1 row 2, Spec §25)
 *
 * Calendar configuration feeds Attendance, Operations, comms and reports.
 * A "day status" is derived from: CalendarEvent (HOLIDAY/VACATION) >
 * SchoolConfig OPERATING workingDays. Never duplicated in modules.
 */
import { db } from './db'
import { getDomainConfig, getOperating } from './config'
import { isoDate } from './format'

export type DayStatus = 'WORKING_DAY' | 'NON_WORKING_DAY' | 'HOLIDAY' | 'VACATION' | 'EVENT_DAY'

export function dayOfWeekKey(d: Date): string {
  return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()]
}

export interface DayInfo {
  date: string
  status: DayStatus
  eventTitle?: string
  workingDay: boolean
  attendanceExpected: boolean
}

export async function dayStatus(tenantId: string, date: string | Date, branchId?: string | null): Promise<DayInfo> {
  const d = typeof date === 'string' ? new Date(date) : date
  const dateStr = isoDate(d)

  const events = await db.calendarEvent.findMany({
    where: {
      tenantId,
      date: d,
      ...(branchId ? { OR: [{ branchId: null }, { branchId }] } : {}),
    },
    orderBy: { createdAt: 'asc' },
  })

  const holiday = events.find((e) => e.type === 'HOLIDAY' || e.type === 'VACATION')
  const event = events.find((e) => e.type === 'EVENT' || e.type === 'PARENT_MEETING' || e.type === 'ASSESSMENT')

  if (holiday) {
    return {
      date: dateStr,
      status: holiday.type === 'VACATION' ? 'VACATION' : 'HOLIDAY',
      eventTitle: holiday.title,
      workingDay: false,
      attendanceExpected: false,
    }
  }

  const operating = getOperating(await getDomainConfig(tenantId, 'OPERATING'))
  const working = (operating.workingDays || []).includes(dayOfWeekKey(d))
  if (!working) {
    return { date: dateStr, status: 'NON_WORKING_DAY', workingDay: false, attendanceExpected: false }
  }

  return {
    date: dateStr,
    status: event ? 'EVENT_DAY' : 'WORKING_DAY',
    eventTitle: event?.title,
    workingDay: true,
    attendanceExpected: true,
  }
}
