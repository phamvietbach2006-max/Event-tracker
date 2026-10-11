#!/usr/bin/env bash
# Chạy từ máy anh/chị, trong thư mục repo:  deploy/deploy.sh [backend|web|all]
# backend: server.js lib routes auth scripts seed.json package.json -> VM, npm ci, restart
# web:     web/dist -> VM (nginx phục vụ tĩnh, không cần restart)
set -euo pipefail
HOST=${HOST:-ubuntu@168.107.75.89}
KEY=${KEY:-$HOME/.ssh/oracle-event.key}
SSH="ssh -i $KEY"
cd "$(dirname "$0")/.."
what=${1:-all}

if [ "$what" = backend ] || [ "$what" = all ]; then
  files=(); for f in server.js lib routes auth scripts seed.json package.json package-lock.json; do [ -e "$f" ] && files+=("$f"); done
  rsync -az --delete -e "$SSH" "${files[@]}" "$HOST:/opt/event-tracker/app/"
  $SSH "$HOST" 'cd /opt/event-tracker/app && { [ -f package.json ] && npm ci --omit=dev 2>/dev/null || npm install --omit=dev 2>/dev/null || true; }; sudo systemctl restart event-tracker; sleep 1; systemctl is-active event-tracker'
fi
if [ "$what" = web ] || [ "$what" = all ]; then
  if [ -d web/dist ]; then rsync -az --delete -e "$SSH" web/dist/ "$HOST:/opt/event-tracker/web/"; else echo "web/dist chưa có, bỏ qua"; fi
fi
