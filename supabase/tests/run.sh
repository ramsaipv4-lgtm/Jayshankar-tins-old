#!/usr/bin/env bash
# SQL regression tests for the database layer. Needs a local PostgreSQL 15+ you can create
# databases on — NOT the live Supabase project. Nothing here touches Supabase.
#
#   PGHOST=/tmp PGPORT=5432 PGUSER=postgres ./supabase/tests/run.sh          # run everything
#   ./supabase/tests/run.sh 30                                                 # only tests/30_*.sql
#
# What it does: creates a scratch database, stubs the little bit of Supabase the migrations touch
# (roles anon/authenticated/service_role, auth.users, auth.uid()), applies every migration in
# supabase/migrations in order, then supabase/rls-policies.sql, loads fixtures (one user per
# role), and runs each NN_*.sql test inside a transaction that is rolled back.
# A test fails on any ERROR or on a failed pg_temp.ok(...) assertion.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
SUPA="$(dirname "$HERE")"
DB="${TEST_DB:-jayshankar_sql_test}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d postgres)
export PGHOST="${PGHOST:-/tmp}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}"

"${PSQL[@]}" -c "drop database if exists $DB" -c "create database $DB" >/dev/null || { echo "cannot create $DB"; exit 2; }
P=(psql -X -q -v ON_ERROR_STOP=1 -d "$DB")
run() { "${P[@]}" -f "$1" >/dev/null 2>/tmp/sqltest_err.$$ || { echo "FAILED APPLYING $1"; grep -v NOTICE /tmp/sqltest_err.$$ | head -5; exit 2; }; }

run "$HERE/00_supabase_stub.sql"
for f in "$SUPA"/migrations/*.sql; do
  run "$f"
  # 0011 and later call current_user_role(), which rls-policies.sql normally defines first
  if [ "$(basename "$f" | cut -c1-4)" = "0001" ]; then
    "${P[@]}" -c "create or replace function public.current_user_role() returns text language sql stable security definer set search_path = public as 'select role from public.users where id = auth.uid()'" >/dev/null
  fi
done
run "$SUPA/rls-policies.sql"
run "$HERE/_fixtures.sql"

pass=0; fail=0
for t in "$HERE"/${1:-[1-9]}*.sql; do
  out=$( (cat "$HERE/_lib.sql"; echo "begin;"; cat "$t"; echo "rollback;") | "${P[@]}" 2>&1 | grep -v "NOTICE\|^CONTEXT\|^$" )
  if echo "$out" | grep -q "ERROR\|ASSERT"; then
    fail=$((fail+1)); echo "FAIL  $(basename "$t")"; echo "$out" | grep -m3 "ERROR\|ASSERT\|DETAIL\|HINT"
  else
    pass=$((pass+1)); echo "ok    $(basename "$t")"
  fi
done
echo "passed=$pass failed=$fail"
[ "$fail" -eq 0 ]
