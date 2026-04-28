#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_BASE_URL="${APEX_API_BASE_URL:-http://127.0.0.1:8000}"
QUERY="${APEX_BETA_INGEST_QUERY:-commercial real estate Dallas}"

pass() { printf 'PASS %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1" >&2; exit 1; }
json_query() {
  python3 -c 'import json, sys
payload = json.loads(sys.argv[1])
expr = sys.argv[2]
value = payload
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
' "$1" "$2"
}

cd "$ROOT_DIR"
bash scripts/healthcheck.sh
pass "core beta healthcheck passed"

first_ingest="$(curl -fsS --max-time 30 -X POST "${API_BASE_URL}/ingest/google-news-cre?query=$(python3 -c 'import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1]))' "$QUERY")" || true)"
[[ -n "$first_ingest" ]] || fail "live ingest failed for query: $QUERY"
first_count="$(json_query "$first_ingest" count)"
[[ "$first_count" -ge 1 ]] || fail "live ingest returned no items for query: $QUERY"
pass "live ingest returned ${first_count} item(s)"

second_ingest="$(curl -fsS --max-time 30 -X POST "${API_BASE_URL}/ingest/google-news-cre?query=$(python3 -c 'import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1]))' "$QUERY")" || true)"
[[ -n "$second_ingest" ]] || fail "repeat ingest failed for query: $QUERY"

repeat_ids="$(python3 - <<'PY' "$first_ingest" "$second_ingest"
import json, sys
first = json.loads(sys.argv[1])
second = json.loads(sys.argv[2])
first_ids = [item['event_id'] for item in first['events']]
second_ids = [item['event_id'] for item in second['events']]
if first_ids != second_ids:
    raise SystemExit(1)
print(','.join(first_ids))
PY
)" || fail "repeat ingest produced divergent event ids"
pass "repeat ingest dedupe held for query: $QUERY (${repeat_ids})"

review_queue="$(curl -fsS --max-time 15 "${API_BASE_URL}/actions/review-queue" || true)"
[[ -n "$review_queue" ]] || fail "review queue unavailable after beta validation"
review_queue_count="$(python3 -c 'import json, sys; print(len(json.loads(sys.argv[1])["items"]))' "$review_queue")"
pass "review queue reachable after validation (${review_queue_count} items)"
