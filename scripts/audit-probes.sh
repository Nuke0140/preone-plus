#!/usr/bin/env bash
# ============================================================
# M01 AUDIT — LIVE SECURITY PROBES (v2, fixed fixtures)
# Mutations confined to TEST tenants (M01*).
# ============================================================
set -u
BASE="http://127.0.0.1:3000"
PASS=0; FAIL=0
note() { echo; echo "── $1 ─────────────────────────────────────────"; }
res()  { if [ "$1" == "Y" ]; then PASS=$((PASS+1)); echo "  ⇒ CONFIRMED: $2"; else FAIL=$((FAIL+1)); echo "  ⇒ REFUTED:  $2"; fi; }
jq()   { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const r=JSON.parse(d);console.log(eval(process.argv[1]))}catch(e){console.log('JQERR')}})" "$1"; }

TEN_B="0e29240e-a44f-46f4-8bfd-bd5f1018ddf4"             # M01231331 (test tenant, 2 students, 2 ISSUED invoices)
FOREIGN_STUDENT="c3087d03-c17a-41f8-9d1a-615c77727598"   # Aarav Sharma @ M01230515 (different tenant)

note "P2 — logins (sunshine owner + sunshine parent) + fixture facts"
JOS=/tmp/osun.txt; JPAR=/tmp/par.txt
L1=$(curl -s -c $JOS -w "|%{http_code}" -X POST $BASE/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"owner@sunshine.demo","password":"Preone@123"}')
L2=$(curl -s -c $JPAR -w "|%{http_code}" -X POST $BASE/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"parent@sunshine.demo","password":"Preone@123"}')
echo "  owner login  → $(echo "$L1" | jq 'd.split("|")[1]')  success=$(echo "${L1%|*}" | jq 'r.success')"
echo "  parent login → $(echo "$L2" | jq 'd.split("|")[1]')  success=$(echo "${L2%|*}" | jq 'r.success')"
INV_B=$(node scripts/dbq.mjs issuedInvoice "$TEN_B" ISSUED | jq 'r[0].id')
LEAD_B=$(node scripts/dbq.mjs tenantLead "$TEN_B" | jq 'r[0].id')
STUS_B=$(node scripts/dbq.mjs tenantStudents "$TEN_B" ACTIVE | jq 'r.map(x=>x.id).join(" ")')
STU_B1=${STUS_B%% *}; STU_B2=${STUS_B##* }
BR_B=$(node scripts/dbq.mjs branchOf "$TEN_B" | jq 'r[0].id')
echo "  tenantB=$TEN_B
  invoice=$INV_B lead=$LEAD_B branch=$BR_B
  students=[$STU_B1, $STU_B2]"

note "P3 — CROSS-TENANT READ (re-verify): sunshine owner reads M01-tenant student"
J=$(curl -s -b $JOS $BASE/api/v1/students/$FOREIGN_STUDENT)
echo "$J" | head -c 160; echo
echo "$J" | grep -q '"success":true' && res Y "IDOR-read: cross-tenant student profile served" || res N "cross-tenant student read blocked"

note "P4 — CROSS-TENANT WRITE: sunshine owner PATCHes M01-tenant lead"
J=$(curl -s -b $JOS -X PATCH $BASE/api/v1/leads/$LEAD_B -H 'Content-Type: application/json' -d '{"notes":"AUDIT-PROBE-P4"}')
echo "$J" | head -c 160; echo
echo "$J" | grep -q '"success":true' && res Y "IDOR-write: cross-tenant lead mutated" || res N "cross-tenant lead write blocked"

note "P5 — CROSS-TENANT MONEY: sunshine owner pays M01-tenant invoice (₹1 via UPI)"
J=$(curl -s -b $JOS -X POST $BASE/api/v1/invoices/$INV_B/payments -H 'Content-Type: application/json' \
  -d '{"amountCents":100,"method":"UPI","transactionRef":"AUDIT-PROBE-P5","notes":"audit probe"}')
echo "$J" | head -c 200; echo
echo "$J" | grep -q '"success":true' && res Y "IDOR-money: cross-tenant payment recorded" || res N "cross-tenant payment blocked"

note "P6 — PAYMENT IDEMPOTENCY: exact retry of P5 (same transactionRef)"
J=$(curl -s -b $JOS -X POST $BASE/api/v1/invoices/$INV_B/payments -H 'Content-Type: application/json' \
  -d '{"amountCents":100,"method":"UPI","transactionRef":"AUDIT-PROBE-P5","notes":"audit probe RETRY"}')
echo "$J" | head -c 200; echo
N=$(node scripts/dbq.mjs payRefCount "AUDIT-PROBE-P5" | jq 'r[0].n')
echo "  payment rows carrying ref AUDIT-PROBE-P5 = $N"
[ "${N:-0}" -ge 2 ] && res Y "NO idempotency: one retry produced $N payment rows" || res N "retry deduplicated ($N rows)"

note "P7 — PARENT LEDGER LEAK: parent GET /api/v1/invoices vs own-child invoices"
CNT=$(curl -s -b $JPAR "$BASE/api/v1/invoices?pageSize=100" | jq 'r.data.length')
OWN=$(node scripts/dbq.mjs ownChildInvCount "parent@sunshine.demo" | jq 'r[0].n')
echo "  API returned $CNT invoices; own-child invoices in DB = $OWN"
[ "${CNT:-0}" -gt "${OWN:-0}" ] && res Y "parent sees $CNT tenant-wide invoices vs $OWN own-child (cross-child finance leak)" || res N "parent invoice list scoped ($CNT vs $OWN)"

note "P8 — PARENT SSR PAGE: GET /app/students/{non-child student} (server-rendered, no API)"
NONCHILD=$(node scripts/dbq.mjs nonChildStudent "951b5049-83de-452f-97d6-37fb632c01de" "parent@sunshine.demo" | jq 'r[0].id')
echo "  non-child student id = $NONCHILD"
CODE=$(curl -s -b $JPAR -o /tmp/p8.html -w "%{http_code}" "$BASE/app/students/$NONCHILD")
HITS=$(grep -c -i "admissionNo\|Guardian\|invoice\|Attendance" /tmp/p8.html 2>/dev/null || echo 0)
echo "  HTTP $CODE, sensitive-keyword hits in HTML: $HITS"
[ "$CODE" == "200" ] && [ "$HITS" -ge 3 ] && res Y "SSR parent IDOR: full student detail page rendered (HTTP $CODE)" || res N "SSR page blocked/empty (HTTP $CODE, hits=$HITS)"

note "P9 — CAPACITY TOCTOU RACE: 5 rounds, fresh cap-1 classroom per round, 2 concurrent allocates"
OVER=0; DET=0
for i in 1 2 3 4 5; do
  CR=$(curl -s -b $JOS -X POST $BASE/api/v1/classrooms -H 'Content-Type: application/json' \
    -d "{\"name\":\"RACE-$i\",\"programType\":\"PLAYGROUP\",\"capacity\":1,\"branchId\":\"$BR_B\"}" | jq 'r.data.id')
  [ "$CR" == "JQERR" ] || [ -z "$CR" ] && { echo "  round $i: classroom create failed"; continue; }
  curl -s -b $JOS -X POST $BASE/api/v1/students/$STU_B1/allocate -H 'Content-Type: application/json' -d "{\"classroomId\":\"$CR\"}" -o /tmp/r1.json &
  curl -s -b $JOS -X POST $BASE/api/v1/students/$STU_B2/allocate -H 'Content-Type: application/json' -d "{\"classroomId\":\"$CR\"}" -o /tmp/r2.json &
  wait
  C1=$(grep -c '"success":true' /tmp/r1.json 2>/dev/null); C2=$(grep -c '"success":true' /tmp/r2.json 2>/dev/null)
  ACT=$(node scripts/dbq.mjs activeAllocCount "$CR" ACTIVE | jq 'r[0].n')
  BOTH=$(node -e "console.log((${C1:-0}+${C2:-0})>=2?1:0)")
  echo "  round $i → ok1=$C1 ok2=$C2 → ACTIVE in cap-1 classroom = $ACT  $([ "$BOTH" == 1 ] && echo '<< BOTH SUCCEEDED (overbook)')"
  [ "$BOTH" == 1 ] && OVER=$((OVER+1))
done
[ "$OVER" -gt 0 ] && res Y "TOCTOU overbooking reproduced in $OVER/5 rounds" || res N "race not reproduced in 5 rounds (window too small — structural risk remains, see code analysis)"

note "SUMMARY"
echo "  CONFIRMED findings : $PASS"
echo "  REFUTED (safe)     : $FAIL"
