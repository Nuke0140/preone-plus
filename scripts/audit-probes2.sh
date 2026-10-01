#!/usr/bin/env bash
# ============================================================
# M01 AUDIT — PROBES v3: P8 precise + P9 race with tenant-B owner
# ============================================================
set -u
BASE="http://127.0.0.1:3000"
PASS=0; FAIL=0
note() { echo; echo "── $1 ─────────────────────────────────────────"; }
res()  { if [ "$1" == "Y" ]; then PASS=$((PASS+1)); echo "  ⇒ CONFIRMED: $2"; else FAIL=$((FAIL+1)); echo "  ⇒ REFUTED:  $2"; fi; }
jq()   { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const r=JSON.parse(d);console.log(eval(process.argv[1]))}catch(e){console.log('JQERR')}})" "$1"; }

note "P8 (precise) — SSR page leaks NON-CHILD student data to parent?"
JPAR=/tmp/par.txt
NONCHILD="84b6d205-6bbc-433f-ace2-e2e5e7cce27e"
NM=$(node scripts/dbq.mjs nonChildStudent "951b5049-83de-452f-97d6-37fb632c01de" "parent@sunshine.demo" | jq 'r[0] ? (r[0].firstName) : "NONE"')
echo "  non-child student = $NONCHILD ($NM)"
CODE=$(curl -s -b $JPAR -o /tmp/p8.html -w "%{http_code}" "$BASE/app/students/$NONCHILD")
HASID=$(grep -c "$NONCHILD" /tmp/p8.html || true)
HASNAME=$(grep -c "$NM" /tmp/p8.html || true)
HASINV=$(grep -o "INV-2026-[0-9]*" /tmp/p8.html | sort -u | tr '\n' ' ')
echo "  HTTP $CODE · student-uuid occurrences: $HASID · name '$NM' occurrences: $HASNAME · invoice numbers in page: ${HASINV:-none}"
[ "$CODE" == "200" ] && { [ "${HASNAME:-0}" -ge 1 ] || [ "${HASINV:-0}" -ge 1 ]; } && res Y "SSR parent IDOR: non-child student page rendered incl. finance data" || res N "SSR page did not expose non-child data"

note "P9 — CAPACITY TOCTOU RACE (owner of tenant B, 6 rounds)"
JOSB=/tmp/osb.txt
L=$(curl -s -c $JOSB -w "|%{http_code}" -X POST $BASE/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"owner-M01231331@m01.demo","password":"Preone@123"}')
echo "  tenantB owner login: HTTP $(echo "$L" | jq 'd.split("|")[1]') success=$(echo "${L%|*}" | jq 'r.success')"
TEN_B="0e29240e-a44f-46f4-8bfd-bd5f1018ddf4"
BR_B=$(node scripts/dbq.mjs branchOf "$TEN_B" | jq 'r[0].id')
STUS_B=$(node scripts/dbq.mjs tenantStudents "$TEN_B" ACTIVE | jq 'r.map(x=>x.id).join(" ")')
STU_B1=${STUS_B%% *}; STU_B2=${STUS_B##* }
echo "  branch=$BR_B students=[$STU_B1,$STU_B2]"
OVER=0; DETAILS=""
for i in 1 2 3 4 5 6; do
  CR=$(curl -s -b $JOSB -X POST $BASE/api/v1/classrooms -H 'Content-Type: application/json' \
    -d "{\"name\":\"RACE-$i\",\"programType\":\"PLAYGROUP\",\"capacity\":1,\"branchId\":\"$BR_B\"}" | jq 'r.data.id')
  if [ "$CR" == "JQERR" ] || [ -z "$CR" ] || [ "$CR" == "undefined" ]; then echo "  round $i: classroom create failed"; continue; fi
  curl -s -b $JOSB -X POST $BASE/api/v1/students/$STU_B1/allocate -H 'Content-Type: application/json' -d "{\"classroomId\":\"$CR\"}" -o /tmp/r1.json &
  curl -s -b $JOSB -X POST $BASE/api/v1/students/$STU_B2/allocate -H 'Content-Type: application/json' -d "{\"classroomId\":\"$CR\"}" -o /tmp/r2.json &
  wait
  ACT=$(node scripts/dbq.mjs activeAllocCount "$CR" ACTIVE | jq 'r[0].n')
  E1=$(grep -o '"success":\(true\|false\)' /tmp/r1.json | head -1); E2=$(grep -o '"success":\(true\|false\)' /tmp/r2.json | head -1)
  echo "  round $i → allocate1=$E1 allocate2=$E2 → ACTIVE rows in cap-1 classroom = $ACT"
  if [ "${ACT:-0}" -ge 2 ]; then OVER=$((OVER+1)); DETAILS="$DETAILS R$i(CR=$CR)"; fi
done
[ "$OVER" -gt 0 ] && res Y "TOCTOU overbooking reproduced in $OVER/6 rounds:$DETAILS" || res N "race not reproduced live (structural count-then-insert risk confirmed in code; window < scheduling granularity)"

note "SUMMARY v3"
echo "  CONFIRMED: $PASS   REFUTED: $FAIL"
