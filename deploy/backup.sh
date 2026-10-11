#!/usr/bin/env bash
# Sao lưu SQLite mỗi giờ, giữ 24 bản gần nhất. Chạy bằng cron (user eventapp).
set -euo pipefail
DB=/var/lib/event-tracker/app.db
DIR=/var/backups/event-tracker
[ -f "$DB" ] || exit 0
mkdir -p "$DIR"
OUT="$DIR/app-$(date +%Y%m%d-%H%M).db"
sqlite3 "$DB" ".backup '$OUT'"
sqlite3 "$OUT" "PRAGMA integrity_check;" | grep -qx ok || { echo "backup hỏng: $OUT" >&2; exit 1; }
ls -1t "$DIR"/app-*.db | tail -n +25 | xargs -r rm --
