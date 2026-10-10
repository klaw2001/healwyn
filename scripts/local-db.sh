#!/usr/bin/env bash
# A throwaway local Postgres for development and end-to-end tests. No Docker.
# Needs Postgres 15+ server binaries (initdb, pg_ctl) on PATH or under
# /usr/lib/postgresql/<version>/bin.
#
#   pnpm db:local start   create (first run) and start the cluster, apply the Supabase shim
#   pnpm db:local stop    stop it
#   pnpm db:local reset   delete the cluster and start fresh
#   pnpm db:local url     print the DATABASE_URL to use (database owner: migrations, seed, tests)
#   pnpm db:local web-url ensure the least-privilege login role exists (after migrating) and print WEB_DATABASE_URL
#   pnpm db:local status
#
# Then: DATABASE_URL="$(pnpm -s db:local url)" pnpm db:migrate && pnpm db:seed
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE="$ROOT/.local"
DATA="$STATE/pgdata"
PORT="${LOCAL_PG_PORT:-54329}"
DB="${LOCAL_PG_DB:-healwyn}"
URL="postgresql://postgres@127.0.0.1:$PORT/$DB"

find_bin() {
  if command -v pg_ctl >/dev/null 2>&1; then dirname "$(command -v pg_ctl)"; return; fi
  local dir
  dir="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
  if [[ -n "$dir" && -x "$dir/pg_ctl" ]]; then echo "$dir"; return; fi
  echo "Postgres server binaries not found. Install Postgres 15+ (or use the Supabase CLI)." >&2
  exit 1
}

BIN="$(find_bin)"

# initdb and postgres refuse to run as root; use the postgres system user.
as_pg() {
  if [[ "$(id -u)" == "0" ]]; then runuser -u postgres -- "$@"; else "$@"; fi
}

running() { as_pg "$BIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; }

start() {
  if [[ ! -d "$DATA" ]]; then
    mkdir -p "$DATA"
    [[ "$(id -u)" == "0" ]] && chown -R postgres:postgres "$STATE"
    as_pg "$BIN/initdb" -D "$DATA" -U postgres --auth=trust --encoding=UTF8 --locale=C.UTF-8 >/dev/null
  fi
  if ! running; then
    as_pg "$BIN/pg_ctl" -D "$DATA" -l "$DATA/server.log" -w \
      -o "-p $PORT -k $DATA -c listen_addresses=127.0.0.1" start >/dev/null
  fi
  if ! "$BIN/psql" -h 127.0.0.1 -p "$PORT" -U postgres -tAc "select 1 from pg_database where datname = '$DB'" | grep -q 1; then
    "$BIN/psql" -h 127.0.0.1 -p "$PORT" -U postgres -qc "create database $DB"
  fi
  "$BIN/psql" "$URL" -q -v ON_ERROR_STOP=1 -f "$ROOT/packages/db/supabase/local-shim.sql" >/dev/null
  echo "Local Postgres running: $URL"
}

stop() {
  if [[ -d "$DATA" ]] && running; then as_pg "$BIN/pg_ctl" -D "$DATA" -w stop >/dev/null; fi
  echo "Local Postgres stopped."
}

# A login role for the website that can only run submit_lead and hit_rate_limit
# (role web_submitter, created by the migrations). Trust auth: local only.
web_url() {
  local web_user="${LOCAL_PG_WEB_USER:-healwyn_web}"
  "$BIN/psql" "$URL" -q -v ON_ERROR_STOP=1 >/dev/null <<SQL
do \$\$
begin
  if not exists (select from pg_roles where rolname = 'web_submitter') then
    raise exception 'Run the migrations first: DATABASE_URL="$URL" pnpm db:migrate';
  end if;
  if not exists (select from pg_roles where rolname = '$web_user') then
    create role $web_user login;
  end if;
end
\$\$;
grant web_submitter to $web_user;
SQL
  echo "postgresql://$web_user@127.0.0.1:$PORT/$DB"
}

case "${1:-start}" in
  start) start ;;
  stop) stop ;;
  reset) stop; rm -rf "$DATA"; start ;;
  url) echo "$URL" ;;
  web-url) web_url ;;
  status) if [[ -d "$DATA" ]] && running; then echo "running: $URL"; else echo "stopped"; fi ;;
  *) echo "usage: $0 start|stop|reset|url|web-url|status" >&2; exit 2 ;;
esac
