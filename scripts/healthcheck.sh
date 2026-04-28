#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${APEX_API_BASE_URL:-http://127.0.0.1:8000}"
WEB_BASE_URL="${APEX_WEB_BASE_URL:-http://127.0.0.1:3000}"
PREVIEW_URL="${APEX_PREVIEW_URL:-}"
OPERATOR_NAME="${APEX_OPERATOR_NAME:-Reginald}"
OPERATOR_ROLE="${APEX_OPERATOR_ROLE:-principal_operator}"
DRAFT_TYPE="${APEX_HEALTHCHECK_DRAFT_TYPE:-healthcheck_validation}"

pass() { printf 'PASS %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1" >&2; exit 1; }
json_field() {
  local payload="$1"
  local expr="$2"
  python3 -c 'import json, sys
expr = sys.argv[1]
payload = sys.argv[2]
data = json.loads(payload)
value = data
for part in expr.split("."):
    if part.isdigit():
        value = value[int(part)]
    else:
        value = value[part]
if isinstance(value, (dict, list)):
    print(json.dumps(value))
elif value is None:
    print("")
else:
    print(value)
' "$expr" "$payload"
}

api_health="$(curl -fsS --max-time 10 "${API_BASE_URL}/health" || true)"
[[ -n "$api_health" ]] || fail "api health endpoint unreachable at ${API_BASE_URL}/health"
pass "api health reachable"

web_code="$(curl -sSI --max-time 10 -o /dev/null -w '%{http_code}' "${WEB_BASE_URL}/_not-found" || true)"
[[ -n "$web_code" && "$web_code" != "000" ]] || fail "web route probe failed at ${WEB_BASE_URL}/_not-found"
if [[ "$web_code" =~ ^5 ]]; then
  fail "web route probe returned server error HTTP ${web_code}"
fi
pass "web route probe returned HTTP ${web_code}"

ws_probe_url="${API_BASE_URL}/ws"
ws_code="$(curl -sS -o /dev/null -w '%{http_code}' -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: apexhealthcheck123=' --max-time 10 "${ws_probe_url}" || true)"
if [[ -z "$ws_code" || "$ws_code" == "000" ]]; then
  fail "ws endpoint probe failed at ${ws_probe_url}"
fi
pass "ws endpoint reachable (HTTP ${ws_code})"

seed_payload="$(curl -fsS --max-time 15 -X POST "${API_BASE_URL}/bootstrap/sample-event" || true)"
[[ -n "$seed_payload" ]] || fail "sample-event bootstrap failed"
event_id="$(json_field "$seed_payload" event_id)"
[[ -n "$event_id" ]] || fail "bootstrap response missing event_id"
pass "sample event persisted (${event_id})"

event_detail="$(curl -fsS --max-time 15 "${API_BASE_URL}/events/${event_id}" || true)"
[[ -n "$event_detail" ]] || fail "event detail lookup failed for ${event_id}"
event_title="$(json_field "$event_detail" title)"
event_summary="$(json_field "$event_detail" summary)"
event_type="$(json_field "$event_detail" event_type)"
event_market="$(json_field "$event_detail" market)"
event_brand="$(json_field "$event_detail" primary_brand)"
pass "event detail reachable for seeded event"

draft_request_payload="$(python3 - <<'PY' "$event_id" "$event_title" "$event_summary" "$event_type" "$event_market" "$event_brand"
import json
import sys
print(json.dumps({
    'event_id': sys.argv[1],
    'event_title': sys.argv[2],
    'event_summary': sys.argv[3],
    'event_type': sys.argv[4],
    'market': sys.argv[5],
    'primary_brand': sys.argv[6],
    'badges': ['healthcheck'],
    'draft_type': 'healthcheck_validation',
}))
PY
)"

draft_payload="$(curl -fsS --max-time 20 -X POST "${API_BASE_URL}/actions/draft" -H 'Content-Type: application/json' --data "$draft_request_payload" || true)"
[[ -n "$draft_payload" ]] || fail "draft generation failed for ${event_id}"
draft_title="$(json_field "$draft_payload" title)"
draft_body="$(json_field "$draft_payload" body)"
draft_audience="$(json_field "$draft_payload" audience)"
draft_brand="$(json_field "$draft_payload" recommended_brand)"
draft_why="$(json_field "$draft_payload" why_it_matters)"
draft_posture="$(json_field "$draft_payload" signal_posture)"
[[ -n "$draft_title" && -n "$draft_body" ]] || fail "draft response missing core fields"
pass "action draft generated"

update_payload="$(python3 - <<'PY' "$event_id" "$draft_title" "$draft_body" "$draft_audience" "$draft_brand" "$draft_why" "$draft_posture" "$OPERATOR_NAME"
import json
import sys
print(json.dumps({
    'event_id': sys.argv[1],
    'title': f"{sys.argv[2]} [healthcheck]",
    'body': f"{sys.argv[3]}\n\nHealthcheck operator save.",
    'audience': sys.argv[4],
    'recommended_brand': sys.argv[5],
    'why_it_matters': sys.argv[6],
    'signal_posture': sys.argv[7],
    'context_notes': ['healthcheck save', 'beta workflow'],
    'draft_type': 'healthcheck_validation',
    'draft_status': 'awaiting_review',
    'assigned_reviewer_name': 'APEX Beta Review',
    'operator_name': sys.argv[8],
}))
PY
)"

save_response="$(curl -fsS --max-time 20 -X PUT "${API_BASE_URL}/actions/draft/${event_id}" \
  -H 'Content-Type: application/json' \
  -H "x-apex-operator-name: ${OPERATOR_NAME}" \
  -H "x-apex-operator-role: ${OPERATOR_ROLE}" \
  --data "$update_payload" || true)"
[[ -n "$save_response" ]] || fail "draft save failed for ${event_id}"
saved_status="$(json_field "$save_response" draft_status)"
[[ "$saved_status" == "awaiting_review" ]] || fail "draft save returned unexpected status ${saved_status}"
pass "draft save workflow passed"

history_payload="$(curl -fsS --max-time 15 "${API_BASE_URL}/actions/draft/${event_id}/history" || true)"
[[ -n "$history_payload" ]] || fail "draft history lookup failed for ${event_id}"
history_count="$(python3 -c 'import json, sys; print(len(json.loads(sys.argv[1])))' "$(json_field "$history_payload" items)")"
[[ "$history_count" -ge 1 ]] || fail "draft history returned no items for ${event_id}"
pass "draft history returned ${history_count} item(s)"

review_queue_payload="$(curl -fsS --max-time 15 "${API_BASE_URL}/actions/review-queue" || true)"
[[ -n "$review_queue_payload" ]] || fail "review queue lookup failed"
review_queue_count="$(python3 -c 'import json, sys; print(len(json.loads(sys.argv[1])))' "$(json_field "$review_queue_payload" items)")"
pass "review queue reachable (${review_queue_count} items)"

if [[ -n "$PREVIEW_URL" ]]; then
  preview_code="$(curl -sSI --max-time 15 -o /dev/null -w '%{http_code}' "${PREVIEW_URL}" || true)"
  [[ -n "$preview_code" && "$preview_code" != "000" ]] || fail "preview URL probe failed at ${PREVIEW_URL}"
  pass "preview URL reachable (HTTP ${preview_code})"
fi
