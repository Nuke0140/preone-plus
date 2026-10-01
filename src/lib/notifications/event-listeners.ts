/**
 * PreOne — Cross-Module Notification Event Listeners
 *
 * MISSION:
 * Registers handlers on the single-process domain-event dispatcher (`emit` in `src/lib/events.ts`).
 * Automatically wires domain state changes to the central `NotificationEngine`:
 * - Attendance: AttendanceExceptionDetected -> NotificationEngine (ATTENDANCE_UPDATE)
 * - Health / Safety: HealthIncidentCreated, PickupBlocked -> NotificationEngine (HEALTH_ALERT, EMERGENCY)
 * - Finance: InvoiceIssued, InvoiceOverdue, PaymentReceived -> NotificationEngine (FEE_DUE, FEE_RECEIVED)
 * - Transport: ParentDelayAlert -> NotificationEngine (TRANSPORT_DELAY)
 * - Inventory: StockBelowReorderLevel, StockExpiringSoon -> NotificationEngine (INVENTORY_ALERT)
 * - HR: StaffOnboarded, LeaveSubmitted, LeaveApproved, TeacherCoverageRequired -> NotificationEngine (STAFF_ALERT)
 */

import { onDomainEvent } from '@/lib/events'
import { NotificationEngine } from './notification-engine'
import { db } from '@/lib/db'

let listenersRegistered = false

