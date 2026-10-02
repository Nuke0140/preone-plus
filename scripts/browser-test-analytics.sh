#!/bin/bash
# Browser E2E: login → admissions → Analytics tab → verify widgets → screenshot
set -u
cd /home/z/my-project
export DATABASE_URL="$(grep '^DATABASE_URL' .env | cut -d= -f2- | tr -d '\"')"

echo "[1] Start dev server"
setsid nohup bun run dev >> dev.log 2>&1 < /dev/null &
SRV=$!
for i in $(seq 1 45); do curl -s -o /dev/null http://127.0.0.1:3000/ --max-time 2 && break; sleep 1; done
echo "    ready"
cleanup() { kill -- -"$SRV" 2>/dev/null; pkill -f "next-server" 2>/dev/null; agent-browser close 2>/dev/null; }
trap cleanup EXIT

AB="agent-browser"
$AB open http://127.0.0.1:3000/ >/dev/null 2>&1
sleep 3

echo "[2] Login (SUNSHINE / owner@sunshine.demo / Preone@123)"
$AB find role textbox fill "SUNSHINE" --name "School Code" >/dev/null 2>&1 || $AB fill @e1296 "SUNSHINE" >/dev/null 2>&1
$AB find role textbox fill "owner@sunshine.demo" --name "Email or Username" >/dev/null 2>&1 || $AB fill @e1297 "owner@sunshine.demo" >/dev/null 2>&1
$AB find role textbox fill "Preone@123" --name "Password" >/dev/null 2>&1 || $AB fill @e1298 "Preone@123" >/dev/null 2>&1
$AB find role button click --name "Sign In" >/dev/null 2>&1 || $AB click @e1292 >/dev/null 2>&1
sleep 5
echo "    landed: $($AB get url)"

echo "[3] Open Admissions module"
$AB open http://127.0.0.1:3000/app/admissions >/dev/null 2>&1
sleep 5
echo "    landed: $($AB get url)"

echo "[4] Click Analytics tab"
$AB find text "Analytics" click >/dev/null 2>&1
sleep 6

echo "[5] Verify widgets rendered"
SNAP=$($AB snapshot -c 2>/dev/null)
for W in "Admission Analytics" "12-Stage Admission Funnel" "Monthly Trends" "Lead Source ROI" "Counsellor Leaderboard" "Parent Experience Speed" "Aging & Stuck Applications" "Offer Insights" "Capacity Forecast"; do
  if echo "$SNAP" | grep -q "$W"; then echo "  ✓ $W"; else echo "  ✗ MISSING: $W"; fi
done
$AB errors 2>/dev/null | head -5

echo "[6] Screenshots"
mkdir -p /home/z/my-project/download
$AB screenshot /home/z/my-project/download/admission-analytics-top.png >/dev/null 2>&1 && echo "  ✓ top screenshot"
$AB scroll down 2200 >/dev/null 2>&1; sleep 1
$AB screenshot /home/z/my-project/download/admission-analytics-mid.png >/dev/null 2>&1 && echo "  ✓ mid screenshot"
$AB scroll down 2600 >/dev/null 2>&1; sleep 1
$AB screenshot /home/z/my-project/download/admission-analytics-bottom.png >/dev/null 2>&1 && echo "  ✓ bottom screenshot"
