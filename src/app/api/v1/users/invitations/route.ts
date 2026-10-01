import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, bad, notFound, forbidden, serverError } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { recordAudit, getRequestMeta } from '@/lib/audit'

/**
 * GET /api/v1/users/invitations — list pending invitations
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'users:read')
  if (isResponse(session)) return session
  if (!session.tenantId) return bad('Tenant required', 'TENANT_REQUIRED')

  try {
    const pendingMembers = await db.tenantUser.findMany({
      where: {
        tenantId: session.tenantId,
        status: 'PENDING',
        deletedAt: null,
      },
      include: {
        user: {
          include: { staffProfile: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const invitations = pendingMembers.map((m) => ({
      id: m.id,
      userId: m.user.id,
      fullName: m.user.fullName,
      email: m.user.email,
      phone: m.user.phone,
      role: m.role,
      roles: m.roles && m.roles.length > 0 ? m.roles : [m.role],
      branchId: m.branchId,
      designation: m.user.staffProfile?.designation || null,
      invitedAt: m.createdAt,
      status: m.status,
    }))

    return ok({
      invitations,
      total: invitations.length,
    })
  } catch (err: any) {
    return serverError(err.message)
  }
}

/**
 * POST /api/v1/users/invitations — resend or cancel pending invitation
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'users:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return bad('Tenant required', 'TENANT_REQUIRED')

  try {
    const body = await req.json()
    const { action, userId } = body as { action: 'resend' | 'cancel' | 'activate'; userId: string }

    if (!action || !userId || !['resend', 'cancel', 'activate'].includes(action)) {
      return bad('Action ("resend", "cancel", or "activate") and userId are required', 'INVALID_INVITATION_ACTION')
    }

    const member = await db.tenantUser.findFirst({
      where: {
        userId,
        tenantId: session.tenantId,
        deletedAt: null,
      },
      include: { user: true },
    })

    if (!member) return notFound('Pending user invitation not found')

    if (member.status !== 'PENDING') {
      return bad(`User is not in PENDING state (current: ${member.status})`, 'USER_NOT_PENDING')
    }

    const meta = getRequestMeta(req)

    if (action === 'activate') {
      await db.$transaction(async (tx) => {
        await tx.tenantUser.update({
          where: { id: member.id },
          data: { status: 'ACTIVE' },
        })
        await tx.user.update({
          where: { id: member.userId },
          data: { status: 'ACTIVE' },
        })
      })

      await recordAudit({
        tenantId: session.tenantId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
        action: 'ACTIVATE_INVITATION',
        entity: 'User',
        entityId: member.userId,
        module: 'Users',
        severity: 'INFO',
        summary: `Activated invited user ${member.user.fullName} (${member.user.email})`,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      })

      return ok({ success: true, message: `User ${member.user.email} successfully activated` })
    } else if (action === 'resend') {
      // Touch user and membership
      await db.$transaction(async (tx) => {
        await tx.tenantUser.update({
          where: { id: member.id },
          data: { updatedAt: new Date() },
        })
        await tx.user.update({
          where: { id: member.userId },
          data: { updatedAt: new Date() },
        })
      })

      await recordAudit({
        tenantId: session.tenantId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
        action: 'RESEND_INVITATION',
        entity: 'User',
        entityId: member.userId,
        module: 'Users',
        severity: 'INFO',
        summary: `Resent invitation to ${member.user.fullName} (${member.user.email})`,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      })

      return ok({ success: true, message: `Invitation resent to ${member.user.email}` })
    } else {
      // cancel -> mark INACTIVE or soft delete
      await db.$transaction(async (tx) => {
        await tx.tenantUser.update({
          where: { id: member.id },
          data: { status: 'INACTIVE', deletedAt: new Date() },
        })
      })

      await recordAudit({
        tenantId: session.tenantId,
        actorId: session.uid,
        actorName: session.name,
        actorRole: session.role,
        action: 'CANCEL_INVITATION',
        entity: 'User',
        entityId: member.userId,
        module: 'Users',
        severity: 'INFO',
        summary: `Cancelled invitation for ${member.user.fullName} (${member.user.email})`,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      })

      return ok({ success: true, message: `Invitation cancelled for ${member.user.email}` })
    }
  } catch (err: any) {
    return serverError(err.message)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
