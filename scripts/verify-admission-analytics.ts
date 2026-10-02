/**
 * PreOne — Admission Analytics 2.0 End-to-End Verification
 *
 * Verifies the server-side analytics pipeline against a real PostgreSQL database:
 * 1. Tenant-scoped isolation: another tenant's data never leaks into analytics
 * 2. 12-stage funnel: counts match the seeded lead/application reality
 * 3. Monthly trends: enquiries (Leads) & enrollments (Students.admissionDate)
 * 4. Source ROI: per-source leads/applications/enrolled/conversion + avg days
 * 5. Counsellor leaderboard: assignment → conversion accounting
 * 6. Aging buckets & stuck applications ordering
 * 7. Offer insights: accept/decline counts, acceptance rate, decline reasons
 * 8. Capacity forecast: classrooms × students × pipeline × waitlist per program
 * 9. Speed metrics: first-response + visit no-show accounting
 * 10. Lost reasons from the immutable audit trail
 *
 * Run: bun scripts/verify-admission-analytics.ts
 */

import { db } from '../src/lib/db'
import { AdmissionsAnalyticsService } from '../src/lib/admissions/analytics-service'
import { LeadService } from '../src/lib/admissions/lead-service'
import { randomUUID } from 'crypto'

let passed = 0
let failed = 0

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ✓ ${desc}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${desc}`)
    failed++
  }
}

async function main() {
  console.log('====================================================================')
  console.log('PREONE ADMISSION ANALYTICS 2.0 — E2E VERIFICATION')
  console.log('====================================================================\n')

  const suffix = randomUUID().slice(0, 8)
  const tenantA = `ANALYTICS-A-${suffix}`
  const tenantB = `ANALYTICS-B-${suffix}`
  let branchA: any, sessionA: any, branchB: any, sessionB: any
  const cleanupIds: string[] = []

  try {
    // ── Setup: two tenants (isolation check) ────────────────────────────────
    console.log('[1] Setup: tenants, branches, sessions, programs, classrooms')
    const tA = await db.tenant.create({ data: { name: `Analytics School A ${suffix}`, code: tenantA, status: 'ACTIVE' } })
    const tB = await db.tenant.create({ data: { name: `Analytics School B ${suffix}`, code: tenantB, status: 'ACTIVE' } })
    branchA = await db.branch.create({ data: { tenantId: tA.id, name: 'A Main Campus', code: `A-MC-${suffix}`, address: 'Pune', isMain: true } })
    sessionA = await db.academicSession.create({ data: { tenantId: tA.id, name: 'AY 2026-27', startDate: new Date(2026, 3, 1), endDate: new Date(2027, 2, 31), isCurrent: true } })
    branchB = await db.branch.create({ data: { tenantId: tB.id, name: 'B Campus', code: `B-C-${suffix}`, address: 'Nashik', isMain: true } })
    sessionB = await db.academicSession.create({ data: { tenantId: tB.id, name: 'AY 2026-27', startDate: new Date(2026, 3, 1), endDate: new Date(2027, 2, 31), isCurrent: true } })

    const progA = await db.program.create({ data: { tenantId: tA.id, name: 'Nursery', programType: 'NURSERY', code: `NUR-${suffix}` } })
    const progB = await db.program.create({ data: { tenantId: tB.id, name: 'Nursery B', programType: 'NURSERY', code: `NUB-${suffix}` } })
    void progB

    const classroomA = await db.classroom.create({ data: { tenantId: tA.id, branchId: branchA.id, academicSessionId: sessionA.id, name: 'Nursery Sunflower', code: `NS-${suffix}`, programType: 'NURSERY', programId: progA.id, capacity: 20 } })
    const classroomB = await db.classroom.create({ data: { tenantId: tB.id, branchId: branchB.id, academicSessionId: sessionB.id, name: 'B Nursery', code: `BN-${suffix}`, programType: 'NURSERY', programId: progB.id, capacity: 15 } })

    // Counsellor users
    const counsellor = await db.user.create({ data: { fullName: 'Meera Counsellor', email: `meera.${suffix}@analytics.test`, passwordHash: 'x', status: 'ACTIVE' } })
    await db.tenantUser.create({ data: { tenantId: tA.id, userId: counsellor.id, role: 'COUNSELOR' } })
    void classroomB

    console.log(`  Tenants A/B created · classroom A capacity=20 · counsellor=${counsellor.fullName}`)

    // ── Seed leads in Tenant A ──────────────────────────────────────────────
    console.log('\n[2] Seed leads across sources & statuses (Tenant A)')
    // 5 WALK_IN leads: 1 NEW, 1 CONTACTED, 2 QUALIFIED, 1 CONVERTED
    // 3 FACEBOOK leads: all NEW
    // 2 REFERRAL leads: 1 CONVERTED, 1 LOST (with audit reason FEES)
    const mkLead = async (data: any) => {
      const lead = await db.lead.create({
        data: {
          tenantId: tA.id,
          branchId: branchA.id,
          leadNumber: `LEAD-${suffix}-${await db.lead.count({ where: { tenantId: tA.id } }) + 1}`,
          parentName: data.parentName,
          phone: data.phone,
          source: data.source,
          status: data.status,
          childName: data.childName ?? null,
          childDob: data.childDob ?? null,
          interestedProgram: 'NURSERY',
          assignedToId: data.assignedToId ?? null,
          nextFollowUpAt: data.nextFollowUpAt ?? null,
        },
      })
      return lead
    }

    const phone = (i: number) => `987650${String(1000 + i).slice(-4)}${suffix.slice(0, 0)}`

    const l1 = await mkLead({ parentName: 'Walkin New', phone: phone(1), source: 'WALK_IN', status: 'NEW' })
    const l2 = await mkLead({ parentName: 'Walkin Contacted', phone: phone(2), source: 'WALK_IN', status: 'CONTACTED' })
    const l3 = await mkLead({ parentName: 'Walkin Visit1', phone: phone(3), source: 'WALK_IN', status: 'QUALIFIED', childDob: new Date(2023, 0, 15) })
    const l4 = await mkLead({ parentName: 'Walkin Visit2', phone: phone(4), source: 'WALK_IN', status: 'QUALIFIED', childDob: new Date(2023, 1, 20) })
    const l5 = await mkLead({ parentName: 'Walkin Converted', phone: phone(5), source: 'WALK_IN', status: 'CONVERTED', childDob: new Date(2023, 2, 10), assignedToId: counsellor.id })
    const f1 = await mkLead({ parentName: 'FB New1', phone: phone(6), source: 'FACEBOOK', status: 'NEW', assignedToId: counsellor.id, nextFollowUpAt: new Date(Date.now() - 86_400_000) })
    const f2 = await mkLead({ parentName: 'FB New2', phone: phone(7), source: 'FACEBOOK', status: 'NEW' })
    const f3 = await mkLead({ parentName: 'FB New3', phone: phone(8), source: 'FACEBOOK', status: 'NEW' })
    const r1 = await mkLead({ parentName: 'Referral Converted', phone: phone(9), source: 'REFERRAL', status: 'CONVERTED', childDob: new Date(2023, 3, 5), assignedToId: counsellor.id })
    const r2 = await mkLead({ parentName: 'Referral Lost', phone: phone(10), source: 'REFERRAL', status: 'LOST' })
    void l1

    // Visit completed for l3 + overdue follow-up for f1
    await db.followUp.create({ data: { tenantId: tA.id, domain: 'ADMISSION', sourceType: 'SchoolVisit', sourceId: l3.id, title: 'Campus tour', status: 'RESOLVED', dueAt: new Date(Date.now() - 2 * 86_400_000) } })
    await db.followUp.create({ data: { tenantId: tA.id, domain: 'ADMISSION', sourceType: 'SchoolVisit', sourceId: 'nonexistent-lead', title: 'noise', status: 'RESOLVED' } })
    await db.followUp.create({ data: { tenantId: tA.id, domain: 'ADMISSION', sourceType: 'EnquiryFollowUp', sourceId: l2.id, title: 'First call', status: 'RESOLVED' } })
    await db.followUp.create({ data: { tenantId: tA.id, domain: 'ADMISSION', sourceType: 'EnquiryFollowUp', sourceId: l5.id, title: 'Admission counselling call', status: 'RESOLVED' } })
    // Missed visit (due in past, still OPEN)
    await db.followUp.create({ data: { tenantId: tA.id, domain: 'ADMISSION', sourceType: 'SchoolVisit', sourceId: l4.id, title: 'Missed visit', status: 'OPEN', dueAt: new Date(Date.now() - 86_400_000) } })

    // Lost reason audit (matches LeadService.markLost convention)
    await db.auditLog.create({
      data: {
        tenantId: tA.id,
        entity: 'Lead',
        entityId: r2.id,
        action: 'LEAD_LOST',
        module: 'admissions',
        summary: `Enquiry closed as LOST. Reason: FEES`,
        newValues: { status: 'LOST', lostReason: 'FEES' },
      },
    })

    console.log(`  10 leads seeded (5 WALK_IN, 3 FACEBOOK, 2 REFERRAL)`)

    // ── Seed applications ───────────────────────────────────────────────────
    console.log('\n[3] Seed applications, documents, offers, students')
    const mkApp = async (lead: any, data: any) => {
      const app = await db.admissionApplication.create({
        data: {
          tenantId: tA.id,
          branchId: branchA.id,
          academicSessionId: sessionA.id,
          applicationNumber: `APP-${suffix}-${await db.admissionApplication.count({ where: { tenantId: tA.id } }) + 1}`,
          leadId: lead?.id ?? null,
          programId: progA.id,
          programType: 'NURSERY',
          childFirstName: data.childFirstName,
          childDob: new Date(2023, 0, 10),
          childGender: 'MALE',
          parentName: data.parentName,
          parentPhone: data.parentPhone,
          status: data.status,
          classroomId: data.classroomId ?? null,
          updatedAt: data.updatedAt ?? undefined,
        },
      })
      if (lead) await db.lead.update({ where: { id: lead.id }, data: { convertedApplicationId: app.id } })
      return app
    }

    // l5 → ENROLLED (fresh, placed); r1 → OFFER_SENT pipeline aging 20 days; standalone → WAITLISTED aging 40 days
    const app1 = await mkApp(l5, { childFirstName: 'Converted', parentName: 'Walkin Converted', parentPhone: phone(5), status: 'ENROLLED', classroomId: classroomA.id, updatedAt: new Date() })
    const app2 = await mkApp(r1, { childFirstName: 'Pipeline', parentName: 'Referral Converted', parentPhone: phone(9), status: 'UNDER_REVIEW', updatedAt: new Date(Date.now() - 20 * 86_400_000) })
    const app3 = await mkApp(null, { childFirstName: 'Stuck', parentName: 'Stuck Parent', parentPhone: phone(11), status: 'WAITLISTED', updatedAt: new Date(Date.now() - 40 * 86_400_000) })
    void app3

    // Document on app1
    await db.applicationDocument.create({ data: { applicationId: app1.id, docType: 'BIRTH_CERTIFICATE', fileName: 'birth.pdf', status: 'VERIFIED', verified: true } })

    // Offers: 1 ISSUED, 1 ACCEPTED (3h), 1 DECLINED (reason FEES_TOO_HIGH)
    const mkOffer = (applicationId: string, status: string, extra: any = {}) =>
      db.admissionOffer.create({
        data: {
          tenantId: tA.id,
          applicationId,
          offerNumber: `OFF-${suffix}-${Math.floor(Math.random() * 100000)}`,
          childName: 'Child',
          parentName: 'Parent',
          programType: 'NURSERY',
          status,
          validUntil: new Date(Date.now() + 7 * 86_400_000),
          ...extra,
        },
      })
    await mkOffer(app2.id, 'ISSUED', { issuedAt: new Date(Date.now() - 86_400_000) })
    await mkOffer(app1.id, 'ACCEPTED', { issuedAt: new Date(Date.now() - 6 * 3_600_000), acceptedAt: new Date(Date.now() - 3 * 3_600_000) })
    await mkOffer(app3.id, 'DECLINED', { issuedAt: new Date(Date.now() - 2 * 86_400_000), declinedAt: new Date(), declineReason: 'FEES_TOO_HIGH' })

    // Enrolled student (connects Students module → monthly trend + capacity)
    const student = await db.student.create({
      data: {
        tenantId: tA.id,
        branchId: branchA.id,
        admissionNo: `ADM-${suffix}-001`,
        firstName: 'Converted',
        dob: new Date(2023, 2, 10),
        gender: 'MALE',
        status: 'ACTIVE',
        admissionDate: new Date(),
        currentClassroomId: classroomA.id,
      },
    })
    cleanupIds.push(student.id)

    // Tenant B noise (must NOT leak into A's analytics)
    await db.lead.create({ data: { tenantId: tB.id, branchId: branchB.id, leadNumber: `LEAD-B-1`, parentName: 'Other School Parent', phone: '9999999999', source: 'WEBSITE', status: 'NEW' } })

    console.log(`  3 applications, 1 document, 3 offers, 1 enrolled student, 1 tenant-B noise lead`)

    // ── Run analytics ───────────────────────────────────────────────────────
    console.log('\n[4] Run AdmissionsAnalyticsService.getAnalytics (Tenant A)')
    const analytics = await AdmissionsAnalyticsService.getAnalytics(tA.id, {})
    const scope = { tenantId: tA.id, branchId: branchA.id, academicYearId: sessionA.id }
    void scope

    // Funnel
    console.log('\n[5] 12-Stage Funnel')
    assert(analytics.funnel.length === 12, `Funnel has exactly 12 stages (got ${analytics.funnel.length})`)
    const byKey = Object.fromEntries(analytics.funnel.map((s) => [s.key, s]))
    assert(byKey['ENQUIRY'].count === 10, `Stage 1 Enquiry = 10 (got ${byKey['ENQUIRY'].count})`)
    assert(byKey['CONVERSATION'].count === 5, `Stage 2 Conversation = 5 (CONTACTED 1 + QUALIFIED 2 + CONVERTED 2) (got ${byKey['CONVERSATION'].count})`)
    assert(byKey['VISIT'].count === 1, `Stage 3 Visit done = 1 (only l3 RESOLVED) (got ${byKey['VISIT'].count})`)
    assert(byKey['APPLICATION'].count === 3, `Stage 5 Application = 3 (got ${byKey['APPLICATION'].count})`)
    assert(byKey['DOCUMENTS'].count === 1, `Stage 6 Documents = 1 (only app1 has doc) (got ${byKey['DOCUMENTS'].count})`)
    assert(byKey['OFFER'].count === 1, `Stage 9 Offer = 1 (only app1 ENROLLED; UNDER_REVIEW not yet offered) (got ${byKey['OFFER'].count})`)
    assert(byKey['FINAL_ENROLLMENT'].count === 1, `Stage 12 Enrolled = 1 (got ${byKey['FINAL_ENROLLMENT'].count})`)
    assert(analytics.funnel.every((s, i) => i === 0 || (s.conversionFromPrevious >= 0 && s.conversionFromPrevious <= 100.1)), 'Conversion percentages are sane (0-100)')

    // Totals + isolation
    console.log('\n[6] Totals & Tenant Isolation')
    assert(analytics.totals.leads === 10, `Total leads = 10, tenant-B lead NOT counted (got ${analytics.totals.leads})`)
    assert(analytics.totals.applications === 3, `Total applications = 3 (got ${analytics.totals.applications})`)
    assert(analytics.totals.enrolled === 1, `Total enrolled = 1 (got ${analytics.totals.enrolled})`)
    const analyticsB = await AdmissionsAnalyticsService.getAnalytics(tB.id, {})
    assert(analyticsB.totals.leads === 1, `Tenant B sees only its 1 lead (got ${analyticsB.totals.leads})`)

    // Source ROI
    console.log('\n[7] Source ROI')
    const walkin = analytics.sourceRoi.find((s) => s.source === 'WALK_IN')
    const facebook = analytics.sourceRoi.find((s) => s.source === 'FACEBOOK')
    const referral = analytics.sourceRoi.find((s) => s.source === 'REFERRAL')
    assert(!!walkin && walkin.leads === 5, `WALK_IN leads = 5 (got ${walkin?.leads})`)
    assert(!!facebook && facebook.leads === 3, `FACEBOOK leads = 3 (enum-value source counted, no phantom SOCIAL_MEDIA) (got ${facebook?.leads})`)
    assert(!!referral && referral.leads === 2, `REFERRAL leads = 2 (got ${referral?.leads})`)
    assert(walkin!.enrolled === 1, `WALK_IN enrolled = 1 (got ${walkin?.enrolled})`)
    assert(walkin!.conversionRate === 20, `WALK_IN conversion = 20% (got ${walkin?.conversionRate})`)
    assert(walkin!.avgDaysToConvert !== null, `WALK_IN avg days-to-enroll computed (got ${walkin?.avgDaysToConvert})`)
    assert(!analytics.sourceRoi.some((s) => s.source === 'SOCIAL_MEDIA'), 'No phantom SOCIAL_MEDIA row')
    assert(analytics.sources.length >= 10 && analytics.sources.includes('GOOGLE_ADS'), 'Source catalogue served from canonical enum')

    // Counsellor board
    console.log('\n[8] Counsellor Leaderboard')
    assert(analytics.counsellorBoard.length === 1, `One counsellor with assignments (got ${analytics.counsellorBoard.length})`)
    const meera = analytics.counsellorBoard[0]
    assert(meera.name === 'Meera Counsellor', `Counsellor name resolved via User (got ${meera.name})`)
    assert(meera.assigned === 3, `Meera assigned = 3 (l5, f1, r1) (got ${meera.assigned})`)
    assert(meera.converted === 2, `Meera converted = 2 (l5, r1) (got ${meera.converted})`)
    assert(meera.conversionRate === 66.7, `Meera conversion = 66.7% (got ${meera.conversionRate})`)
    assert(meera.followUpsDue === 1, `Meera overdue follow-ups = 1 (f1 past due) (got ${meera.followUpsDue})`)

    // Aging
    console.log('\n[9] Aging & Stuck')
    // ENROLLED is terminal — aging only counts active pipeline (app2 UNDER_REVIEW + app3 WAITLISTED)
    const totalAging = analytics.aging.reduce((s, b) => s + b.count, 0)
    assert(totalAging === 2, `Active applications bucketed = 2 (ENROLLED excluded) (got ${totalAging})`)
    assert(analytics.aging.find((b) => b.bucket === '30+ days')?.count === 1, 'One application 30+ days (waitlisted)')
    assert(analytics.aging.find((b) => b.bucket === '15-30 days')?.count === 1, 'One application 15-30 days (under review)')
    assert(analytics.stuckApplications[0]?.daysInStage >= 40 && analytics.stuckApplications.length <= 10, 'Stuck list present, oldest first, capped at 10')

    // Offer insights
    console.log('\n[10] Offer Insights')
    assert(analytics.offerInsights.total === 3, `Offers total = 3 (got ${analytics.offerInsights.total})`)
    assert(analytics.offerInsights.issued === 1 && analytics.offerInsights.accepted === 1 && analytics.offerInsights.declined === 1, 'Issued/Accepted/Declined = 1/1/1')
    assert(analytics.offerInsights.acceptanceRate === 50, `Acceptance rate = 50% (got ${analytics.offerInsights.acceptanceRate})`)
    assert(analytics.offerInsights.avgHoursToAccept === 3, `Avg hours to accept = 3h (got ${analytics.offerInsights.avgHoursToAccept})`)
    assert(analytics.offerInsights.declineReasons[0]?.reason === 'FEES_TOO_HIGH', `Decline reason captured (got ${analytics.offerInsights.declineReasons[0]?.reason})`)

    // Capacity forecast
    console.log('\n[11] Capacity Forecast')
    const nursery = analytics.capacityForecast.find((c) => c.programType === 'NURSERY')
    assert(!!nursery, 'Nursery row present')
    assert(nursery!.capacity === 20 && nursery!.sections === 1, `Capacity = 20 across 1 section (got ${nursery!.capacity}/${nursery!.sections})`)
    assert(nursery!.enrolled === 1, `Live occupancy from Students = 1 (got ${nursery!.enrolled})`)
    assert(nursery!.pipelineActive === 1, `Pipeline = 1 (UNDER_REVIEW app) (got ${nursery!.pipelineActive})`)
    assert(nursery!.waitlisted === 1, `Waitlist depth = 1 (got ${nursery!.waitlisted})`)
    assert(nursery!.availableSeats === 19, `Seats left = 19 (got ${nursery!.availableSeats})`)

    // Speed metrics
    console.log('\n[12] Speed Metrics')
    // Dangling 'noise' visit (sourceId=nonexistent-lead) must be excluded from speed metrics
    assert(analytics.speedMetrics.visitsScheduled === 2, `Visits scheduled = 2 (dangling visit row excluded) (got ${analytics.speedMetrics.visitsScheduled})`)
    assert(analytics.speedMetrics.visitsCompleted === 1, `Visits completed = 1 (got ${analytics.speedMetrics.visitsCompleted})`)
    assert(analytics.speedMetrics.visitsMissed === 1, `Visits missed = 1 (got ${analytics.speedMetrics.visitsMissed})`)
    assert(analytics.speedMetrics.visitNoShowRate === 50, `No-show rate = 50% (got ${analytics.speedMetrics.visitNoShowRate})`)
    assert(analytics.speedMetrics.avgFirstResponseHours !== null && analytics.speedMetrics.avgFirstResponseHours >= 0, `First-response computed (got ${analytics.speedMetrics.avgFirstResponseHours})`)

    // Lost reasons
    console.log('\n[13] Lost Reasons (audit trail)')
    assert(analytics.lostReasons.some((l) => l.reason === 'FEES' && l.count === 1), `FEES lost reason = 1 (got ${JSON.stringify(analytics.lostReasons)})`)

    // Monthly trends
    console.log('\n[14] Monthly Trends (Leads + Students connectivity)')
    assert(analytics.monthlyTrends.length === 12, `12 month points (got ${analytics.monthlyTrends.length})`)
    const thisMonth = analytics.monthlyTrends[analytics.monthlyTrends.length - 1]
    assert(thisMonth.enquiries === 10, `This month enquiries = 10 (got ${thisMonth.enquiries})`)
    assert(thisMonth.enrollments === 1, `This month enrollments = 1 (from Students.admissionDate) (got ${thisMonth.enrollments})`)

    // Range filter
    console.log('\n[15] Range Filter')
    const futureOnly = await AdmissionsAnalyticsService.getAnalytics(tA.id, {
      from: new Date(Date.now() + 86_400_000),
      to: new Date(Date.now() + 7 * 86_400_000),
    })
    assert(futureOnly.totals.leads === 0, `Future range → 0 leads (got ${futureOnly.totals.leads})`)
    void LeadService

    console.log('\n====================================================================')
    if (failed === 0) {
      console.log(`✅ ALL ${passed} CHECKS PASSED — Admission Analytics 2.0 verified end-to-end`)
    } else {
      console.log(`❌ ${failed} FAILED / ${passed} PASSED`)
      process.exitCode = 1
    }
    console.log('====================================================================')
  } catch (err) {
    console.error('\n💥 Test setup error:', err)
    process.exitCode = 1
  } finally {
    // Cleanup seeded data (explicit child deletes — FK-safe order)
    try {
      const ids = [tenantA, tenantB]
      const tenants = await db.tenant.findMany({ where: { code: { in: ids } } })
      for (const t of tenants) {
        await db.admissionOffer.deleteMany({ where: { tenantId: t.id } })
        await db.applicationDocument.deleteMany({ where: { application: { tenantId: t.id } } })
        await db.admissionApplication.deleteMany({ where: { tenantId: t.id } })
        await db.followUp.deleteMany({ where: { tenantId: t.id } })
        await db.lead.deleteMany({ where: { tenantId: t.id } })
        await db.student.deleteMany({ where: { tenantId: t.id } })
        await db.classroom.deleteMany({ where: { tenantId: t.id } })
        await db.program.deleteMany({ where: { tenantId: t.id } })
        await db.academicSession.deleteMany({ where: { tenantId: t.id } })
        await db.auditLog.deleteMany({ where: { tenantId: t.id } })
        await db.tenantUser.deleteMany({ where: { tenantId: t.id } })
        await db.branch.deleteMany({ where: { tenantId: t.id } })
        await db.tenant.delete({ where: { id: t.id } })
      }
      await db.user.deleteMany({ where: { email: { contains: `.${suffix}@analytics.test` } } })
      console.log('\n🧹 Cleanup done (all seeded rows deleted)')
    } catch (e) {
      console.error('cleanup warning:', e)
    }
    await db.$disconnect()
  }
}

main()
