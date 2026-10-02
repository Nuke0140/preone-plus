#!/bin/bash
# One-shot HTTP E2E test for /api/v1/admissions/analytics
# Starts dev server, logs in, hits the endpoint, verifies JSON, then stops.
set -u
cd /home/z/my-project

export DATABASE_URL="$(grep '^DATABASE_URL' .env | cut -d= -f2- | tr -d '\"')"

echo "[1] Starting dev server..."
setsid nohup bun run dev >> dev.log 2>&1 < /dev/null &
SERVER_PID=$!

for i in $(seq 1 45); do
  if curl -s -o /dev/null http://127.0.0.1:3000/ --max-time 2; then
    echo "    server ready after ${i}s"
    break
  fi
  sleep 1
done

cleanup() { kill -- -"$SERVER_PID" 2>/dev/null; pkill -f "next-server" 2>/dev/null; }
trap cleanup EXIT

echo "[2] Login as owner@sunshine.demo ..."
LOGIN=$(curl -s -c /tmp/an-ck.txt -X POST http://127.0.0.1:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"owner@sunshine.demo","password":"Preone@123"}' --max-time 60)
LOGIN_OK=$(echo "$LOGIN" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('success'))" 2>/dev/null)
echo "    login success=$LOGIN_OK"
if [ "$LOGIN_OK" != "True" ]; then echo "LOGIN RESPONSE: $LOGIN" | head -c 400; exit 1; fi

echo "[3] GET /api/v1/admissions/analytics ..."
curl -s -b /tmp/an-ck.txt "http://127.0.0.1:3000/api/v1/admissions/analytics" --max-time 120 -o /tmp/an-res.json
python3 - /tmp/an-res.json <<'EOF'
import sys, json
with open(sys.argv[1]) as f:
    d = json.load(f)
assert d.get('success') is True, f"API success flag false: {str(d)[:300]}"
a = d['data']
checks = []
def ck(name, cond): checks.append((name, bool(cond)))
ck('funnel has 12 stages', len(a['funnel']) == 12)
ck('funnel stage keys ordered', [s['step'] for s in a['funnel']] == list(range(1, 13)))
ck('monthlyTrends 12 points', len(a['monthlyTrends']) == 12)
ck('sourceRoi from canonical enum', isinstance(a['sourceRoi'], list) and len(a['sources']) >= 10)
ck('no phantom SOCIAL_MEDIA', 'SOCIAL_MEDIA' not in a['sources'])
ck('counsellorBoard list', isinstance(a['counsellorBoard'], list))
ck('aging 4 buckets', len(a['aging']) == 4)
ck('offerInsights keys', all(k in a['offerInsights'] for k in ('acceptanceRate','declineReasons','avgHoursToAccept')))
ck('capacityForecast rows', isinstance(a['capacityForecast'], list))
ck('speedMetrics keys', all(k in a['speedMetrics'] for k in ('avgFirstResponseHours','visitNoShowRate','followUpsDueToday')))
ck('totals consistent', all(k in a['totals'] for k in ('leads','applications','enrolled','leadToEnrollRate')))
ck('range present', 'from' in a['range'] and 'to' in a['range'])
failed = [n for n, okv in checks if not okv]
for n, okv in checks:
    print(f"  {'✓' if okv else '✗ FAIL'} {n}")
print(f"\nHTTP-E2E: {len(checks)-len(failed)}/{len(checks)} passed")
# sample data summary
t = a['totals']
print(f"  Sample: {t['leads']} leads, {t['applications']} apps, {t['enrolled']} enrolled, {t['leadToEnrollRate']}% conversion")
print(f"  Sources with data: {[(s['source'], s['leads']) for s in a['sourceRoi'] if s['leads'] > 0]}")
print(f"  Programs: {[(c['label'], c['capacity'], c['enrolled']) for c in a['capacityForecast'][:4]]}")
sys.exit(1 if failed else 0)
EOF
RC=$?

echo "[4] Unauthorized access check (no cookie) ..."
ANON=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000/api/v1/admissions/analytics" --max-time 60)
echo "    anon status=$ANON (expect 401/403)"
if [ "$ANON" = "401" ] || [ "$ANON" = "403" ]; then echo "  ✓ RBAC blocks anonymous access"; else echo "  ✗ FAIL: anon not blocked"; RC=1; fi

echo "[5] Range filter check ..."
RANGE=$(curl -s -b /tmp/an-ck.txt "http://127.0.0.1:3000/api/v1/admissions/analytics?from=$(date -u -d '+1 day' +%Y-%m-%dT%H:%M:%SZ)" --max-time 120 -o /tmp/an-range.json)
RF=$(python3 - /tmp/an-range.json <<'EOF'
import sys, json
with open(sys.argv[1]) as f:
    d = json.load(f)
print(d['data']['totals']['leads'])
EOF
)
echo "    future-range leads=$RF (expect 0)"
[ "$RF" = "0" ] && echo "  ✓ Range filter works" || { echo "  ✗ FAIL range filter"; RC=1; }

if [ $RC -eq 0 ]; then echo ""; echo "✅ HTTP E2E COMPLETE — all checks passed"; else echo ""; echo "❌ HTTP E2E had failures"; fi
exit $RC
