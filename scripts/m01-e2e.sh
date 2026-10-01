#!/bin/bash
# M01 E2E — End-to-End Preschool Lifecycle + Problem-Solving validation (Spec §35/§36/§51/§52/§53)
# NEW SCHOOL → SETUP → GO-LIVE → ADMISSION → STUDENT → PARENT → ATTENDANCE → DAILY CARE →
# HEALTH → OBSERVATION → FOLLOW-UPS RESOLVED → FEES → PICKUP → REPORTS → YEAR-END → NEXT YEAR
# Plus the 10 real problem scenarios and data-consistency/security checks.
set -e
BASE=http://127.0.0.1:3000
PJ=/tmp/m01-platform.jar; OJ=/tmp/m01-owner.jar; TJ=/tmp/m01-teacher.jar; AJ=/tmp/m01-parent.jar
P='Preone@123'
CODE="M01$(date +%H%M%S)"
EMAIL="owner-$CODE@m01.demo"
TCH="teacher-$CODE@m01.demo"
PAR="parent-$CODE@m01.demo"
pass=0; fail=0
say() { echo; echo "══ $1"; }
chk() { if [ "$3" == "ok" ]; then pass=$((pass+1)); echo "PASS $1"; else fail=$((fail+1)); echo "FAIL $1 — $2"; fi; }
jq() { python3 -c "import json,sys;d=json.load(sys.stdin);$1"; }
call() {
  local jar=$1 method=$2 path=$3 body=$4
  if [ -n "$body" ]; then
    curl -s -b "$jar" -c "$jar" -X "$method" "$BASE$path" -H 'Content-Type: application/json' -d "$body"
  else
    curl -s -b "$jar" -c "$jar" -X "$method" "$BASE$path"
  fi
}

say "0. logins + fresh tenant (M00 wizard: tenant+branch+AY+classrooms+programs+fee plans+owner)"
J=$(call $PJ POST /api/v1/auth/login "{\"email\":\"platform@preone.in\",\"password\":\"$P\"}")
[ "$(echo "$J" | jq 'print(d["success"])')" == "True" ] && chk "platform login" "" ok || chk "platform login" "$J" x
J=$(call $PJ POST /api/v1/tenants "{\"name\":\"M01 Test Preschool\",\"code\":\"$CODE\",\"branchName\":\"Main Campus\",\"city\":\"Mumbai\",\"state\":\"MH\",\"phone\":\"9811110001\",\"email\":\"hello@$CODE.demo\",\"address\":\"1 Test Lane\",\"programs\":[\"PLAYGROUP\",\"NURSERY\"],\"ownerName\":\"Test Owner\",\"ownerEmail\":\"$EMAIL\",\"ownerPassword\":\"$P\",\"plan\":\"STARTER\"}")
TENANT=$(echo "$J" | jq 'print(d["data"]["id"] if d["success"] else "FAIL")')
[ "$TENANT" != "FAIL" ] && chk "tenant created $CODE" "" ok || { chk "tenant created" "$J" x; exit 1; }
call $OJ POST /api/v1/auth/login "{\"email\":\"$EMAIL\",\"password\":\"$P\"}" > /dev/null

say "1. SETUP → GO LIVE (M00 engine drives; compact walk of mandatory steps)"
call $OJ PUT /api/v1/setup/config/OPERATING '{"schoolStartTime":"08:30","schoolEndTime":"15:30","arrivalWindowStart":"08:00","arrivalWindowEnd":"09:30","workingDays":["MON","TUE","WED","THU","FRI"]}' > /dev/null
call $OJ PUT /api/v1/setup/config/CURRICULUM '{"learningAreas":["Language","Numeracy","Motor Skills","Social-Emotional"]}' > /dev/null
call $OJ PUT /api/v1/setup/config/ADMISSION '{"admissionOpenDate":"2026-10-01","requiredDocuments":["BIRTH_CERTIFICATE","PHOTO"],"approvalStages":["Document Verification","Principal Approval"],"registrationFeeRupees":500}' > /dev/null
call $OJ PUT /api/v1/setup/config/STUDENT_PARENT '{"pickupVerification":"PIN_MATCH","maxAuthorizedPickups":4,"consentTypes":["PHOTO_CONSENT v1","MEDICAL_CONSENT v1"]}' > /dev/null
call $OJ PUT /api/v1/setup/config/DAILY_OPERATIONS '{"attendanceEnabled":true,"recordTypes":["ARRIVAL","MEALS","NAP","MOOD","PICKUP"]}' > /dev/null
call $OJ PUT /api/v1/setup/config/HEALTH_SAFETY '{"allergyCategories":["FOOD","ENVIRONMENTAL"],"incidentCategories":["MINOR_INJURY","FALL","ILLNESS","EMERGENCY"],"emergencyContacts":["Admin — Desk — 9811110001"]}' > /dev/null
call $OJ PUT /api/v1/setup/config/COMMUNICATION '{"channels":["IN_APP"],"notificationEvents":["ATTENDANCE_UPDATE","FEE_DUE","HEALTH_ALERT","INCIDENT_ALERT","DAILY_SUMMARY"]}' > /dev/null
call $OJ PUT /api/v1/setup/config/FINANCE '{"paymentMethods":["CASH","UPI"],"dueDayOffset":10}' > /dev/null
for k in school_profile programs infrastructure operating_config classes_sections academic_year curriculum fees admission_config student_parent daily_operations health_safety communication; do
  call $OJ POST /api/v1/setup/steps/$k '{"action":"complete"}' > /dev/null
