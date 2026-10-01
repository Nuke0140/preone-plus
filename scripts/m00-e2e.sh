#!/bin/bash
# M00 E2E — Definition of Done test (brief §40):
# "Can a completely new preschool start from zero and become operational
#  WITHOUT an engineer manually configuring the database?"
# Walks: create tenant (platform) → configure all mandatory steps → validate → go-live.
set -e
BASE=http://127.0.0.1:3000
PJ=/tmp/m00-platform.jar; OJ=/tmp/m00-owner.jar
P='Preone@123'
CODE="E2E$(date +%H%M%S)"
EMAIL="owner-$CODE@newtown.demo"
pass=0; fail=0
say() { echo; echo "══ $1"; }
chk() { # name json success?
  if [ "$3" == "ok" ]; then pass=$((pass+1)); echo "PASS $1"
  else fail=$((fail+1)); echo "FAIL $1 — $2"; fi
}
call() {
  local jar=$1 method=$2 path=$3 body=$4
  if [ -n "$body" ]; then
    curl -s -b "$jar" -c "$jar" -X "$method" "$BASE$path" -H 'Content-Type: application/json' -d "$body"
  else
    curl -s -b "$jar" -c "$jar" -X "$method" "$BASE$path"
  fi
}

say "0. platform login"
J=$(call $PJ POST /api/v1/auth/login "{\"email\":\"platform@preone.in\",\"password\":\"$P\"}")
[ "$(echo $J | python3 -c 'import json,sys;print(json.load(sys.stdin)["success"])')" == "True" ] && chk "platform login" "$J" ok || chk "platform login" "$J" x

say "1. CREATE SCHOOL via /onboard wizard (creates tenant+branch+AY+classrooms+programs+owner+setup state)"
J=$(call $PJ POST /api/v1/tenants "{\"name\":\"Newtown Early Years\",\"code\":\"$CODE\",\"branchName\":\"Newtown Main\",\"city\":\"Pune\",\"state\":\"MH\",\"phone\":\"9800000001\",\"email\":\"hello@$CODE.demo\",\"address\":\"12 Maple Lane\",\"programs\":[\"PLAYGROUP\",\"NURSERY\"],\"ownerName\":\"Meera Iyer\",\"ownerEmail\":\"$EMAIL\",\"ownerPassword\":\"$P\",\"plan\":\"STARTER\"}")
TENANT=$(echo $J | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["data"]["id"] if d["success"] else "FAIL")')
[ "$TENANT" != "FAIL" ] && chk "tenant created ($CODE)" "$J" ok || { chk "tenant created" "$J" x; exit 1; }

say "2. owner login + setup status (lazy auto-evaluation)"
J=$(call $OJ POST /api/v1/auth/login "{\"email\":\"$EMAIL\",\"password\":\"$P\"}")
[ "$(echo $J | python3 -c 'import json,sys;print(json.load(sys.stdin)["success"])')" == "True" ] && chk "owner login" "$J" ok || chk "owner login" "$J" x
J=$(call $OJ GET /api/v1/setup/status)
STATUS=$(echo $J | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["data"]["status"])')
PROG=$(echo $J | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["data"]["progress"])')
NEXT=$(echo $J | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["data"]["nextStepKey"])')
COMPLETED=$(echo $J | python3 -c 'import json,sys;d=json.load(sys.stdin);print(",".join(s["key"] for s in d["data"]["steps"] if s["status"]=="COMPLETE"))')
case "$STATUS" in
  IN_PROGRESS|BLOCKED) chk "setup state $STATUS at ${PROG}% (auto-completed: $COMPLETED; BLOCKED = deps working)" "$J" ok ;;
  *) chk "unexpected state=$STATUS" "$J" x ;;
esac

step_complete() { # key label
  J=$(call $OJ POST /api/v1/setup/steps/$1 '{"action":"complete"}')
  OKJ=$(echo $J | python3 -c 'import json,sys;print(json.load(sys.stdin)["success"])')
  [ "$OKJ" == "True" ] && chk "step complete: $2" "$J" ok || chk "step complete: $2" "$J" x
}
step_blocked_check() { # key expected_block_message_contains
  J=$(call $OJ POST /api/v1/setup/steps/$1 '{"action":"complete"}')
  MSG=$(echo $J | python3 -c 'import json,sys;print(json.load(sys.stdin).get("error",{}).get("message",""))')
  echo "  [blocked-as-designed] $1 → $MSG"
}

