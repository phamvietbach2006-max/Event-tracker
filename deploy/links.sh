#!/usr/bin/env bash
# In link đăng nhập riêng của mọi người dùng (chạy trên VM bằng user eventapp).
set -euo pipefail
HOST=${HOST:-ubuntu@168.107.75.89}
KEY=${KEY:-$HOME/.ssh/oracle-event.key}
ssh -i "$KEY" "$HOST" "sudo -u eventapp bash -c 'set -a; . /etc/event-tracker.env; set +a; cd /opt/event-tracker/app && node scripts/links.js'"
