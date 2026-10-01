// m01-fixture.mjs — TEST HARNESS ONLY (not product code)
// · create-parent-user <tenantId> <email> <password> <name>
//     Parent portal accounts are provisioned outside the staff users API
//     (schools create them from Guardian records); the E2E uses this fixture
//     to exercise guardian-scoped parent flows.
// · link-guardian <tenantId> <parentEmail> <studentId>
//     Links an existing Guardian row to a Parent portal user.
import pg from 'pg'
import bcrypt from 'bcryptjs'

const args = process.argv.slice(2)
const cmd = args[0]
// hardcode test connection — sandbox exports a bogus DATABASE_URL
const c = new pg.Client({ connectionString: 'postgresql://preone:preone@127.0.0.1:54329/preone' })
await c.connect()

if (cmd === 'create-parent-user') {
  const [, tenantId, emailRaw, password, name] = args
  const email = emailRaw.toLowerCase().trim() // login route looks up lowercased emails
  const exists = await c.query(`SELECT id FROM users WHERE email=$1 LIMIT 1`, [email])
  if (exists.rowCount > 0) {
    console.log('exists', exists.rows[0].id)
  } else {
    const passwordHash = await bcrypt.hash(password, 10)
    const u = await c.query(
      `INSERT INTO users (id, email, "passwordHash", "fullName", status, "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, 'ACTIVE', now()) RETURNING id`,
      [email, passwordHash, name]
    )
    // parent must hold a PARENT membership of the tenant to get a school-scoped session
    await c.query(
      `INSERT INTO tenant_users (id, "tenantId", "userId", role, status, "updatedAt") VALUES (gen_random_uuid(), $1, $2, 'PARENT', 'ACTIVE', now())`,
      [tenantId, u.rows[0].id]
    )
    console.log('created', u.rows[0].id)
  }
} else if (cmd === 'link-guardian') {
  const [, tenantId, parentEmailRaw, studentId] = args
  const parentEmail = parentEmailRaw.toLowerCase().trim()
  const u = await c.query(`SELECT id FROM users WHERE email=$1 LIMIT 1`, [parentEmail])
  if (u.rowCount === 0) throw new Error('parent user not found')
  const g = await c.query(
    `SELECT g.id FROM guardians g
     JOIN student_guardians sg ON sg."guardianId" = g.id
     WHERE g."tenantId"=$1 AND sg."studentId"=$2 LIMIT 1`,
    [tenantId, studentId]
  )
  if (g.rowCount === 0) throw new Error('guardian not found for student')
  await c.query(`UPDATE guardians SET "userId"=$1 WHERE id=$2`, [u.rows[0].id, g.rows[0].id])
  console.log('linked guardian', g.rows[0].id, '→ user', u.rows[0].id)
} else {
  throw new Error('unknown command')
}
await c.end()
