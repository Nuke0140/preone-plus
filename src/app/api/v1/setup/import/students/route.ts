import { withApi } from '@/lib/with-api'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, Errors } from '@/lib/api'
import { requireApi, isResponse } from '@/lib/auth-api'
import { audit } from '@/lib/sequence'

/**
 * POST /api/v1/setup/import/students — M00 Step: Data Import (optional)
 * body: { mode: 'preview' | 'commit', csv: string, programId?: string }
 * csv header: firstName,lastName,dob(YYYY-MM-DD),gender(MALE/FEMALE/OTHER/UNSPECIFIED),admissionNo,guardianName,guardianPhone,relationship
 * Duplicates (existing admissionNo in tenant OR repeated rows) are flagged and never silently created.
 */

interface Row {
  firstName: string; lastName: string; dob: string; gender: string; admissionNo: string
  guardianName: string; guardianPhone: string; relationship: string
}
interface Checked {
  row: number; data: Row; errors: string[]; duplicate: boolean
}

function parseCsv(csv: string): Row[] {
  const lines = csv.trim().split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const idx = (k: string) => header.indexOf(k)
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim())
    const get = (k: string) => idx(k) >= 0 ? cells[idx(k)] ?? '' : ''
    return {
      firstName: get('firstname'), lastName: get('lastname'), dob: get('dob'),
      gender: (get('gender') || 'UNSPECIFIED').toUpperCase(),
      admissionNo: get('admissionno'), guardianName: get('guardianname'),
      guardianPhone: get('guardianphone'), relationship: (get('relationship') || 'PARENT').toUpperCase(),
    }
  })
}

async function _POST(req: NextRequest) {
  const session = await requireApi(req, 'settings:write')
  if (isResponse(session)) return session
  if (!session.tenantId) return Errors.forbidden('No tenant context')

  try {
    const body = await req.json()
    const mode = body.mode ?? 'preview'
    const csv = String(body.csv ?? '')
    const programId = body.programId ? String(body.programId) : null
    if (!csv.trim()) return Errors.validation('csv content is required')

    const rows = parseCsv(csv)
    if (rows.length === 0) return Errors.validation('CSV has no data rows (header + at least 1 row)')

    // existing admission numbers in tenant
    const existing = await db.student.findMany({
      where: { tenantId: session.tenantId },
      select: { admissionNo: true },
    })
    const existingSet = new Set(existing.map((e) => e.admissionNo))

    let classroom = null as { id: string; name: string } | null
    if (programId) {
      const c = await db.classroom.findFirst({
        where: { tenantId: session.tenantId, programId, isActive: true },
        select: { id: true, name: true },
      })
      classroom = c
    }

    const seen = new Map<string, number>()
    const checked: Checked[] = rows.map((r, i) => {
      const errors: string[] = []
      if (!r.firstName) errors.push('firstName required')
      if (!r.admissionNo) errors.push('admissionNo required')
      if (!r.dob || isNaN(Date.parse(r.dob))) errors.push('dob must be YYYY-MM-DD')
      if (!['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED'].includes(r.gender)) errors.push('gender invalid')
      if (!r.guardianName) errors.push('guardianName required')
      if (!r.guardianPhone) errors.push('guardianPhone required')
      let duplicate = false
      if (r.admissionNo && existingSet.has(r.admissionNo)) { duplicate = true; errors.push(`admissionNo already exists in school`) }
      if (r.admissionNo && seen.has(r.admissionNo)) { duplicate = true; errors.push(`duplicate row with row ${seen.get(r.admissionNo)}`) }
      if (r.admissionNo && !seen.has(r.admissionNo)) seen.set(r.admissionNo, i + 2)
      return { row: i + 2, data: r, errors, duplicate }
    })

    const valid = checked.filter((c) => c.errors.length === 0)
    const invalid = checked.filter((c) => c.errors.length > 0)

    if (mode === 'preview') {
      return ok({
        mode, total: rows.length, valid: valid.length, invalid: invalid.length,
        targetClassroom: classroom,
        rows: checked.map((c) => ({
          row: c.row, firstName: c.data.firstName, lastName: c.data.lastName,
          admissionNo: c.data.admissionNo, dob: c.data.dob, gender: c.data.gender,
          guardian: `${c.data.guardianName} (${c.data.guardianPhone})`,
          status: c.errors.length === 0 ? 'READY' : 'ERROR',
          errors: c.errors,
        })),
        message: `${valid.length} of ${rows.length} rows ready to import${invalid.length ? ` — ${invalid.length} will be skipped` : ''}`,
      })
    }

    // commit — only error-free rows; each in a transaction creating Student + Guardian + link
    if (valid.length === 0) return Errors.business('IMPORT_001', 'No valid rows to import', 422)

    const branchRow = classroom
      ? await db.classroom.findUnique({ where: { id: classroom.id }, select: { branchId: true } })
      : await db.branch.findFirst({ where: { tenantId: session.tenantId, isMain: true } })
    if (!branchRow) return Errors.notFound('Branch')

    const result = await db.$transaction(async (tx) => {
      let imported = 0
      for (const c of valid) {
        const student = await tx.student.create({
          data: {
            tenantId: session.tenantId,
            branchId: branchRow.branchId,
            admissionNo: c.data.admissionNo,
            firstName: c.data.firstName,
            lastName: c.data.lastName || null,
            dob: new Date(c.data.dob),
            gender: c.data.gender as 'MALE' | 'FEMALE' | 'OTHER' | 'UNSPECIFIED',
            currentClassroomId: classroom?.id ?? null,
          },
        })
        let guardian = await tx.guardian.findFirst({
          where: {
            tenantId: session.tenantId,
            phone: c.data.guardianPhone.trim(),
            fullName: c.data.guardianName.trim(),
            deletedAt: null,
          },
        })
        if (!guardian) {
          guardian = await tx.guardian.create({
            data: {
              tenantId: session.tenantId,
              fullName: c.data.guardianName.trim(),
              phone: c.data.guardianPhone.trim(),
              relationship: c.data.relationship as 'FATHER' | 'MOTHER' | 'GRANDPARENT' | 'LEGAL_GUARDIAN' | 'OTHER',
              isPrimaryContact: true,
            },
          })
        }
        await tx.studentGuardian.create({
          data: {
            studentId: student.id,
            guardianId: guardian.id,
            relationship: c.data.relationship as 'FATHER' | 'MOTHER' | 'GRANDPARENT' | 'LEGAL_GUARDIAN' | 'OTHER',
            isPrimary: true,
            canPickup: true,
          },
        })
        imported++
      }
      return imported
    })

    await audit({
      tenantId: session.tenantId, actorId: session.uid, actorName: session.name,
      action: 'SETUP_IMPORT', entity: 'Student', entityId: session.tenantId,
      summary: `Imported ${result} students (+ guardians) from CSV — ${invalid.length} rows skipped`,
    })
    return ok({ mode, imported: result, skipped: invalid.length, message: `Imported ${result} students` }, undefined, 201)
  } catch (e) {
    return Errors.system(e)
  }
}

export const POST = withApi(_POST)