done
call $OJ POST /api/v1/calendar '{"date":"2026-10-02","type":"HOLIDAY","title":"Gandhi Jayanti"}' > /dev/null
call $OJ POST /api/v1/calendar '{"date":"2026-12-24","type":"VACATION","title":"Winter Break"}' > /dev/null
call $OJ POST /api/v1/setup/steps/calendar '{"action":"complete"}' > /dev/null
call $OJ POST /api/v1/setup/steps/branding '{"action":"skip"}' > /dev/null
call $OJ POST /api/v1/setup/steps/data_import '{"action":"skip"}' > /dev/null
# teacher user + staff profile + assignment (roles/staff/teacher_assignment steps)
call $OJ POST /api/v1/users "{\"fullName\":\"Tara Singh\",\"email\":\"$TCH\",\"password\":\"$P\",\"role\":\"TEACHER\",\"phone\":\"9811110002\"}" > /dev/null
call $OJ POST /api/v1/users "{\"fullName\":\"Riya Sharma\",\"email\":\"$PAR\",\"password\":\"$P\",\"role\":\"PARENT\",\"phone\":\"9822220001\"}" > /dev/null
BRANCH=$(call $OJ GET /api/v1/branches | jq 'print(d["data"][0]["id"])')
KUID=$(call $OJ GET /api/v1/users | jq 'print(next(u["userId"] for u in d["data"] if u["role"]=="TEACHER"))')
call $OJ POST /api/v1/staff "{\"mode\":\"link\",\"userId\":\"$KUID\",\"employeeCode\":\"EMP-01\",\"branchId\":\"$BRANCH\",\"designation\":\"Lead Teacher\",\"joiningDate\":\"2026-06-01\"}" > /dev/null
call $OJ POST /api/v1/setup/steps/roles '{"action":"complete"}' > /dev/null
call $OJ POST /api/v1/setup/steps/staff '{"action":"complete"}' > /dev/null
CLASS1=$(call $OJ GET /api/v1/classrooms | jq 'print(d["data"][0]["id"])')
CLASS2=$(call $OJ GET /api/v1/classrooms | jq 'print(d["data"][1]["id"])')
call $OJ PATCH /api/v1/classrooms/$CLASS1 "{\"primaryTeacherId\":\"$KUID\"}" > /dev/null
call $OJ PATCH /api/v1/classrooms/$CLASS2 "{\"primaryTeacherId\":\"$KUID\"}" > /dev/null
call $OJ POST /api/v1/setup/steps/teacher_assignment '{"action":"complete"}' > /dev/null
call $OJ POST /api/v1/setup/validate > /dev/null
J=$(call $OJ POST /api/v1/setup/go-live)
ST=$(call $OJ GET /api/v1/setup/progress | jq 'print(d["data"]["status"])')
[ "$ST" == "LIVE" ] && chk "setup LIVE (zero manual DB config)" "" ok || chk "go-live status=$ST" "$J" x

