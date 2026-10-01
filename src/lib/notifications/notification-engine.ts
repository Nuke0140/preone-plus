/**
 * PreOne — Central Notification & Communication Engine
 *
 * MISSION:
 * - Central communication pipeline for ALL modules (Attendance, Operations, Fees, Transport, HR, Academics, Inventory).
 * - Reads authoritative configuration from SchoolConfig ('COMMUNICATION' domain).
 * - Enforces event gating (`notificationEventEnabled`).
 * - Resolves recipients canonically (never client-trusting).
 * - Evaluates template variables / placeholders.
 * - Dispatches across enabled channels with truthful gateway logging.
 * - Automatically records child events on `TimelineEntry` where appropriate.
 * - Audits sensitive dispatches via `AuditLog`.
 */

import { db } from '@/lib/db'
import { getDomainConfig, getCommunication, notificationEventEnabled } from '@/lib/config'
import { RecipientResolver, ResolvedRecipient } from './recipient-resolver'
import { ChannelAdapters, ChannelDeliveryResult } from './channel-adapters'
import { recordChildEvent } from '@/lib/notify'
import { recordAudit } from '@/lib/audit'

export interface DispatchNotificationInput {
  tenantId: string
  eventType: string // e.g. 'ATTENDANCE_UPDATE', 'HEALTH_ALERT', 'FEE_DUE', 'FEE_RECEIVED', 'TRANSPORT_DELAY', 'LEAVE_STATUS', 'INVENTORY_ALERT', 'ANNOUNCEMENT'
  category?: 'ATTENDANCE' | 'HEALTH' | 'SAFETY' | 'FEES' | 'TRANSPORT' | 'HR' | 'ACADEMICS' | 'INVENTORY' | 'SYSTEM'
  severity?: 'INFO' | 'WARNING' | 'URGENT' | 'EMERGENCY'
  title: string
  body: string
  linkUrl?: string
  studentId?: string
  classroomId?: string
  tripId?: string
  staffFilter?: { role?: string; branchId?: string | null; department?: string; userId?: string }
  specificRecipients?: ResolvedRecipient[]
  placeholders?: Record<string, string | number>
  actor?: { id?: string | null; name?: string | null; role?: string | null }
  skipTimelineEntry?: boolean
  metadata?: any
}

export interface DispatchNotificationResult {
  eventId: string
  eventType: string
  gated: boolean
  recipientsCount: number
  deliveries: ChannelDeliveryResult[]
  timelineEntryId?: string
}

export class NotificationEngine {
  /**
   * Replace template variables: {{studentName}}, {{amount}}, etc.
   */
  static formatTemplate(text: string, placeholders: Record<string, string | number>): string {
    let formatted = text
    for (const [key, value] of Object.entries(placeholders)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      formatted = formatted.replace(regex, String(value))
    }
    return formatted
  }

