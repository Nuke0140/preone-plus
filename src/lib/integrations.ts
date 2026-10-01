/**
 * M01 — Domain event → infrastructure wiring (Impact Map I-2/I-14)
 *
 * Registers the handlers that turn meaningful domain state changes into:
 *   · FollowUp engine raises/resolutions (Spec §14, §42)
 *   · Communication funnel deliveries (Spec §20)
 *
 * Imported by API routes that emit events — safe to import multiple times
 * (registration is idempotent per module instance).
 */
import { onDomainEvent } from './events'
import { raiseFollowUp, resolveByDedupeKey, RESPONSIBLE_ROLE } from './followups'
import { recordChildEvent, broadcast } from './notify'
import { sessionForClassroom } from './academic'
import { registerNotificationListeners } from './notifications/event-listeners'

let registered = false

export function registerIntegrations() {
  if (registered) return
  registered = true

  registerNotificationListeners()

  onDomainEvent(async (e) => {
    switch (e.type) {
      case 'AttendanceExceptionDetected': {
        const fu = await raiseFollowUp({
          tenantId: e.tenantId,
          domain: 'ATTENDANCE',
          severity: e.status === 'ABSENT' ? 'WARNING' : 'INFO',
          title: e.status === 'ABSENT' ? 'Child absent without expected reason' : 'Child arrived late',
          detail: e.detail,
          sourceType: 'Attendance',
          sourceId: `${e.studentId}:${e.date}`,
          dedupeKey: `attendance:${e.studentId}:${e.date}:${e.status}`,
          studentId: e.studentId,
          classroomId: e.classroomId,
          responsibleRole: 'TEACHER',
        })
        if (fu.created) {
          await recordChildEvent({
            tenantId: e.tenantId,
            studentId: e.studentId,
            type: 'NOTE',
            title: e.status === 'ABSENT' ? 'Marked absent today' : 'Arrived late today',
            body: e.detail,
            classroomId: e.classroomId,
          })
        }
        break
      }

      case 'HealthIncidentCreated': {
        const session = e.classroomId ? await sessionForClassroom(e.classroomId) : null
        await raiseFollowUp({
          tenantId: e.tenantId,
          domain: 'HEALTH',
          severity: e.severity,
          title: e.title,
          detail: e.detail,
          sourceType: 'HealthIncident',
          sourceId: e.sourceId,
          dedupeKey: e.sourceId ? undefined : `health:${e.studentId}:${Date.now()}`,
          studentId: e.studentId,
          classroomId: e.classroomId,
          academicSessionId: session?.id,
          responsibleRole: RESPONSIBLE_ROLE[e.severity],
        })
        await recordChildEvent({
          tenantId: e.tenantId,
          studentId: e.studentId,
          type: 'INCIDENT',
          title: e.title,
          body: e.detail,
          classroomId: e.classroomId,
          notifyEvent: 'INCIDENT_ALERT',
        })
        break
      }

      case 'PickupBlocked': {
        await raiseFollowUp({
          tenantId: e.tenantId,
          domain: 'SAFETY',
          severity: 'EMERGENCY',
          title: e.title,
          detail: e.detail,
          sourceType: 'PickupAttempt',
          sourceId: e.sourceId,
          studentId: e.studentId,
          responsibleRole: 'PRINCIPAL',
        })
        break
      }

      case 'ObservationRecorded': {
        if (e.concern === 'NEEDS_ATTENTION' || e.concern === 'URGENT') {
          await raiseFollowUp({
            tenantId: e.tenantId,
            domain: 'LEARNING',
            severity: e.concern === 'URGENT' ? 'URGENT' : 'WARNING',
            title: e.title,
            detail: e.detail,
            sourceType: 'Observation',
            sourceId: e.observationId,
            dedupeKey: `observation:${e.observationId}`,
            studentId: e.studentId,
            responsibleRole: 'TEACHER',
          })
        }
        break
      }

      case 'InvoiceIssued': {
        await broadcast({
          tenantId: e.tenantId,
          type: 'FEE_REMINDER',
          title: `New invoice ${e.invoiceNumber}`,
          body: `Fee invoice issued. Due ${e.dueDate.toISOString().slice(0, 10)}.`,
          audience: 'ALL_PARENTS',
        }).catch(() => {})
        break
      }

      case 'InvoiceOverdue': {
        await raiseFollowUp({
          tenantId: e.tenantId,
          domain: 'FINANCE',
          severity: 'WARNING',
          title: `Invoice ${e.invoiceNumber} overdue`,
          detail: `Outstanding balance ₹${(e.balanceCents / 100).toFixed(2)}. Send reminder / collect.`,
          sourceType: 'Invoice',
          sourceId: e.invoiceId,
          dedupeKey: `invoice:${e.invoiceId}:overdue`,
          studentId: e.studentId,
          responsibleRole: 'ACCOUNTS',
        })
        break
      }

      case 'PaymentReceived': {
        if (e.fullyPaid) {
          await resolveByDedupeKey(
            e.tenantId,
            `invoice:${e.invoiceId}:overdue`,
            `Payment ${e.paymentNumber} received (₹${(e.amountCents / 100).toFixed(2)}) — invoice fully paid`
          )
          await recordChildEvent({
            tenantId: e.tenantId,
            studentId: e.studentId,
            type: 'NOTE',
            title: 'Fee payment received',
            body: `Payment ${e.paymentNumber} received. Thank you!`,
            notifyEvent: 'FEE_RECEIVED',
          })
        }
        break
      }

      default:
        break
    }
  })
}