say "3. dependency engine proves BLOCKED for classes_sections (needs teacher? no — needs program link via wizard: should already be COMPLETE)"
J=$(call $OJ POST /api/v1/setup/steps/academic_year false)
say "4. configure remaining steps"

# school_profile — complete (identity auto from wizard)
step_complete school_profile "School Profile"

# branding — RECOMMENDED: skip
J=$(call $OJ POST /api/v1/setup/steps/branding '{"action":"skip"}')
[ "$(echo $J | python3 -c 'import json,sys;print(json.load(sys.stdin)["success"])')" == "True" ] && chk "optional step skipped: branding" "$J" ok || chk "skip branding" "$J" x

# programs — wizard created PLAYGROUP/NURSERY programs → complete
step_complete programs "Programs"
# infrastructure — wizard classrooms → complete
step_complete infrastructure "Infrastructure"

# operating_config — PUT config then complete
J=$(call $OJ PUT /api/v1/setup/config/OPERATING '{"schoolStartTime":"08:30","schoolEndTime":"15:30","arrivalWindowStart":"08:00","arrivalWindowEnd":"09:30","workingDays":["MON","TUE","WED","THU","FRI"],"lateArrivalRule":"LATE after window"}')
[ "$(echo $J | python3 -c 'import json,sys;print(json.load(sys.stdin)["success"])')" == "True" ] && chk "config OPERATING saved" "$J" ok || chk "config OPERATING" "$J" x
step_complete operating_config "Operating Configuration"

# roles — wizard only owner → create a staff user first via /api/v1/users (users:write)
J=$(call $OJ POST /api/v1/users "{\"fullName\":\"Kavita Rao\",\"email\":\"kavita-$CODE@newtown.demo\",\"password\":\"$P\",\"role\":\"TEACHER\",\"phone\":\"9800000002\"}")
[ "$(echo $J | python3 -c 'import json,sys;print(json.load(sys.stdin)["success"])')" == "True" ] && chk "staff user invited (roles step unlock)" "$J" ok || chk "staff user invite" "$J" x
step_complete roles "Roles & Permissions"

# staff — attach staff profile to the EXISTING user (link mode) with branch assignment
J=$(call $OJ GET /api/v1/branches)
BRANCH=$(echo $J | python3 -c 'import json,sys;print(json.load(sys.stdin)["data"][0]["id"])')
J=$(call $OJ GET /api/v1/users)
KUID=$(echo $J | python3 -c 'import json,sys;d=json.load(sys.stdin);print(next(u["userId"] for u in d["data"] if u["email"].startswith("kavita-")))')
J=$(call $OJ POST /api/v1/staff "{\"mode\":\"link\",\"userId\":\"$KUID\",\"employeeCode\":\"EMP-001\",\"branchId\":\"$BRANCH\",\"designation\":\"Lead Teacher\",\"joiningDate\":\"2026-06-01\",\"employmentType\":\"REGULAR\"}")
[ "$(echo $J | python3 -c 'import json,sys;print(json.load(sys.stdin)["success"])')" == "True" ] && chk "staff profile linked w/ branch" "$J" ok || chk "staff profile" "$J" x
step_complete staff "Staff Foundation"

step_complete academic_year "Academic Year"

# curriculum
J=$(call $OJ PUT /api/v1/setup/config/CURRICULUM '{"milestoneFramework":"EYFS","learningAreas":["Language","Numeracy","Motor Skills","Social-Emotional"],"assessmentMethods":["Observation","Checklist"]}')
[ "$(echo $J | python3 -c 'import json,sys;print(json.load(sys.stdin)["success"])')" == "True" ] && chk "config CURRICULUM saved" "$J" ok || chk "config CURRICULUM" "$J" x
step_complete curriculum "Curriculum"