  /**
   * Core dispatch method.
   */
  static async dispatch(input: DispatchNotificationInput): Promise<DispatchNotificationResult> {
    const eventId = crypto.randomUUID()

    // 1. Check if event is enabled in tenant's COMMUNICATION config
    const isEnabled = await notificationEventEnabled(input.tenantId, input.eventType)
    if (!isEnabled) {
      return {
        eventId,
        eventType: input.eventType,
        gated: true,
        recipientsCount: 0,
        deliveries: [],
      }
    }

    // 2. Fetch tenant communication config for active channels
    const commConfigRaw = await getDomainConfig(input.tenantId, 'COMMUNICATION')
    const commConfig = getCommunication(commConfigRaw)
    const activeChannels = (commConfig.channels || ['IN_APP']) as ('IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP')[]

    // 3. Resolve canonical recipients
    let recipients: ResolvedRecipient[] = []

    if (input.specificRecipients && input.specificRecipients.length > 0) {
      recipients = input.specificRecipients
    } else if (input.studentId) {
      recipients = await RecipientResolver.resolveChildGuardians(input.tenantId, input.studentId)
    } else if (input.classroomId) {
      recipients = await RecipientResolver.resolveClassroomGuardians(input.tenantId, input.classroomId)
    } else if (input.tripId) {
      const riders = await RecipientResolver.resolveTransportRiders(input.tenantId, input.tripId)
      const allGuardians = riders.flatMap((r) => r.guardians)
      // deduplicate
      const seen = new Set<string>()
      for (const g of allGuardians) {
        if (!seen.has(g.guardianId || g.fullName)) {
          seen.add(g.guardianId || g.fullName)
          recipients.push(g)
        }
      }
    } else if (input.staffFilter) {
      recipients = await RecipientResolver.resolveStaffRecipients(input.tenantId, input.staffFilter)
    }

    // 4. Format Title & Body with placeholders
    const placeholders = input.placeholders || {}
    const finalTitle = this.formatTemplate(input.title, placeholders)
    const finalBody = this.formatTemplate(input.body, placeholders)

    const deliveries: ChannelDeliveryResult[] = []

    // 5. Deliver across each enabled channel for each recipient
    for (const r of recipients) {
      for (const channel of activeChannels) {
        let recipientAddress: string | null = null
        if (channel === 'EMAIL') recipientAddress = r.email || null
        if (channel === 'SMS' || channel === 'WHATSAPP') recipientAddress = r.phone || null
        if (channel === 'IN_APP') recipientAddress = r.userId || null

        const res = await ChannelAdapters.deliver({
          tenantId: input.tenantId,
          eventId,
          eventType: input.eventType,
          channel,
          recipientType: r.role === 'PARENT' ? 'PARENT' : 'STAFF',
          recipientId: r.guardianId || r.staffProfileId || r.userId || 'UNKNOWN',
          recipientUserId: r.userId,
          recipientAddress,
          title: finalTitle,
          body: finalBody,
          category: input.category || 'SYSTEM',
          severity: input.severity || 'INFO',
          linkUrl: input.linkUrl,
          metadata: { studentId: input.studentId, ...input.metadata },
        })

        deliveries.push(res)
      }
    }

    // 6. Child Timeline Record integration (if student-scoped and not skipped)
    let timelineEntryId: string | undefined
    if (input.studentId && !input.skipTimelineEntry) {
      try {
        const typeMap: Record<string, any> = {
          ATTENDANCE_UPDATE: 'NOTE',
          HEALTH_ALERT: 'INCIDENT',
          FEE_DUE: 'NOTE',
          FEE_RECEIVED: 'NOTE',
          TRANSPORT_DELAY: 'NOTE',
        }
        const timelineType = typeMap[input.eventType] || 'NOTE'
        const entry = await recordChildEvent({
          tenantId: input.tenantId,
          studentId: input.studentId,
          type: timelineType,
          title: finalTitle,
          body: finalBody,
          actorId: input.actor?.id,
          classroomId: input.classroomId,
          notifyEvent: input.eventType as any,
        })
        if (entry) timelineEntryId = entry.id
      } catch (e) {
        console.error('[NotificationEngine] Failed to write timeline entry:', e)
      }
    }

    // 7. Audit log if EMERGENCY or sensitive
    if (input.severity === 'EMERGENCY' || input.eventType === 'HEALTH_ALERT' || input.eventType === 'PICKUP_BLOCKED') {
      await recordAudit({
        tenantId: input.tenantId,
        actorId: input.actor?.id,
        actorName: input.actor?.name || 'Notification Engine',
        actorRole: input.actor?.role || 'SYSTEM',
        action: 'NOTIFICATION_DISPATCHED',
        entity: 'Notification',
        entityId: eventId,
        module: 'Settings',
        severity: 'CRITICAL',
        summary: `[${input.severity}] Dispatched ${input.eventType} to ${recipients.length} recipients: ${finalTitle}`,
        newValues: { eventType: input.eventType, recipientsCount: recipients.length, channels: activeChannels },
      })
    }

    return {
      eventId,
      eventType: input.eventType,
      gated: false,
      recipientsCount: recipients.length,
      deliveries,
      timelineEntryId,
    }
  }

  /**
   * Fetch in-app notifications for a user
   */
  static async getUserNotifications(
    tenantId: string,
    userId: string,
    options?: { unreadOnly?: boolean; limit?: number; offset?: number }
  ) {
    const where = {
      tenantId,
      userId,
      ...(options?.unreadOnly ? { isRead: false } : {}),
    }

    const [items, total, unreadCount] = await Promise.all([
      db.inAppNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 20,
        skip: options?.offset || 0,
      }),
      db.inAppNotification.count({ where }),
      db.inAppNotification.count({ where: { tenantId, userId, isRead: false } }),
    ])

    return { items, total, unreadCount }
  }

  /**
   * Mark a single in-app notification as read
   */
  static async markAsRead(tenantId: string, userId: string, notificationId: string) {
    const n = await db.inAppNotification.findFirst({
      where: { id: notificationId, tenantId, userId },
    })
    if (!n) throw new Error('Notification not found')

    return db.inAppNotification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    })
  }

  /**
   * Mark all in-app notifications as read for a user
   */
  static async markAllAsRead(tenantId: string, userId: string) {
    return db.inAppNotification.updateMany({
      where: { tenantId, userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })
  }

  /**
   * Query delivery logs (audit & debug history for administrators in Settings)
   */
  static async getDeliveryLogs(
    tenantId: string,
    filters?: {
      eventType?: string
      channel?: string
      status?: string
      limit?: number
      offset?: number
    }
  ) {
    const where = {
      tenantId,
      ...(filters?.eventType ? { eventType: filters.eventType } : {}),
      ...(filters?.channel ? { channel: filters.channel } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
    }

    const [logs, total] = await Promise.all([
      db.notificationDeliveryLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      db.notificationDeliveryLog.count({ where }),
    ])

    return { logs, total }
  }
}
