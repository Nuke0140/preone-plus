import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { audit, nextNumber } from '@/lib/sequence'
import { SETUP_STEPS } from '@/lib/setup/steps'
import bcrypt from 'bcryptjs'

/** GET /api/v1/tenants — platform admin: all clients (tenants) */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'platform:manage')
  if (isResponse(session)) return session

  try {
    const tenants = await db.tenant.findMany({
      include: {
        _count: { select: { students: true, branches: true, members: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return ok(
      tenants.map((t) => ({
        id: t.id,
        name: t.name,
        code: t.code,
        city: t.city,
        status: t.status,
        plan: t.subscriptionPlan,
        onboardingStep: t.onboardingStep,
        onboardedAt: t.onboardedAt,
        createdAt: t.createdAt,
        students: t._count.students,
        branches: t._count.branches,
        users: t._count.members,
      }))
    )
  } catch (e) {
    return Errors.system(e)
  }
}

/**
 * POST /api/v1/tenants — CLIENT ONBOARDING WIZARD (Platform Management domain, PRD 8.13)
 * Creates tenant + main branch + academic session + classrooms + owner account in one transaction.
 */
async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'platform:manage')
  if (isResponse(session)) return session

  try {
    const body = await req.json()
    const {
      // step 1 — school
      name, code, city, state, pincode, phone, email, address,
      // step 2 — branch
      branchName,
      // step 3 — programs
      programs,          // e.g. ["PLAYGROUP","NURSERY"]
      sessionName,       // "2026-27"
      // step 4 — owner
      ownerName, ownerEmail, ownerPassword,
      plan,
    } = body

    if (!name || !code || !branchName || !ownerName || !ownerEmail || !ownerPassword) {
      return Errors.validation('Missing required onboarding fields')
    }
    if (ownerPassword.length < 6) {
      return Errors.validation('Owner password must be at least 6 characters', 'ownerPassword')
    }

    const existing = await db.tenant.findUnique({ where: { code: code.toUpperCase() } })
    if (existing) return Errors.conflict(`Tenant code "${code}" is already taken`)
    const existingUser = await db.user.findUnique({ where: { email: ownerEmail.toLowerCase() } })
    if (existingUser) return Errors.conflict('A user with this email already exists')

    const tenant = await db.$transaction(async (tx) => {
      const t = await tx.tenant.create({
        data: {
          name,
          code: code.toUpperCase(),
          type: 'SCHOOL',
          status: 'ACTIVE',
          subscriptionPlan: plan || 'STARTER',
          city, state, pincode, phone, email, address,
          onboardingStep: 5,
          onboardedAt: new Date(),
        },
      })

      const branch = await tx.branch.create({
        data: {
          tenantId: t.id,
          name: branchName,
          code: 'MAIN',
          address, city, state, pincode, phone,
          isMain: true,
        },
      })

      const acadStart = new Date(new Date().getFullYear(), 3, 1)
      const acadEnd = new Date(new Date().getFullYear() + 1, 2, 31)
      const acad = await tx.academicSession.create({
        data: {
          tenantId: t.id,
          name: sessionName || `${acadStart.getFullYear()}-${String(acadEnd.getFullYear()).slice(2)}`,
          startDate: acadStart,
          endDate: acadEnd,
          status: 'ACTIVE',
          isCurrent: true,
        },
      })

      const programDefaults: Record<string, { capacity: number; min: number; max: number }> = {
        PLAYGROUP: { capacity: 16, min: 18, max: 30 },
        NURSERY: { capacity: 20, min: 30, max: 42 },
        LKG: { capacity: 22, min: 42, max: 54 },
        UKG: { capacity: 24, min: 54, max: 66 },
        DAYCARE: { capacity: 20, min: 18, max: 72 },
      }
      const progs: string[] = Array.isArray(programs) && programs.length ? programs : ['PLAYGROUP', 'NURSERY']
      // M00: Program master rows (configurable) linked to legacy ProgramType for existing contracts
      const programRows = await Promise.all(
        progs.map((p) =>
          tx.program.create({
            data: {
              tenantId: t.id,
              code: p,
              name: `${p.charAt(0)}${p.slice(1).toLowerCase()}`,
              programType: p as never,
              ageMinMonths: programDefaults[p]?.min ?? null,
              ageMaxMonths: programDefaults[p]?.max ?? null,
              capacity: programDefaults[p]?.capacity ?? 20,
            },
          })
        )
      )
      const programIdByType = Object.fromEntries(programRows.map((p) => [p.programType, p.id]))
      await tx.classroom.createMany({
        data: progs.map((p, i) => ({
          tenantId: t.id,
          branchId: branch.id,
          academicSessionId: acad.id,
          name: `${p.charAt(0)}${p.slice(1).toLowerCase()} A`,
          code: `${p.slice(0, 3)}-A`,
          programType: p,
          capacity: programDefaults[p]?.capacity ?? 20,
          ageBandMinMonths: programDefaults[p]?.min,
          ageBandMaxMonths: programDefaults[p]?.max,
          programId: programIdByType[p] ?? null,
        })),
      })

      const owner = await tx.user.create({
        data: {
          email: ownerEmail.toLowerCase(),
          fullName: ownerName,
          passwordHash: await bcrypt.hash(ownerPassword, 10),
          status: 'ACTIVE',
        },
      })
      await tx.tenantUser.create({
        data: { tenantId: t.id, userId: owner.id, role: 'OWNER', branchId: branch.id },
      })

      // starter fee plan per program
      for (const p of progs) {
        const tuition = { PLAYGROUP: 120000, NURSERY: 140000, LKG: 160000, UKG: 180000, DAYCARE: 200000 }[p] ?? 120000
        const fp = await tx.feePlan.create({
          data: {
            tenantId: t.id,
            name: `${p.charAt(0)}${p.slice(1).toLowerCase()} Annual Plan`,
            programType: p,
            totalAnnualCents: tuition * 4,
            installmentCount: 4,
          },
        })
        await tx.feePlanItem.createMany({
          data: [
            { feePlanId: fp.id, feeHead: 'TUITION', label: 'Tuition Fee (Quarterly)', amountCents: tuition, frequency: 'QUARTERLY' },
            { feePlanId: fp.id, feeHead: 'ADMISSION', label: 'Admission Fee (One Time)', amountCents: 500000, frequency: 'ONE_TIME' },
            { feePlanId: fp.id, feeHead: 'ACTIVITY', label: 'Activity & Materials', amountCents: 250000, frequency: 'ANNUALLY' },
          ],
        })
      }

      return t
    })

    // M00: initialize the setup state machine — wizard pre-configured the foundation,
    // remaining steps evaluate against real data on first status read
    await db.schoolSetup.create({
      data: { tenantId: tenant.id, status: 'IN_PROGRESS', startedAt: new Date() },
    })
    await db.schoolSetupStep.createMany({
      data: SETUP_STEPS.map((s) => ({ tenantId: tenant.id, stepKey: s.key, applicability: s.applicability })),
    })

    await audit({
      actorId: session.uid,
      actorName: session.name,
      action: 'CREATE',
      entity: 'Tenant',
      entityId: tenant.id,
      summary: `Onboarded client school: ${tenant.name}`,
    })

    return ok({ id: tenant.id, name: tenant.name, code: tenant.code }, undefined, 201)
  } catch (e) {
    return Errors.system(e)
  }
}

export const GET = withApi(_GET)
export const POST = withApi(_POST)
