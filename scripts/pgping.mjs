import pg from 'pg';
const c = new pg.Client({ connectionString: 'postgresql://preone:preone@127.0.0.1:54329/preone' });
try { await c.connect(); const r = await c.query('select count(*)::int as n from "students"'); console.log('PG TCP OK, students:', r.rows[0].n); await c.end(); }
catch (e) { console.log('PG TCP FAIL:', e.message); process.exit(1); }
