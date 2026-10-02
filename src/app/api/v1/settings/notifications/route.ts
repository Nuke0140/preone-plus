import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { NotificationEngine } from '@/lib/notifications/notification-engine'
import { getDomainConfig, getCommunication } from '@/lib/config'
import { SettingsService } from '@/lib/settings/settings-service'

/**
 * GET /api/v1/settings/notifications
 * Returns notification config (channels, rules, templates) + recent delivery logs for administrators.
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'settings:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const rawConfig = await getDomainConfig(session.tenantId, 'COMMUNICATION')
    const config = getCommunication(rawConfig)

    const { logs, total } = await NotificationEngine.getDeliveryLogs(session.tenantId, { limit: 25 })

    return ok({
      config,
      recentLogs: logs,
      totalLogs: total,
    })
  } catch (e) {
    return Errors.system(e)
  }
}

/**
 * PUT /api/v1/settings/notifications
 * Updates notification configuration (channels, rules, templates) in SchoolConfig.
 */
async function _PUT(req: NextRequest) {
  const session = await requireApi(req, 'settings:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const { channels, notificationEvents, templates, rules, language } = body

    const existingRaw = await getDomainConfig(session.tenantId, 'COMMUNICATION')
    const existing = getCommunication(existingRaw)

    const updatedData = {
      ...existing,
      ...(channels ? { channels } : {}),
      ...(notificationEvents ? { notificationEvents } : {}),
      ...(templates ? { templates } : {}),
      ...(rules ? { rules } : {}),
      ...(language ? { language } : {}),
    }

    const updated = await SettingsService.updateDomainConfig(
      session.tenantId,
      'COMMUNICATION' as any,
      updatedData,
      {
        id: session.uid,
        name: session.name,
        role: session.role,
      }
    )

    return ok({ config: updated.data })
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const PUT = withApi(_PUT)
