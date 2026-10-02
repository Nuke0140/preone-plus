import pg from 'pg'
const c = new pg.Client({ connectionString: 'postgresql://preone:preone@127.0.0.1:54329/preone' })
await c.connect()
await c.query(`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS "tenantId" TEXT`)
await c.query(`UPDATE receipts r SET "tenantId" = p."tenantId" FROM payments p WHERE p.id = r."paymentId" AND r."tenantId" IS NULL`)
const r = await c.query(`SELECT count(*)::int AS n FROM receipts WHERE "tenantId" IS NULL`)
console.log('nulls left:', r.rows[0].n)
await c.end()
