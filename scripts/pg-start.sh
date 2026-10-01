#!/bin/bash
# pg-start.sh — recover + start embedded PostgreSQL 17.10 (port 54329)
# Handles the recurring sandbox issues: stale pid, ICU symlinks, missing runtime dirs, perms.
set -e
BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGDATA="$BASE/db/pgdata"
BIN="$BASE/node_modules/@embedded-postgres/linux-x64/native/bin"
LIB="$BASE/node_modules/@embedded-postgres/linux-x64/native/lib"
export LD_LIBRARY_PATH="$LIB:$LD_LIBRARY_PATH"
export DATABASE_URL="postgresql://preone:preone@127.0.0.1:54329/preone"

# already running?
if "$BIN/pg_isready" -h 127.0.0.1 -p 54329 >/dev/null 2>&1; then
  echo "[pg] already running"
  exit 0
fi

echo "[pg] cleaning stale state..."
rm -f "$PGDATA/postmaster.pid"
chmod 700 "$PGDATA" 2>/dev/null || true

# ICU symlinks (libicu*.so.60 -> .60.2)
for f in "$LIB"/libicu*.so.60.2; do
  [ -e "$f" ] || continue
  ln -sf "$f" "${f%.2}"
done

# runtime dirs Postgres requires to exist (may be wiped)
for d in pg_notify pg_tblspc pg_replslot pg_twophase pg_commit_ts pg_dynshmem \
         pg_snapshots pg_serial pg_stat pg_stat_tmp pg_wal/archive_status \
         pg_logical/snapshots pg_logical/mappings pg_multixact/members pg_multixact/offsets \
         pg_subtrans; do
  mkdir -p "$PGDATA/$d"
done

# enforce port/listen (sandbox resets postgresql.conf to defaults = 5432)
if [ -f "$PGDATA/postgresql.conf" ] && ! grep -q "PreOne enforced settings" "$PGDATA/postgresql.conf"; then
  cat >> "$PGDATA/postgresql.conf" <<'CONF'

# ── PreOne enforced settings (sandbox resets this file) ──
port = 54329
listen_addresses = '127.0.0.1'
unix_socket_directories = '/tmp'
CONF
fi

# .env must point at PG (sandbox overwrites it with SQLite)
if [ -f "$BASE/.env" ]; then
  grep -q "54329" "$BASE/.env" 2>/dev/null || cat > "$BASE/.env" <<'ENVEOF'
DATABASE_URL=postgresql://preone:preone@127.0.0.1:54329/preone
JWT_SECRET=preone-dev-jwt-secret-2f8b7c9d4e6a1f3b5c8d0e
NODE_ENV=development
ENVEOF
fi

echo "[pg] starting..."
"$BIN/pg_ctl" -D "$PGDATA" -l "$BASE/db/pg.log" start

for i in $(seq 1 15); do
  if "$BIN/pg_isready" -h 127.0.0.1 -p 54329 >/dev/null 2>&1; then
    echo "[pg] READY on 54329"
    exit 0
  fi
  sleep 1
done
echo "[pg] FAILED to start — tail of db/pg.log:"
tail -20 "$BASE/db/pg.log"
exit 1