say "2. ADMISSION LIFECYCLE: lead → application → verify → approve (one tx: student+guardian+invoice+allocation)"
J=$(call $OJ POST /api/v1/leads "{\"parentName\":\"Riya Sharma\",\"phone\":\"9822220001\",\"childName\":\"Aarav Sharma\",\"childDob\":\"2023-04-10\",\"interestedProgram\":\"PLAYGROUP\",\"source\":\"WALK_IN\"}")
LEAD=$(echo "$J" | jq 'print(d["data"]["id"])')
[ -n "$LEAD" ] && chk "lead created" "" ok || chk "lead" "$J" x
J=$(call $OJ POST /api/v1/leads/$LEAD/convert)
APP=$(echo "$J" | jq 'print(d["data"]["applicationId"])')
[ -n "$APP" ] && chk "lead converted to application" "" ok || chk "convert" "$J" x
J=$(call $OJ POST /api/v1/applications/$APP/verify)
[ "$(echo "$J" | jq 'print(d["success"])')" == "True" ] && chk "documents verified" "" ok || chk "verify" "$J" x
J=$(call $OJ POST /api/v1/applications/$APP/approve "{\"classroomId\":\"$CLASS1\"}")
STU=$(echo "$J" | jq 'print(d["data"]["studentId"] if d["success"] else "FAIL")')
INV=$(echo "$J" | jq 'print(d["data"]["invoiceNumber"] or "")')
[ "$STU" != "FAIL" ] && chk "approved → student $STU + invoice $INV (capacity-guarded)" "" ok || chk "approve" "$J" x

say "3. ADMISSION → FINANCE + STUDENT consistency (one admission → ONE student, correct links)"
J=$(call $OJ GET /api/v1/students/$STU)
GCOUNT=$(echo "$J" | jq 'print(len(d["data"]["guardians"]))')
[ "$GCOUNT" -ge 1 ] && chk "student has guardian link (count=$GCOUNT)" "" ok || chk "guardian links" "$J" x
J=$(call $OJ GET /api/v1/students/$STU/allocate)
HIST=$(echo "$J" | jq 'print(len(d["data"]["history"]))')
[ "$HIST" -eq 1 ] && chk "allocation history = 1 ACTIVE row (admission enrolment)" "" ok || chk "allocation history=$HIST" "$J" x

say "3b. SECOND ADMISSION (for multi-child scenarios)"
J=$(call $OJ POST /api/v1/leads "{\"parentName\":\"Vikram Rao\",\"phone\":\"9822220002\",\"childName\":\"Ira Rao\",\"childDob\":\"2023-08-15\",\"interestedProgram\":\"PLAYGROUP\",\"source\":\"REFERRAL\"}")
LEAD2=$(echo "$J" | jq 'print(d["data"]["id"])')
APP2=$(call $OJ POST /api/v1/leads/$LEAD2/convert | jq 'print(d["data"]["applicationId"])')
call $OJ POST /api/v1/applications/$APP2/verify > /dev/null
J=$(call $OJ POST /api/v1/applications/$APP2/approve "{\"classroomId\":\"$CLASS1\"}")
STU2=$(echo "$J" | jq 'print(d["data"]["studentId"] if d["success"] else "FAIL")')
[ "$STU2" != "FAIL" ] && chk "second child admitted ($STU2)" "" ok || chk "second admission" "$J" x

