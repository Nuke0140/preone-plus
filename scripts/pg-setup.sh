#!/bin/bash
# PreOne — user-space PostgreSQL setup script
# Runs PostgreSQL 17 without root, data dir inside project.
set -e

PGBIN="/home/z/my-project/node_modules/@embedded-postgres/linux-x64/native/bin"
PGDATA="/home/z/my-project/db/pgdata"
PGLOG="/home/z/my-project/db/pg.log"
SOCKDIR="/home/z/my-project/db/pgsock"
PORT=54329
DBNAME="preone"
DBUSER="preone"
DBPASS="preone"

mkdir -p /home/z/my-project/db "$SOCKDIR"

if [ ! -f "$PGDATA/PG_VERSION" ]; then
  echo "[pgsetup] Initializing data directory..."
  "$PGBIN/initdb" -D "$PGDATA" -U postgres -A trust -E UTF8 --locale=C >/dev/null
  echo "[pgsetup] initdb done."
fi

# Start if not running
if "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
  echo "[pgsetup] PostgreSQL already running."
else
  echo "[pgsetup] Starting PostgreSQL on port $PORT..."
  "$PGBIN/pg_ctl" -D "$PGDATA" -l "$PGLOG" \
    -o "-p $PORT -k $SOCKDIR -c listen_addresses=127.0.0.1" -w start >/dev/null
  echo "[pgsetup] Started."
fi

# Create role + database (idempotent) — via node pg client (psql not bundled)
export DATABASE_URL_ADMIN="postgresql://postgres@127.0.0.1:$PORT/postgres"
node /home/z/my-project/scripts/pg-admin.mjs ensure-role "$DBUSER" "$DBPASS" || exit 1
node /home/z/my-project/scripts/pg-admin.mjs ensure-db "$DBNAME" "$DBUSER" || exit 1
node /home/z/my-project/scripts/pg-admin.mjs grant "$DBNAME" "$DBUSER" || exit 1

echo "[pgsetup] Connection URL: postgresql://$DBUSER:$DBPASS@127.0.0.1:$PORT/$DBNAME"
echo "[pgsetup] OK"
