#!/usr/bin/env bash
set -euo pipefail

PORT="${APEX_PREVIEW_PORT:-3000}"
TARGET_HOST="${APEX_PREVIEW_TARGET_HOST:-localhost}"
TARGET="${TARGET_HOST}:${PORT}"
TUNNEL_HOST="${APEX_PREVIEW_TUNNEL_HOST:-localhost.run}"
TUNNEL_USER="${APEX_PREVIEW_TUNNEL_USER:-nokey}"
CHECK_ONLY="${1:-}"

listener_pid="$(lsof -nP -iTCP:${PORT} -sTCP:LISTEN -t 2>/dev/null | head -n 1 || true)"
if [[ -z "$listener_pid" ]]; then
  echo "No local listener found on port ${PORT}. Start the web app first with pnpm dev:web." >&2
  exit 1
fi

listener_command="$(ps -p "$listener_pid" -o command= 2>/dev/null || true)"
if [[ "$listener_command" != *"next-server"* && "$listener_command" != *"next dev"* ]]; then
  echo "Port ${PORT} is live, but not from a managed Next process: ${listener_command:-$listener_pid}" >&2
  exit 1
fi

http_code="$(curl -sSI --max-time 10 -o /dev/null -w '%{http_code}' "http://${TARGET}/_not-found" || true)"
if [[ -z "$http_code" || "$http_code" == "000" ]]; then
  echo "Web app listener exists on ${TARGET}, but HTTP health check failed." >&2
  exit 1
fi

if [[ "$CHECK_ONLY" == "--check" ]]; then
  echo "ready:preview:${TARGET}"
  exit 0
fi

echo "Opening preview tunnel for http://${TARGET} via ${TUNNEL_HOST} ..."
exec ssh \
  -o StrictHostKeyChecking=no \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -o ExitOnForwardFailure=yes \
  -R 80:${TARGET} \
  "${TUNNEL_USER}@${TUNNEL_HOST}"
