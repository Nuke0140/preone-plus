import crypto from 'crypto'
import { db } from '../db'
import { getRequestMeta } from '../audit'
import { NextRequest } from 'next/server'
import { logger } from '../logger'

export interface DeviceMetadata {
  device: string
  platform: string
  browser: string
}

export function parseDeviceFromUserAgent(ua?: string | null): DeviceMetadata {
  if (!ua) {
    return { device: 'Unknown Device', platform: 'Unknown OS', browser: 'Unknown Browser' }
  }

  // Detect Platform / OS
  let platform = 'Unknown OS'
  if (/windows nt 10/i.test(ua)) platform = 'Windows 10/11'
  else if (/windows nt/i.test(ua)) platform = 'Windows'
  else if (/macintosh|mac os x/i.test(ua)) platform = 'macOS'
  else if (/android/i.test(ua)) platform = 'Android'
  else if (/iphone|ipad|ipod/i.test(ua)) platform = 'iOS'
  else if (/linux/i.test(ua)) platform = 'Linux'

  // Detect Browser / App
  let browser = 'Unknown Browser'
  if (/edg\//i.test(ua)) browser = 'Edge'
  else if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) browser = 'Chrome'
  else if (/safari\//i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari'
  else if (/firefox\//i.test(ua)) browser = 'Firefox'
  else if (/postman/i.test(ua)) browser = 'Postman'
  else if (/curl/i.test(ua)) browser = 'cURL'

  // Detect Form factor
  let device = 'Desktop'
  if (/ipad|tablet/i.test(ua)) device = 'Tablet'
  else if (/mobile|iphone|android/i.test(ua)) device = 'Mobile'

  return {
    device: `${device} (${browser})`,
    platform,
    browser,
  }
}

export class SessionService {
  /**
   * Hashes a raw JWT token using SHA-256 for secure lookup without storing raw tokens.
   */
  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex')
  }

  /**
   * Records an active session upon successful login.
   */
  static async createSession(params: {
    userId: string
    tenantId?: string | null
    token: string
    req?: Request | NextRequest | null
  }) {
    const tokenHash = this.hashToken(params.token)
    const meta = getRequestMeta(params.req)
    const deviceInfo = parseDeviceFromUserAgent(meta.userAgent)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    try {
      return await db.userSession.create({
        data: {
          userId: params.userId,
          tenantId: params.tenantId ?? undefined,
          tokenHash,
          device: deviceInfo.device,
          platform: deviceInfo.platform,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          expiresAt,
          status: 'ACTIVE',
        },
      })
    } catch (err: any) {
      logger.warn('Failed to record user session in database', {
        userId: params.userId,
        error: err.message,
      })
      return null
    }
  }

  /**
   * Validates if a session token is currently ACTIVE in the database.
   */
  static async validateSession(token: string): Promise<{ valid: boolean; session?: any }> {
    const tokenHash = this.hashToken(token)
    try {
      const session = await db.userSession.findUnique({
        where: { tokenHash },
      })

      if (!session) {
        // If not found in DB (e.g. legacy token created before user_sessions), allow verifySession to succeed
        return { valid: true }
      }

      if (session.status !== 'ACTIVE') {
        return { valid: false }
      }

      if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
        return { valid: false }
      }

      // Throttled update of lastActiveAt if older than 5 minutes
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
      if (session.lastActiveAt.getTime() < fiveMinutesAgo) {
        db.userSession
          .update({
            where: { id: session.id },
            data: { lastActiveAt: new Date() },
          })
          .catch(() => {})
      }

      return { valid: true, session }
    } catch (err: any) {
      logger.warn('Error verifying session in database', { error: err.message })
      return { valid: true } // Graceful degradation if DB is temporarily unreachable
    }
  }

  /**
   * Retrieves all active sessions for a user.
   */
  static async getUserSessions(userId: string) {
    return db.userSession.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActiveAt: 'desc' },
      select: {
        id: true,
        device: true,
        platform: true,
        ipAddress: true,
        userAgent: true,
        lastActiveAt: true,
        createdAt: true,
        status: true,
      },
    })
  }

  /**
   * Revokes a specific session.
   */
  static async revokeSession(sessionId: string, userId?: string): Promise<boolean> {
    const where: any = { id: sessionId }
    if (userId) where.userId = userId

    const res = await db.userSession.updateMany({
      where,
      data: {
        status: 'REVOKED',
        updatedAt: new Date(),
      },
    })
    return res.count > 0
  }

  /**
   * Revokes all active sessions for a user (e.g., password change, suspension, logout-all).
   */
  static async revokeAllUserSessions(userId: string, exceptTokenHash?: string): Promise<number> {
    const where: any = {
      userId,
      status: 'ACTIVE',
    }
    if (exceptTokenHash) {
      where.tokenHash = { not: exceptTokenHash }
    }

    const res = await db.userSession.updateMany({
      where,
      data: {
        status: 'REVOKED',
        updatedAt: new Date(),
      },
    })
    return res.count
  }
}