export function registerNotificationListeners() {
  if (listenersRegistered) return
  listenersRegistered = true

  onDomainEvent(async (e) => {
    try {
      switch (e.type) {
        case 'AttendanceExceptionDetected': {
          const student = await db.student.findUnique({
            where: { id: e.studentId },
            select: { firstName: true, lastName: true },
          })
          const studentName = [student?.firstName, student?.lastName].filter(Boolean).join(' ') || 'Child'

          await NotificationEngine.dispatch({
            tenantId: e.tenantId,
            eventType: 'ATTENDANCE_UPDATE',
            category: 'ATTENDANCE',
            severity: e.status === 'ABSENT' ? 'WARNING' : 'INFO',
            studentId: e.studentId,
            classroomId: e.classroomId,
            title: `Attendance Update: ${studentName}`,
            body: `Child attendance update: {{studentName}} was marked {{status}} on {{date}}.`,
            placeholders: {
              studentName,
              status: e.status,
              date: e.date,
            },
            linkUrl: `/app/daily-diary?tab=attendance`,
            skipTimelineEntry: true, // already recorded on timeline if needed
          })
          break
        }

        case 'HealthIncidentCreated': {
          const student = await db.student.findUnique({
            where: { id: e.studentId },
            select: { firstName: true, lastName: true },
          })
          const studentName = [student?.firstName, student?.lastName].filter(Boolean).join(' ') || 'Child'

          await NotificationEngine.dispatch({
            tenantId: e.tenantId,
            eventType: 'HEALTH_ALERT',
            category: 'HEALTH',
            severity: e.severity,
            studentId: e.studentId,
            classroomId: e.classroomId,
            title: `Health Alert: ${studentName}`,
            body: `Health & Wellness alert: {{title}} for {{studentName}}. {{detail}}`,
            placeholders: {
              studentName,
              title: e.title,
              detail: e.detail || '',
            },
            linkUrl: `/app/operations`,
            skipTimelineEntry: true,
          })
          break
        }

        case 'PickupBlocked': {
          const student = await db.student.findUnique({
            where: { id: e.studentId },
            select: { firstName: true, lastName: true },
          })
          const studentName = [student?.firstName, student?.lastName].filter(Boolean).join(' ') || 'Child'

          await NotificationEngine.dispatch({
            tenantId: e.tenantId,
            eventType: 'HEALTH_ALERT',
            category: 'SAFETY',
            severity: 'EMERGENCY',
            studentId: e.studentId,
            title: `URGENT: Pickup Security Alert for ${studentName}`,
            body: `Unauthorized or blocked pickup attempt for {{studentName}}. {{detail}}`,
            placeholders: {
              studentName,
              detail: e.detail || '',
            },
            linkUrl: `/app/operations`,
          })
          break
        }

        case 'InvoiceIssued': {
          const student = await db.student.findUnique({
            where: { id: e.studentId },
            select: { firstName: true, lastName: true },
          })
          const studentName = [student?.firstName, student?.lastName].filter(Boolean).join(' ') || 'Child'
          const amount = `₹${(e.totalCents / 100).toFixed(2)}`
          const dueDate = new Date(e.dueDate).toLocaleDateString('en-IN')

          await NotificationEngine.dispatch({
            tenantId: e.tenantId,
            eventType: 'FEE_DUE',
            category: 'FEES',
            severity: 'INFO',
            studentId: e.studentId,
            title: `Fee Invoice Issued: ${e.invoiceNumber}`,
            body: `Fee reminder for {{studentName}}: Invoice {{invoiceNumber}} of {{amount}} is due on {{dueDate}}.`,
            placeholders: {
              studentName,
              invoiceNumber: e.invoiceNumber,
              amount,
              dueDate,
            },
            linkUrl: `/app/finance`,
          })
          break
        }

        case 'InvoiceOverdue': {
          const student = await db.student.findUnique({
            where: { id: e.studentId },
            select: { firstName: true, lastName: true },
          })
          const studentName = [student?.firstName, student?.lastName].filter(Boolean).join(' ') || 'Child'
          const amount = `₹${(e.balanceCents / 100).toFixed(2)}`

          await NotificationEngine.dispatch({
            tenantId: e.tenantId,
            eventType: 'FEE_DUE',
            category: 'FEES',
            severity: 'WARNING',
            studentId: e.studentId,
            title: `Overdue Fee Reminder: ${e.invoiceNumber}`,
            body: `Fee overdue alert for {{studentName}}: Invoice {{invoiceNumber}} has an outstanding balance of {{amount}}.`,
            placeholders: {
              studentName,
              invoiceNumber: e.invoiceNumber,
              amount,
            },
            linkUrl: `/app/finance`,
          })
          break
        }

        case 'PaymentReceived': {
          const student = await db.student.findUnique({
            where: { id: e.studentId },
            select: { firstName: true, lastName: true },
          })
          const studentName = [student?.firstName, student?.lastName].filter(Boolean).join(' ') || 'Child'
          const amount = `₹${(e.amountCents / 100).toFixed(2)}`

          await NotificationEngine.dispatch({
            tenantId: e.tenantId,
            eventType: 'FEE_RECEIVED',
            category: 'FEES',
            severity: 'INFO',
            studentId: e.studentId,
            title: `Payment Receipt: ${e.paymentNumber}`,
            body: `Fee receipt confirmed for {{studentName}}: Payment {{paymentNumber}} of {{amount}} received with thanks.`,
            placeholders: {
              studentName,
              paymentNumber: e.paymentNumber,
              amount,
            },
            linkUrl: `/app/finance`,
          })
          break
        }

        case 'ParentDelayAlert': {
          await NotificationEngine.dispatch({
            tenantId: e.tenantId,
            eventType: 'TRANSPORT_DELAY',
            category: 'TRANSPORT',
            severity: 'WARNING',
            classroomId: e.classroomId,
            title: `Bus Route Delay Alert`,
            body: `School transport delay: Route is delayed by {{delayMinutes}} minutes today.`,
            placeholders: {
              delayMinutes: e.delayMinutes,
              date: e.date,
            },
            linkUrl: `/app/transport`,
          })
          break
        }

        case 'StockBelowReorderLevel': {
          await NotificationEngine.dispatch({
            tenantId: e.tenantId,
            eventType: 'INVENTORY_ALERT',
            category: 'INVENTORY',
            severity: 'WARNING',
            staffFilter: { role: 'ACCOUNTS' },
            title: `Low Stock Alert: ${e.itemName}`,
            body: `Low stock notification: Item {{itemName}} has reached reorder level ({{availableQuantity}} remaining, threshold: {{reorderLevel}}).`,
            placeholders: {
              itemName: e.itemName,
              availableQuantity: e.availableQuantity,
              reorderLevel: e.reorderLevel,
            },
            linkUrl: `/app/inventory`,
          })
          break
        }

        case 'StockExpiringSoon': {
          const expiryDate = new Date(e.expiryDate).toLocaleDateString('en-IN')
          await NotificationEngine.dispatch({
            tenantId: e.tenantId,
            eventType: 'INVENTORY_ALERT',
            category: 'INVENTORY',
            severity: 'WARNING',
            staffFilter: { role: 'ACCOUNTS' },
            title: `Stock Expiring Soon: ${e.itemName}`,
            body: `Expiry warning: Item {{itemName}} batch {{batchNumber}} expires on {{expiryDate}}.`,
            placeholders: {
              itemName: e.itemName,
              batchNumber: e.batchNumber || 'N/A',
              expiryDate,
            },
            linkUrl: `/app/inventory`,
          })
          break
        }

        case 'StaffOnboarded': {
          await NotificationEngine.dispatch({
            tenantId: e.tenantId,
            eventType: 'STAFF_ALERT',
            category: 'HR',
            severity: 'INFO',
            staffFilter: { role: 'PRINCIPAL' },
            title: `New Staff Onboarded: ${e.name}`,
            body: `Staff member {{name}} (Employee Code: {{employeeCode}}) has completed onboarding.`,
            placeholders: {
              name: e.name,
              employeeCode: e.employeeCode,
            },
            linkUrl: `/app/hr`,
          })
          break
        }

        case 'LeaveSubmitted': {
          await NotificationEngine.dispatch({
            tenantId: e.tenantId,
            eventType: 'STAFF_ALERT',
            category: 'HR',
            severity: 'INFO',
            staffFilter: { role: 'PRINCIPAL' },
            title: `Leave Request Submitted`,
            body: `A staff member has submitted a leave request for {{totalDays}} day(s). Requires approval.`,
            placeholders: {
              totalDays: e.totalDays,
            },
            linkUrl: `/app/hr`,
          })
          break
        }

        case 'LeaveApproved': {
          const profile = await db.staffProfile.findUnique({
            where: { id: e.staffProfileId },
            select: { userId: true },
          })
          if (profile?.userId) {
            await NotificationEngine.dispatch({
              tenantId: e.tenantId,
              eventType: 'STAFF_ALERT',
              category: 'HR',
              severity: 'INFO',
              staffFilter: { userId: profile.userId },
              title: `Leave Request Approved`,
              body: `Your leave request for {{totalDays}} day(s) has been approved.`,
              placeholders: {
                totalDays: e.totalDays,
              },
              linkUrl: `/app/hr`,
            })
          }
          break
        }

        case 'TeacherCoverageRequired': {
          await NotificationEngine.dispatch({
            tenantId: e.tenantId,
            eventType: 'STAFF_ALERT',
            category: 'HR',
            severity: 'WARNING',
            staffFilter: { role: 'COORDINATOR' },
            title: `Teacher Coverage Required`,
            body: `Teacher absence on {{date}} requires substitute coverage for classroom.`,
            placeholders: {
              date: e.date,
            },
            linkUrl: `/app/hr`,
          })
          break
        }

        default:
          break
      }
    } catch (err) {
      console.error('[NotificationListeners] Error handling domain event:', err)
    }
  })
}