# calendar — event (requires operating_config ✓, academic_year ✓)
J=$(call $OJ POST /api/v1/calendar '{"date":"2026-10-02","type":"HOLIDAY","title":"Gandhi Jayanti"}')
[ "$(echo $J | python3 -c 'import json,sys;print(json.load(sys.stdin)["success"])')" == "True" ] && chk "calendar event created" "$J" ok || chk "calendar event" "$J" x
step_complete calendar "School Calendar"

# fees — wizard created plans per program → complete
step_complete fees "Fees & Finance"

# admission_config
J=$(call $OJ PUT /api/v1/setup/config/ADMISSION '{"admissionOpenDate":"2026-10-01","registrationFeeRupees":500,"requiredDocuments":["BIRTH_CERTIFICATE","PHOTO"],"approvalStages":["Document Verification","Principal Approval"]}')
[ "$(echo $J | python3 -c 'import json,sys;print(json.load(sys.stdin)["success"])')" == "True" ] && chk "config ADMISSION saved" "$J" ok || chk "config ADMISSION" "$J" x
step_complete admission_config "Admission Configuration"

# student_parent
J=$(call $OJ PUT /api/v1/setup/config/STUDENT_PARENT '{"pickupVerification":"PIN_MATCH","consentTypes":["PHOTO_CONSENT v1","MEDICAL_CONSENT v1"]}')
[ "$(echo $J | python3 -c 'import json,sys;print(json.load(sys.stdin)["success"])')" == "True" ] && chk "config STUDENT_PARENT saved" "$J" ok || chk "config STUDENT_PARENT" "$J" x
step_complete student_parent "Student & Parent Foundation"

# classes_sections (wizard classrooms already program-linked) + teacher assignment
step_complete classes_sections "Classes & Sections"
J=$(call $OJ GET /api/v1/classrooms)
TEACHER=$(echo $J | python3 -c 'import json,sys;print("")' )
J=$(call $OJ GET /api/v1/users)
TEACHER=$(echo $J | python3 -c 'import json,sys;d=json.load(sys.stdin);print(next(u["userId"] for u in d["data"] if u["role"]=="TEACHER"))')
CLASS1=$(echo "$(call $OJ GET /api/v1/classrooms)" | python3 -c 'import json,sys;print(json.load(sys.stdin)["data"][0]["id"])')
J=$(call $OJ PATCH /api/v1/classrooms/$CLASS1 "{\"primaryTeacherId\":\"$TEACHER\"}")
[ "$(echo $J | python3 -c 'import json,sys;print(json.load(sys.stdin)["success"])')" == "True" ] && chk "teacher assigned to first class" "$J" ok || chk "teacher assign" "$J" x
CLASS2=$(echo "$(call $OJ GET /api/v1/classrooms)" | python3 -c 'import json,sys;print(json.load(sys.stdin)["data"][1]["id"])')
call $OJ PATCH /api/v1/classrooms/$CLASS2 "{\"primaryTeacherId\":\"$TEACHER\"}" > /dev/null
step_complete teacher_assignment "Teacher Assignment"

# daily_operations
J=$(call $OJ PUT /api/v1/setup/config/DAILY_OPERATIONS '{"attendanceEnabled":true,"recordTypes":["ARRIVAL","MEALS","NAP","MOOD","PICKUP"]}')
[ "$(echo $J | python3 -c 'import json,sys;print(json.load(sys.stdin)["success"])')" == "True" ] && chk "config DAILY_OPERATIONS saved" "$J" ok || chk "config DAILY_OPERATIONS" "$J" x
step_complete daily_operations "Daily Operations"

# health_safety
J=$(call $OJ PUT /api/v1/setup/config/HEALTH_SAFETY '{"allergyCategories":["FOOD"],"incidentCategories":["MINOR_INJURY","EMERGENCY"],"emergencyContacts":["Admin — Front Desk — 9800000001"],"escalationRules":"EMERGENCY alerts immediately"}')
[ "$(echo $J | python3 -c 'import json,sys;print(json.load(sys.stdin)["success"])')" == "True" ] && chk "config HEALTH_SAFETY saved" "$J" ok || chk "config HEALTH_SAFETY" "$J" x
step_complete health_safety "Health & Safety"

