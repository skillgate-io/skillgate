#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4010}"
LOG_FILE="${TMPDIR:-/tmp}/skillgate-web-pa11y.log"
TMP_CONFIG="$(mktemp)"

PORT="${PORT}" npm run dev >"${LOG_FILE}" 2>&1 &
SERVER_PID=$!

cleanup() {
  rm -f "${TMP_CONFIG}" >/dev/null 2>&1 || true
  kill "${SERVER_PID}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

for _ in $(seq 1 40); do
  if curl -fsS "http://localhost:${PORT}/" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "http://localhost:${PORT}/" >/dev/null 2>&1; then
  echo "Failed to start local web server on port ${PORT}. Recent logs:"
  tail -n 60 "${LOG_FILE}" || true
  exit 1
fi

PORT="${PORT}" TMP_CONFIG="${TMP_CONFIG}" node -e "const fs=require('fs'); const port=process.env.PORT; const c=JSON.parse(fs.readFileSync('.pa11yci.json','utf8')); c.urls=(c.urls||[]).map((u)=>u.replace('http://localhost:3000', 'http://localhost:'+port)); fs.writeFileSync(process.env.TMP_CONFIG, JSON.stringify(c, null, 2));"

npx pa11y-ci --config "${TMP_CONFIG}"
