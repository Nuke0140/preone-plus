const { Client } = require('pg')
const fs = require('fs')
const path = require('path')
require('dotenv').config()

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set')
  }

  const client = new Client({ connectionString })
  await client.connect()
  console.log('Connected to PostgreSQL database.')

  try {
    const sqlPath = path.join(__dirname, '../prisma/migrations/20260926_setup_v2/migration.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')

    console.log('\nApplying PreOne M00 Setup v2 staged migration...')
    await client.query(sql)
    console.log('\nMigration executed successfully!')

    // Verify tables
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('subjects', 'program_subjects', 'classroom_subjects')
    `)
    console.log('Verified tables:', res.rows.map((r) => r.table_name).join(', '))

    // Verify column
    const colRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'principalSignatureUrl'
    `)
    console.log('Verified tenant column:', colRes.rows.map((r) => r.column_name).join(', '))

  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
