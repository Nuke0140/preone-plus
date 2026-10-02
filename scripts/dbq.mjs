import { Client } from 'pg'
// Usage: node scripts/dbq.mjs <queryKey> <param1> [param2...]
const QUERIES = {
  issuedInvoice: 'SELECT id, "invoiceNumber", "balanceCents", "totalCents", status FROM invoices WHERE "tenantId"=$1 AND status=$2 ORDER BY "createdAt" DESC LIMIT 1',
  tenantLead: 'SELECT id, status FROM crm_leads WHERE "tenantId"=$1 AND "deletedAt" IS NULL LIMIT 1',
  tenantStudents: 'SELECT id, "firstName" FROM students WHERE "tenantId"=$1 AND status=$2 ORDER BY "firstName" LIMIT 2',
  branchOf: 'SELECT id FROM branches WHERE "tenantId"=$1 LIMIT 1',
  payRefCount: 'SELECT count(*)::int AS n FROM payments WHERE "transactionRef"=$1',
  ownChildInvCount: `SELECT count(*)::int AS n FROM invoices i WHERE i."studentId" IN (
     SELECT sg."studentId" FROM student_guardians sg
     JOIN guardians g ON g.id=sg."guardianId"
     JOIN users u ON u.id=g."userId" WHERE u.email=$1)`,
  nonChildStudent: `SELECT s.id, s."firstName" FROM students s
     WHERE s."tenantId"=$1 AND s."deletedAt" IS NULL AND s.id NOT IN (
       SELECT sg."studentId" FROM student_guardians sg
       JOIN guardians g ON g.id=sg."guardianId"
       JOIN users u ON u.id=g."userId" WHERE u.email=$2) LIMIT 1`,
  activeAllocCount: 'SELECT count(*)::int AS n FROM student_allocations WHERE "classroomId"=$1 AND status=$2',
  parentOf: `SELECT u.id FROM users u WHERE u.email=$1`,
}
const [key, ...params] = process.argv.slice(2)
const sql = QUERIES[key]
if (!sql) { console.error('unknown query ' + key); process.exit(1) }
const c = new Client({ host: '127.0.0.1', port: 54329, user: 'preone', password: 'preone', database: 'preone' })
await c.connect()
try {
  const r = await c.query(sql, params)
  console.log(JSON.stringify(r.rows))
} catch (e) { console.error('DBERR ' + e.message); process.exit(1) } finally { await c.end() }
