import { db } from '../src/lib/db'

async function main() {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS test_table (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    )
  `)
  const res = await db.$queryRawUnsafe('SELECT * FROM test_table')
  console.log('Test table created successfully:', res)
  await db.$executeRawUnsafe('DROP TABLE test_table')
  console.log('Test table dropped successfully')
}

main().catch(console.error).finally(() => process.exit(0))
