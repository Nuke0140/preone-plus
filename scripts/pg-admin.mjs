// pg-admin.mjs — small helper to bootstrap roles/databases without psql
import pg from 'pg';

const [cmd, ...args] = process.argv.slice(2);
const conn = new pg.Client({ connectionString: process.env.DATABASE_URL_ADMIN });

async function main() {
  await conn.connect();
  if (cmd === 'ensure-role') {
    const [user, pass] = args;
    const r = await conn.query(`SELECT 1 FROM pg_roles WHERE rolname=$1`, [user]);
    if (r.rowCount === 0) {
      await conn.query(`CREATE ROLE ${user} LOGIN PASSWORD '${pass}' CREATEDB;`);
      console.log(`[pgadmin] role ${user} created`);
    } else {
      await conn.query(`ALTER ROLE ${user} WITH LOGIN PASSWORD '${pass}' CREATEDB;`);
      console.log(`[pgadmin] role ${user} exists (password ensured)`);
    }
  } else if (cmd === 'ensure-db') {
    const [dbname, owner] = args;
    const r = await conn.query(`SELECT 1 FROM pg_database WHERE datname=$1`, [dbname]);
    if (r.rowCount === 0) {
      await conn.query(`CREATE DATABASE ${dbname} OWNER ${owner};`);
      console.log(`[pgadmin] database ${dbname} created`);
    } else {
      console.log(`[pgadmin] database ${dbname} exists`);
    }
  } else if (cmd === 'grant') {
    const [dbname, user] = args;
    await conn.query(`GRANT ALL PRIVILEGES ON DATABASE ${dbname} TO ${user};`);
    console.log(`[pgadmin] privileges granted on ${dbname} to ${user}`);
  } else {
    console.error(`Unknown command: ${cmd}`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => { console.error('[pgadmin] error:', e.message); process.exitCode = 1; })
  .finally(() => conn.end());
