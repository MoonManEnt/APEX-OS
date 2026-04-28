#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$ROOT_DIR/apps/api"
VENV_PYTHON="$API_DIR/.venv/bin/python"
CHECK_ONLY="${1:-}"
PORT=8000

if [[ ! -x "$VENV_PYTHON" ]]; then
  echo "Missing API virtualenv at $VENV_PYTHON" >&2
  exit 1
fi

existing_pid="$(lsof -nP -iTCP:${PORT} -sTCP:LISTEN -t 2>/dev/null | head -n 1 || true)"
if [[ -n "$existing_pid" ]]; then
  existing_command="$(ps -p "$existing_pid" -o command= 2>/dev/null || true)"
  if [[ "$existing_command" != *"uvicorn app.main:app"* ]]; then
    echo "Port ${PORT} is occupied by an unmanaged process: ${existing_command:-$existing_pid}" >&2
    exit 1
  fi

  if [[ "$CHECK_ONLY" == "--check" ]]; then
    echo "would-stop:${existing_pid}:${existing_command}"
    exit 0
  fi

  kill "$existing_pid"
fi

if [[ "$CHECK_ONLY" == "--check" ]]; then
  echo "ready:api"
  exit 0
fi

cd "$API_DIR"
exec "$VENV_PYTHON" -m uvicorn app.main:app --reload --host 0.0.0.0 --port ${PORT}
