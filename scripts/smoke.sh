#!/bin/bash
# PreOne smoke test matrix
BASE=http://127.0.0.1:3000
PJ=/tmp/platform.jar; OJ=/tmp/owner.jar
pass=0; fail=0

chk() { # name, expected, actual
  if [ "$2" == "$3" ]; then pass=$((pass+1)); echo "PASS  $1 ($3)";
  else fail=$((fail+1)); echo "FAIL  $1 (got $3, want $2)"; fi
}

# 1. Public
chk "landing" 200 "$(curl -s -o /dev/null -w '%{http_code}' $BASE/ --max-time 10)"

# 2. Logins
code=$(curl -s -c $PJ -o /dev/null -w '%{http_code}' -X POST $BASE/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"platform@preone.in","password":"Preone@123"}')
chk "login platform-admin" 200 "$code"
code=$(curl -s -c $OJ -o /dev/null -w '%{http_code}' -X POST $BASE/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"owner@sunshine.demo","password":"Preone@123"}')
chk "login owner" 200 "$code"

# 3. Authenticated APIs (owner school context)
for ep in dashboard students leads applications invoices fee-plans announcements classrooms timeline audit-logs observations users; do
  code=$(curl -s -b $OJ -o /dev/null -w '%{http_code}' $BASE/api/v1/$ep --max-time 10)
  chk "api $ep" 200 "$code"
done
code=$(curl -s -b $OJ -o /dev/null -w '%{http_code}' $BASE/api/v1/attendance --max-time 10)
chk "api attendance (no classroomId)" 400 "$code"

# 4. Platform APIs
code=$(curl -s -b $PJ -o /dev/null -w '%{http_code}' $BASE/api/v1/tenants --max-time 10)
chk "api tenants (platform)" 200 "$code"
code=$(curl -s -b $OJ -o /dev/null -w '%{http_code}' $BASE/api/v1/tenants --max-time 10)
chk "api tenants (owner blocked)" 403 "$code"

# 5. Pages (dashboard: M00 first-login handoff redirects non-live schools to /app/setup)
for pg in app/students app/finance app/admissions app/attendance app/academics app/communication app/timeline app/audit app/settings; do
  code=$(curl -s -b $OJ -o /dev/null -w '%{http_code}' $BASE/$pg --max-time 10)
  chk "page $pg" 200 "$code"
done
code=$(curl -s -b $OJ -o /dev/null -w '%{http_code}' $BASE/app/dashboard --max-time 10)
chk "page app/dashboard (307 -> setup while not LIVE)" 307 "$code"
code=$(curl -s -b $OJ -o /dev/null -w '%{http_code}' -L $BASE/app/dashboard --max-time 10)
chk "page dashboard redirect lands on setup" 200 "$code"
code=$(curl -s -b $PJ -o /dev/null -w '%{http_code}' $BASE/onboard --max-time 10)
chk "page /onboard (platform)" 200 "$code"
code=$(curl -s -b $OJ -o /dev/null -w '%{http_code}' -L $BASE/onboard --max-time 10)
chk "RBAC owner->onboard redirected" 200 "$code"

echo "=============================="
echo "RESULT: $pass passed, $fail failed"