# communication
J=$(call $OJ PUT /api/v1/setup/config/COMMUNICATION '{"channels":["IN_APP"],"notificationEvents":["ATTENDANCE_UPDATE","FEE_DUE","HEALTH_ALERT"]}')
[ "$(echo $J | python3 -c 'import json,sys;print(json.load(sys.stdin)["success"])')" == "True" ] && chk "config COMMUNICATION saved" "$J" ok || chk "config COMMUNICATION" "$J" x
step_complete communication "Communication"

# documents — RECOMMENDED: complete via template registration
J=$(call $OJ PUT /api/v1/setup/config/DOCUMENT_TEMPLATES '{"templates":["ADMISSION_FORM","RECEIPT"]}')
[ "$(echo $J | python3 -c 'import json,sys;print(json.load(sys.stdin)["success"])')" == "True" ] && chk "config DOCUMENT_TEMPLATES saved" "$J" ok || chk "config DOCUMENT_TEMPLATES" "$J" x
step_complete documents "Documents & Templates"

# data_import — OPTIONAL: skip
J=$(call $OJ POST /api/v1/setup/steps/data_import '{"action":"skip"}')
[ "$(echo $J | python3 -c 'import json,sys;print(json.load(sys.stdin)["success"])')" == "True" ] && chk "optional step skipped: data_import" "$J" ok || chk "skip data_import" "$J" x

say "5. setup state should now be READY_FOR_REVIEW"
J=$(call $OJ GET /api/v1/setup/status)
STATUS=$(echo $J | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["data"]["status"])')
PROG=$(echo $J | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["data"]["progress"])')
[ "$STATUS" == "READY_FOR_REVIEW" ] && chk "state READY_FOR_REVIEW at ${PROG}%" "$J" ok || chk "state=$STATUS prog=$PROG" "$J" x

say "6. validation engine"
J=$(call $OJ POST /api/v1/setup/validate)
OVERALL=$(echo $J | python3 -c 'import json,sys;print(json.load(sys.stdin)["data"]["overall"])')
BLOCKED=$(echo $J | python3 -c 'import json,sys;d=json.load(sys.stdin);print(",".join(c["key"] for c in d["data"]["categories"] if c["status"]=="BLOCKED"))')
echo "  overall=$OVERALL blocked=[$BLOCKED]"
case "$STATUS2" in esac
S=$(echo $J | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["data"].get("setupStatus"))')
[ "$S" == "READY_FOR_GO_LIVE" ] && chk "validation → READY_FOR_GO_LIVE" "$J" ok || chk "validation state=$S" "$J" x

say "7. GO LIVE"
J=$(call $OJ POST /api/v1/setup/go-live)
OKJ=$(echo $J | python3 -c 'import json,sys;print(json.load(sys.stdin)["success"])')
[ "$OKJ" == "True" ] && chk "GO-LIVE SUCCESS" "$J" ok || chk "go-live" "$J" x
J=$(call $OJ GET /api/v1/setup/progress)
ST=$(echo $J | python3 -c 'import json,sys;print(json.load(sys.stdin)["data"]["status"])')
[ "$ST" == "LIVE" ] && chk "setup status = LIVE" "$J" ok || chk "status=$ST" "$J" x

say "8. RBAC guard — teacher account must NOT access setup write APIs"
TJ=/tmp/m00-teacher.jar
call $TJ POST /api/v1/auth/login "{\"email\":\"kavita-$CODE@newtown.demo\",\"password\":\"$P\"}" > /dev/null
J=$(call $TJ POST /api/v1/setup/go-live)
CODE403=$(echo $J | python3 -c 'import json,sys;print(json.load(sys.stdin).get("error",{}).get("code",""))')
[ "$CODE403" == "PERMISSION_001" ] && chk "teacher blocked from setup mutations (403)" "$J" ok || chk "teacher guard code=$CODE403" "$J" x

say "RESULT: $pass passed, $fail failed"
[ $fail -eq 0 ]