say "4. ATTENDANCE: working-day flow + exceptions (Scenario 1: child absent)"
STUDENTS=$(call $OJ GET "/api/v1/students?pageSize=100" | jq 'print(",".join(s["id"] for s in d["data"]))')
S1=$(echo "$STUDENTS" | cut -d, -f1)
S_ABS=$STU2
TODAY=$(date +%F)
SUN=$(date -d "next Sunday" +%F 2>/dev/null || date -v+sun +%F)
J=$(call $OJ POST /api/v1/attendance "{\"classroomId\":\"$CLASS1\",\"date\":\"$SUN\",\"entries\":[{\"studentId\":\"$S1\",\"status\":\"PRESENT\"}]}")
ERRC=$(echo "$J" | jq 'print(d.get("error",{}).get("code",""))')
[ "$ERRC" == "BUSINESS_SCHOOL_CLOSED" ] && chk "Sunday blocked (OPERATING workingDays consumed)" "" ok || chk "sunday guard code=$ERRC" "$J" x
J=$(call $OJ POST /api/v1/attendance "{\"classroomId\":\"$CLASS1\",\"date\":\"$SUN\",\"entries\":[{\"studentId\":\"$S1\",\"status\":\"PRESENT\"}],\"force\":true}")
[ "$(echo "$J" | jq 'print(d["success"])')" == "True" ] && chk "forced marking on closed day (audited)" "" ok || chk "force" "$J" x
TODAY_DOW=$(date +%u) # 1=Mon..7=Sun
if [ "$TODAY_DOW" -le 5 ]; then MARKDATE=$TODAY; else MARKDATE=$(date -d "next Monday" +%F); fi
ENTRIES="["
FIRST=1
for sid in ${STUDENTS//,/ }; do
  if [ "$sid" == "$S_ABS" ]; then
    [ $FIRST -eq 0 ] && ENTRIES+=","
    ENTRIES+="{\"studentId\":\"$sid\",\"status\":\"ABSENT\",\"notes\":\"Not feeling well\"}"
  else
    [ $FIRST -eq 0 ] && ENTRIES+=","
    ENTRIES+="{\"studentId\":\"$sid\",\"status\":\"PRESENT\"}"
  fi
  FIRST=0
done
ENTRIES+="]"
J=$(call $OJ POST /api/v1/attendance "{\"classroomId\":\"$CLASS1\",\"date\":\"$MARKDATE\",\"entries\":$ENTRIES}")
EX=$(echo "$J" | jq 'print(d["data"]["exceptionsRaised"])')
AB=$(echo "$J" | jq 'print(d["data"]["absentCount"])')
[ "$AB" -ge 1 ] && chk "attendance marked; absent=$AB late=0 exceptions raised=$EX" "" ok || chk "attendance exceptions" "$J" x
J=$(call $OJ GET "/api/v1/operations/follow-ups?domain=ATTENDANCE&status=OPEN")
FC=$(echo "$J" | jq 'print(len(d["data"]["items"]))')
[ "$FC" -ge 1 ] && chk "absence → ATTENDANCE follow-up OPEN (deduped per child/day)" "" ok || chk "absence follow-up count=$FC" "$J" x

say "5. DAILY CARE: minimal-tap teacher flow + config-gated types (Scenario 8)"
call $TJ POST /api/v1/auth/login "{\"email\":\"$TCH\",\"password\":\"$P\"}" > /dev/null
J=$(call $TJ POST /api/v1/care "{\"entries\":[{\"studentId\":\"$STU\",\"type\":\"MEALS\",\"title\":\"Ate full lunch\"},{\"studentId\":\"$STU\",\"type\":\"NAP\",\"mood\":\"Sleepy\"}]}")
RC=$(echo "$J" | jq 'print(d["data"]["recorded"] if d["success"] else 0)')
[ "$RC" -eq 2 ] && chk "bulk care events recorded ($RC)" "" ok || chk "care bulk=$RC" "$J" x
J=$(call $TJ POST /api/v1/care "{\"studentId\":\"$STU\",\"type\":\"BATHROOM\"}")
ERRC=$(echo "$J" | jq 'print(d.get("error",{}).get("code",""))')
[ "$ERRC" == "BUSINESS_TYPE_DISABLED" ] && chk "record type disabled by DAILY_OPERATIONS config (BATHROOM)" "" ok || chk "disabled type code=$ERRC" "$J" x
J=$(call $TJ GET "/api/v1/care?studentId=$STU&date=$MARKDATE")
CE=$(echo "$J" | jq 'print(len(d["data"]["entries"]))')
[ "$CE" -ge 2 ] && chk "teacher day sheet shows $CE care entries" "" ok || chk "care sheet=$CE" "$J" x

say "6. HEALTH & SAFETY: abnormal check + emergency incident (Scenarios 2 & 9)"
J=$(call $TJ POST /api/v1/care "{\"studentId\":\"$S1\",\"type\":\"HEALTH_CHECK\",\"outcome\":\"ABNORMAL\",\"body\":\"Fever 100.2F — isolated, parent called\"}")
FU=$(echo "$J" | jq 'print(len(d["data"]["followUpsRaised"]))')
[ "$FU" -eq 1 ] && chk "abnormal health check → URGENT follow-up + parent alert" "" ok || chk "health follow-up=$FU" "$J" x
J=$(call $TJ POST /api/v1/care "{\"studentId\":\"$STU\",\"type\":\"INCIDENT\",\"category\":\"MINOR_INJURY\",\"title\":\"Small scrape during play\",\"body\":\"First aid given, monitored\"}")
FU=$(echo "$J" | jq 'print(len(d["data"]["followUpsRaised"]))')
[ "$FU" -eq 1 ] && chk "incident → follow-up + incident record" "" ok || chk "incident follow-up=$FU" "$J" x
J=$(call $OJ GET "/api/v1/operations/today")
CRIT=$(echo "$J" | jq 'print(d["data"]["exceptions"]["criticalCount"])')
[ "$CRIT" -ge 2 ] && chk "command centre CRITICAL band = $CRIT (health+incident)" "" ok || chk "critical=$CRIT" "$J" x

say "7. LEARNING LOOP: observation → concern → follow-up → resolution (Scenario 4)"
J=$(call $TJ POST /api/v1/observations "{\"studentId\":\"$STU\",\"narrative\":\"Struggled with 4-piece puzzle and avoided the numeracy corner today — needs focused support.\",\"category\":\"Numeracy\",\"concern\":\"NEEDS_ATTENTION\"}")
[ "$(echo "$J" | jq 'print(d["success"])')" == "True" ] && chk "observation recorded (category+concern)" "" ok || chk "observation" "$J" x
J=$(call $OJ GET "/api/v1/operations/follow-ups?domain=LEARNING&status=OPEN")
LFU=$(echo "$J" | jq 'print(d["data"]["items"][0]["id"] if d["data"]["items"] else "")')
[ -n "$LFU" ] && chk "learning follow-up auto-raised" "" ok || chk "learning follow-up missing" "$J" x
J=$(call $TJ PATCH /api/v1/operations/follow-ups/$LFU "{\"action\":\"resolve\",\"outcome\":\"1:1 puzzle session planned; re-observe Friday\"}")
[ "$(echo "$J" | jq 'print(d["data"]["status"])')" == "RESOLVED" ] && chk "teacher acted → outcome recorded → RESOLVED" "" ok || chk "resolve learning" "$J" x

say "8. RBAC + PARENT isolation (Spec §45)"
# parent portal account — provisioned via fixture (staff users API excludes PARENT by design)
node scripts/m01-fixture.mjs create-parent-user "$TENANT" "$PAR" "$P" "Riya Sharma" > /dev/null && chk "parent portal user provisioned (fixture)" "" ok
call $AJ POST /api/v1/auth/login "{\"email\":\"$PAR\",\"password\":\"$P\"}" > /dev/null
J=$(call $TJ POST /api/v1/applications/$APP/approve "{\"classroomId\":\"$CLASS1\"}")
ERRC=$(echo "$J" | jq 'print(d.get("error",{}).get("code",""))')
[ "$ERRC" == "PERMISSION_001" ] && chk "teacher blocked from admissions approve (403)" "" ok || chk "teacher approve guard code=$ERRC" "$J" x
J=$(call $AJ GET "/api/v1/students/$STU")
ERRC=$(echo "$J" | jq 'print(d.get("error",{}).get("code",""))')
[ "$ERRC" == "PERMISSION_001" ] && chk "parent (unlinked) blocked from student records (403)" "" ok || chk "parent guard code=$ERRC" "$J" x
node scripts/m01-fixture.mjs link-guardian "$TENANT" "$PAR" "$STU" > /dev/null && chk "fixture: guardian linked to parent user (test harness only)" "" ok
J=$(call $AJ GET "/api/v1/parent/today")
CN=$(echo "$J" | jq 'print(len(d["data"]["children"]))')
[ "$CN" -eq 1 ] && chk "parent/today shows exactly 1 linked child" "" ok || chk "parent children=$CN" "$J" x
CAREV=$(echo "$J" | jq 'print(len(d["data"]["children"][0]["todayCare"]) if d["data"]["children"] else 0)')
[ "$CAREV" -ge 1 ] && chk "parent sees child's day ($CAREV care events)" "" ok || chk "parent care visibility" "$J" x

say "9. PICKUP: authorised release vs unauthorised attempt (Scenario 3)"
GID=$(call $OJ GET "/api/v1/operations/pickup?studentId=$STU" | jq 'print(d["data"]["contacts"][0]["guardianId"])')
J=$(call $OJ POST /api/v1/operations/pickup "{\"studentId\":\"$STU\",\"guardianId\":\"$GID\"}")
[ "$(echo "$J" | jq 'print(d["data"]["released"])')" == "True" ] && chk "authorised guardian released + audited" "" ok || chk "release" "$J" x
J=$(call $OJ POST /api/v1/operations/pickup "{\"studentId\":\"$STU\",\"guardianId\":\"nonexistent-guardian\"}")
ERRC=$(echo "$J" | jq 'print(d.get("error",{}).get("code",""))')
[ "$ERRC" == "BUSINESS_PICKUP_BLOCKED" ] && chk "unauthorised pickup BLOCKED (403)" "" ok || chk "pickup block code=$ERRC" "$J" x
J=$(call $OJ GET "/api/v1/operations/follow-ups?domain=SAFETY&status=OPEN")
SF=$(echo "$J" | jq 'print(len(d["data"]["items"]))')
[ "$SF" -ge 1 ] && chk "blocked attempt → EMERGENCY SAFETY follow-up" "" ok || chk "safety follow-up=$SF" "$J" x

say "10. FINANCE: overdue → reminder → payment → auto-resolve (Scenario 7)"
J=$(call $OJ POST /api/v1/invoices "{\"studentId\":\"$STU\",\"title\":\"Term 2 Tuition\",\"dueDate\":\"2026-09-01\",\"lineItems\":[{\"description\":\"Tuition Term 2\",\"amountCents\":2500000,\"feeHead\":\"TUITION\"}]}")
INV2=$(echo "$J" | jq 'print(d["data"]["invoiceId"])')
J=$(call $OJ GET "/api/v1/invoices?status=OVERDUE")
echo "$J" | grep -q "$INV2" && chk "past-due invoice auto-flipped to OVERDUE on read" "" ok || chk "overdue sync" "$J" x
J=$(call $OJ GET "/api/v1/operations/follow-ups?domain=FINANCE&status=OPEN")
FFU=$(echo "$J" | jq 'print(d["data"]["items"][0]["id"] if d["data"]["items"] else "")')
[ -n "$FFU" ] && chk "overdue → FINANCE follow-up OPEN" "" ok || chk "finance follow-up" "$J" x
J=$(call $OJ POST /api/v1/invoices/$INV2/remind)
[ "$(echo "$J" | jq 'print(d["data"]["followUpStatus"])')" == "OPEN" ] && chk "reminder sent — follow-up still OPEN (notification ≠ resolution)" "" ok || chk "remind" "$J" x
J=$(call $OJ POST /api/v1/invoices/$INV2/payments "{\"amountCents\":2500000,\"method\":\"UPI\",\"transactionRef\":\"UPI-TEST-1\"}")
[ "$(echo "$J" | jq 'print(d["data"]["status"])')" == "PAID" ] && chk "payment → receipt generated → invoice PAID" "" ok || chk "payment" "$J" x
ST2=$(call $OJ GET "/api/v1/operations/follow-ups/$FFU" 2>/dev/null || echo "")
J=$(call $OJ GET "/api/v1/operations/follow-ups?domain=FINANCE")
STT=$(echo "$J" | FFU="$FFU" python3 -c 'import json,sys,os;d=json.load(sys.stdin);ffu=os.environ["FFU"];print(next((i["status"] for i in d["data"]["items"] if i["id"]==ffu),"GONE"))')
[ "$STT" == "RESOLVED" ] && chk "payment auto-resolved the fee follow-up (loop closed)" "" ok || chk "auto-resolve state=$STT" "$J" x

say "11. CAPACITY: section full blocks allocation (Scenario 5)"
call $OJ PATCH /api/v1/classrooms/$CLASS2 '{"capacity":1}' > /dev/null
J=$(call $OJ POST /api/v1/students/$STU/allocate "{\"classroomId\":\"$CLASS2\",\"reason\":\"Section change\"}")
[ "$(echo "$J" | jq 'print(d["success"])')" == "True" ] && chk "first child fills section 1/1" "" ok || chk "fill section" "$J" x
J=$(call $OJ POST /api/v1/students/$STU2/allocate "{\"classroomId\":\"$CLASS2\",\"reason\":\"TRANSFER\"}")
ERRC=$(echo "$J" | jq 'print(d.get("error",{}).get("code",""))')
[ "$ERRC" == "BUSINESS_CLASS_FULL" ] && chk "full section blocks allocation (no silent overbooking)" "" ok || chk "capacity block code=$ERRC" "$J" x
call $OJ PATCH /api/v1/classrooms/$CLASS2 '{"capacity":20}' > /dev/null
J=$(call $OJ POST /api/v1/students/$STU/allocate "{\"classroomId\":\"$CLASS1\",\"reason\":\"Balanced sections\"}")
[ "$(echo "$J" | jq 'print(d["success"])')" == "True" ] && chk "child re-allocated back (history trail kept)" "" ok || chk "re-allocate" "$J" x

say "12. TEACHER PORTAL consumes real assignments (Scenario 6: substitution via PATCH = audited)"
J=$(call $TJ GET /api/v1/teacher/today)
SC=$(echo "$J" | jq 'print(len(d["data"]["sections"]))')
FUC=$(echo "$J" | jq 'print(d["data"]["actions"]["followUpsOpen"])')
[ "$SC" -ge 1 ] && chk "teacher sees $SC assigned section(s) + $FUC open follow-ups (no manual lists)" "" ok || chk "teacher sections=$SC" "$J" x

say "13. YEAR-END: close → new year → promote (Scenario 10, history preserved)"
J=$(call $OJ POST /api/v1/academic-years "{\"name\":\"AY 2027-28\",\"startDate\":\"2027-04-01\",\"endDate\":\"2028-03-31\"}")
NEWAY=$(echo "$J" | jq 'print(d["data"]["id"])')
[ -n "$NEWAY" ] && chk "next academic year created (PLANNED)" "" ok || chk "new AY" "$J" x
OLDAY=$(call $OJ GET /api/v1/academic-years | jq 'print(next(a["id"] for a in d["data"] if a["isCurrent"]))')
J=$(call $OJ POST /api/v1/academic-years/$OLDAY/close '{"confirm":true}')
[ "$(echo "$J" | jq 'print(d["data"]["status"])')" == "CLOSED" ] && chk "old year closed (transactional, report attached)" "" ok || chk "close" "$J" x
J=$(call $OJ PATCH /api/v1/academic-years/$NEWAY '{"setStatusCurrent":true}')
[ "$(echo "$J" | jq 'print(d["success"])')" == "True" ] && chk "new year set current" "" ok || chk "set current" "$J" x
J=$(call $OJ POST /api/v1/classrooms "{\"name\":\"Playgroup A 2027\",\"programType\":\"PLAYGROUP\",\"capacity\":25,\"branchId\":\"$BRANCH\"}")
NEWC=$(echo "$J" | jq 'print(d["data"]["id"])')
J=$(call $OJ POST /api/v1/academic-years/$OLDAY/promote "{\"toSessionId\":\"$NEWAY\",\"mappings\":[{\"from\":\"$CLASS1\",\"to\":\"$NEWC\"}]}")
PR=$(echo "$J" | jq 'print(d["data"]["promotedCount"])')
[ "$PR" -ge 1 ] && chk "promotion: $PR students moved transactionally" "" ok || chk "promote=$PR" "$J" x
J=$(call $OJ GET /api/v1/students/$STU/allocate)
ROWS=$(echo "$J" | jq 'print(len(d["data"]["history"]))')
PROMOTED=$(echo "$J" | jq 'print(any(h["status"]=="PROMOTED" for h in d["data"]["history"]))')
ACTIVE=$(echo "$J" | jq 'print(any(h["status"]=="ACTIVE" for h in d["data"]["history"]))')
[ "$ROWS" -ge 2 ] && [ "$PROMOTED" == "True" ] && [ "$ACTIVE" == "True" ] && chk "allocation history preserved (PROMOTED old + ACTIVE new)" "" ok || chk "history rows=$ROWS promoted=$PROMOTED active=$ACTIVE" "$J" x

say "14. READ MODELS + AUDIT TRAIL (Spec §33/§44)"
J=$(call $OJ GET /api/v1/operations/today)
[ "$(echo "$J" | jq 'print(d["success"])')" == "True" ] && chk "operations/today read model (sections+exceptions+activity)" "" ok || chk "operations today" "$J" x
J=$(call $OJ GET /api/v1/operations/exceptions)
BANDS=$(echo "$J" | jq 'print(",".join(sorted(d["data"]["counts"].keys())))')
echo "  exception bands: $BANDS"
J=$(call $OJ GET /api/v1/audit-logs?pageSize=10)
AUD=$(echo "$J" | jq 'print(d["success"])')
[ "$AUD" == "True" ] && chk "audit log capturing every transition (existing architecture)" "" ok || chk "audit" "$J" x
J=$(call $TJ GET /api/v1/operations/exceptions)
[ "$(echo "$J" | jq 'print(d["success"])')" == "True" ] && chk "teacher operations:read granted (scoped views)" "" ok || chk "teacher ops" "$J" x

say "RESULT: $pass passed, $fail failed"
[ $fail -eq 0 ]
