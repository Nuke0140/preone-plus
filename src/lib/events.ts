/**
 * M01 — Cross-context event seam (Impact Map I-14, Spec §31)
 *
 * Single-process Next.js app: this is the in-process domain-event dispatcher.
 * It is NOT a second notification engine and NOT a message broker — handlers
 * wire meaningful state changes to the EXISTING infrastructure:
 *   · FollowUp engine (src/lib/followups.ts)
 *   · Communication funnel (src/lib/notify.ts) over TimelineEntry/Announcement
 *   · AuditLog (already written at the action site)
 *
 * Emit only meaningful domain state changes — never plain CRUD.
 */

export type DomainEvent =
  | { type: 'StudentCreated'; tenantId: string; studentId: string; name: string; classroomId?: string }
  | { type: 'StudentAllocated'; tenantId: string; studentId: string; classroomId: string; reason?: string }
  | { type: 'AttendanceExceptionDetected'; tenantId: string; studentId: string; classroomId: string; date: string; status: 'ABSENT' | 'LATE'; detail?: string }
  | { type: 'HealthIncidentCreated'; tenantId: string; studentId: string; classroomId?: string; severity: 'URGENT' | 'EMERGENCY'; title: string; detail?: string; sourceId?: string }
  | { type: 'PickupBlocked'; tenantId: string; studentId: string; title: string; detail?: string; sourceId?: string }
  | { type: 'ObservationRecorded'; tenantId: string; studentId: string; observationId: string; concern: 'NORMAL' | 'PROGRESS' | 'NEEDS_ATTENTION' | 'URGENT'; category?: string | null; title: string; detail?: string }
  | { type: 'InvoiceIssued'; tenantId: string; invoiceId: string; studentId: string; invoiceNumber: string; totalCents: number; dueDate: Date }
  | { type: 'InvoiceOverdue'; tenantId: string; invoiceId: string; studentId: string; invoiceNumber: string; balanceCents: number }
  | { type: 'PaymentReceived'; tenantId: string; invoiceId: string; studentId: string; paymentNumber: string; amountCents: number; fullyPaid: boolean }
  | { type: 'FollowUpCreated'; tenantId: string; followUpId: string; domain: string; severity: string; title: string; studentId?: string | null }
  | { type: 'AcademicYearClosed'; tenantId: string; sessionId: string; name: string }
  | { type: 'StudentPromoted'; tenantId: string; studentId: string; fromSessionId: string; toSessionId: string; toClassroomId: string }
  | { type: 'MaterialRequestCreated'; tenantId: string; requestId: string; requestNumber: string; branchId: string; classroomId?: string | null }
  | { type: 'MaterialRequestApproved'; tenantId: string; requestId: string; requestNumber: string }
  | { type: 'PurchaseRequestSubmitted'; tenantId: string; requestId: string; requestNumber: string; branchId: string }
  | { type: 'PurchaseRequestApproved'; tenantId: string; requestId: string; requestNumber: string }
  | { type: 'PurchaseOrderApproved'; tenantId: string; orderId: string; poNumber: string; vendorId: string }
  | { type: 'GoodsReceived'; tenantId: string; grnId: string; grnNumber: string; poId: string }
  | { type: 'StockIssued'; tenantId: string; issueId: string; issueNumber: string; destinationType: string; destinationId?: string | null }
  | { type: 'StockReturned'; tenantId: string; returnId: string; returnNumber: string }
  | { type: 'StockAdjusted'; tenantId: string; adjustmentId: string; adjustmentNumber: string }
  | { type: 'StockBelowReorderLevel'; tenantId: string; itemId: string; itemName: string; availableQuantity: number; reorderLevel: number }
  | { type: 'StockExpiringSoon'; tenantId: string; itemId: string; itemName: string; batchNumber?: string | null; expiryDate: Date }
  | { type: 'StaffOnboarded'; tenantId: string; staffProfileId: string; employeeCode: string; name: string }
  | { type: 'LeaveSubmitted'; tenantId: string; requestId: string; staffProfileId: string; totalDays: number }
  | { type: 'LeaveApproved'; tenantId: string; requestId: string; staffProfileId: string; totalDays: number }
  | { type: 'TeacherCoverageRequired'; tenantId: string; requestId: string; classroomId: string; date: string }
  | { type: 'ParentDelayAlert'; tenantId: string; classroomId: string; date: string; delayMinutes: number }
  | { type: 'PayrollProcessed'; tenantId: string; cycleId: string; month: number; year: number }
  | { type: 'ResignationSubmitted'; tenantId: string; staffProfileId: string; lwd: string }
  | { type: 'ExitCompleted'; tenantId: string; staffProfileId: string }

type Handler = (e: DomainEvent) => Promise<void>

const handlers: Handler[] = []

export function onDomainEvent(h: Handler) {
  handlers.push(h)
}

/**
 * Fire-and-forget dispatch — a failing handler must never break the primary
 * transaction; errors are logged (observability Spec §56).
 */
export async function emit(e: DomainEvent): Promise<void> {
  for (const h of handlers) {
    try {
      await h(e)
    } catch (err) {
      console.error(`[events] handler failed for ${e.type}:`, err)
    }
  }
}
