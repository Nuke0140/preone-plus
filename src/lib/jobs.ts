import { db } from './db'
import { audit } from './audit'

export type JobType = 'BULK_INVOICE' | 'BULK_RECEIPT' | 'PAYMENT_EXPORT' | 'DATA_EXPORT'

export interface EnqueueJobOptions {
  tenantId: string
  jobType: JobType
  payload?: any
  createdById?: string
}

export async function enqueueJob(options: EnqueueJobOptions) {
  const job = await db.backgroundJob.create({
    data: {
      tenantId: options.tenantId,
      jobType: options.jobType,
      payload: options.payload ?? undefined,
      status: 'PENDING',
      progress: 0,
      createdById: options.createdById,
    },
  })

  await audit({
    tenantId: options.tenantId,
    actorId: options.createdById,
    action: 'JOB_ENQUEUED',
    entity: 'BackgroundJob',
    entityId: job.id,
    module: 'Jobs',
    summary: `Enqueued ${options.jobType} background job`,
  })

  // Trigger processor asynchronously without blocking
  setTimeout(() => {
    processJob(job.id).catch((err) => {
      console.error(`[jobs] Error processing job ${job.id}:`, err)
    })
  }, 10)

  return job
}

export async function getJob(jobId: string, tenantId: string) {
  return db.backgroundJob.findFirst({
    where: { id: jobId, tenantId },
  })
}

export async function listJobs(tenantId: string, limit = 20) {
  return db.backgroundJob.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

async function processJob(jobId: string) {
  const job = await db.backgroundJob.findUnique({
    where: { id: jobId },
  })

  if (!job || job.status !== 'PENDING') return

  await db.backgroundJob.update({
    where: { id: jobId },
    data: { status: 'PROCESSING', startedAt: new Date(), progress: 10 },
  })

  try {
    let result: any = null

    switch (job.jobType) {
      case 'BULK_INVOICE': {
        // Bulk invoice generation job implementation
        const payload = (job.payload as any) || {}
        const { programType, classroomId, dueDate, monthName } = payload

        const students = await db.student.findMany({
          where: {
            tenantId: job.tenantId,
            status: 'ACTIVE',
            ...(classroomId ? { currentClassroomId: classroomId } : {}),
          },
          include: {
            currentClassroom: true,
          },
        })

        const activePlans = await db.feePlan.findMany({
          where: { tenantId: job.tenantId, isActive: true },
          include: { items: true },
        })

        let generatedCount = 0
        const total = students.length

        for (let i = 0; i < students.length; i++) {
          const student = students[i]
          const pType = student.currentClassroom?.programType || programType
          const plan = activePlans.find((p) => p.programType === pType) || activePlans[0]

          if (plan && plan.items.length > 0) {
            const subtotal = plan.items.reduce((sum, item) => sum + item.amountCents, 0)
            const count = await db.invoice.count({ where: { tenantId: job.tenantId } })
            const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`

            await db.invoice.create({
              data: {
                tenantId: job.tenantId,
                branchId: student.branchId,
                studentId: student.id,
                invoiceNumber,
                title: `${monthName || 'Monthly'} Fee - ${student.firstName} ${student.lastName || ''}`.trim(),
                dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 15 * 86400000),
                subtotalCents: subtotal,
                totalCents: subtotal,
                balanceCents: subtotal,
                status: 'ISSUED',
                items: {
                  create: plan.items.map((item) => ({
                    feeHead: item.feeHead,
                    description: item.label,
                    amountCents: item.amountCents,
                  })),
                },
              },
            })
            generatedCount++
          }

          // Update progress periodically
          const progress = Math.min(90, Math.floor(((i + 1) / total) * 80) + 10)
          await db.backgroundJob.update({
            where: { id: jobId },
            data: { progress },
          })
        }

        result = { generatedCount, totalStudents: total }
        break
      }

      case 'BULK_RECEIPT': {
        // Bulk receipt generation for verified payments missing receipts
        const payments = await db.payment.findMany({
          where: {
            tenantId: job.tenantId,
            status: 'SUCCESS',
            receipt: null,
          },
        })

        let generatedReceipts = 0
        for (let i = 0; i < payments.length; i++) {
          const p = payments[i]
          const count = await db.receipt.count({ where: { tenantId: job.tenantId } })
          const receiptNumber = `RCT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`

          await db.receipt.create({
            data: {
              tenantId: job.tenantId,
              paymentId: p.id,
              receiptNumber,
              amountCents: p.amountCents,
            },
          })
          generatedReceipts++
        }

        result = { generatedReceipts }
        break
      }

      case 'PAYMENT_EXPORT':
      case 'DATA_EXPORT': {
        // Prepare summary export payload
        const payments = await db.payment.findMany({
          where: { tenantId: job.tenantId },
          include: { student: true, receipt: true },
          take: 500,
          orderBy: { paymentDate: 'desc' },
        })

        const exportData = payments.map((p) => ({
          paymentNumber: p.paymentNumber,
          date: p.paymentDate.toISOString().slice(0, 10),
          student: p.student ? `${p.student.firstName} ${p.student.lastName || ''}`.trim() : 'N/A',
          admissionNo: p.student?.admissionNo || 'N/A',
          amountRupees: (p.amountCents / 100).toFixed(2),
          method: p.method,
          status: p.status,
          receiptNumber: p.receipt?.receiptNumber || 'N/A',
        }))

        result = { rowCount: exportData.length, records: exportData }
        break
      }

      default:
        throw new Error(`Unknown job type: ${job.jobType}`)
    }

    await db.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        result: result ?? undefined,
        completedAt: new Date(),
      },
    })

    await audit({
      tenantId: job.tenantId,
      actorId: job.createdById,
      action: 'JOB_COMPLETED',
      entity: 'BackgroundJob',
      entityId: job.id,
      module: 'Jobs',
      summary: `Completed ${job.jobType} background job successfully`,
    })
  } catch (err: any) {
    console.error(`[jobs] Job ${jobId} failed:`, err)
    await db.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        error: err?.message || 'Unknown error occurred during background execution',
        completedAt: new Date(),
      },
    })

    await audit({
      tenantId: job.tenantId,
      actorId: job.createdById,
      action: 'JOB_FAILED',
      entity: 'BackgroundJob',
      entityId: job.id,
      module: 'Jobs',
      severity: 'WARNING',
      summary: `Failed ${job.jobType} background job: ${err?.message || 'Unknown error'}`,
    })
  }
}
