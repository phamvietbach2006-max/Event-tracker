#!/usr/bin/env bash
# Chạy một lần trên VM (Ubuntu 24.04), bằng sudo. Chạy lại không hỏng.
# Dùng:  sudo bash setup-vm.sh   (các file cấu hình nằm cùng thư mục với script này)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
export DEBIAN_FRONTEND=noninteractive

echo "==> Cập nhật và cài gói"
apt-get update -y
apt-get install -y curl ca-certificates rsync nginx certbot python3-certbot-nginx sqlite3 iptables-persistent netfilter-persistent

echo "==> Node 22"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "==> User và thư mục"
id eventapp >/dev/null 2>&1 || useradd --system --home /opt/event-tracker --shell /usr/sbin/nologin eventapp
mkdir -p /opt/event-tracker/app /opt/event-tracker/web /var/lib/event-tracker /var/backups/event-tracker
id deploy >/dev/null 2>&1 || useradd -m -s /bin/bash deploy   # user cho GitHub Actions (khóa SSH thêm riêng)
chown -R deploy:deploy /opt/event-tracker
echo 'deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart event-tracker, /usr/bin/systemctl is-active event-tracker' > /etc/sudoers.d/deploy
chmod 440 /etc/sudoers.d/deploy
chown eventapp:eventapp /var/lib/event-tracker /var/backups/event-tracker
[ -f /opt/event-tracker/web/index.html ] || cat > /opt/event-tracker/web/index.html <<'HTML'
<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>Event tracker</title><body style="font-family:sans-serif;padding:24px"><h1>Máy chủ đã sẵn sàng</h1><p>Giao diện chưa được deploy.</p>
HTML

echo "==> Biến môi trường (/etc/event-tracker.env)"
if [ ! -f /etc/event-tracker.env ]; then
  cat > /etc/event-tracker.env <<ENV
PORT=3000
HOST=127.0.0.1
DB_PATH=/var/lib/event-tracker/app.db
BASE_URL=https://sk.hust.edu.vn
SESSION_SECRET=$(openssl rand -hex 32)
ENV
  chmod 640 /etc/event-tracker.env
  chown root:eventapp /etc/event-tracker.env
fi

echo "==> systemd"
install -m 644 "$HERE/event-tracker.service" /etc/systemd/system/event-tracker.service
systemctl daemon-reload
systemctl enable event-tracker >/dev/null   # chưa start: backend chưa có

echo "==> nginx"
install -m 644 "$HERE/nginx.conf" /etc/nginx/sites-available/event-tracker
ln -sf /etc/nginx/sites-available/event-tracker /etc/nginx/sites-enabled/event-tracker
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx >/dev/null
systemctl reload nginx || systemctl restart nginx

echo "==> Tường lửa (iptables): mở 80/443 trước luật REJECT"
for p in 80 443; do
  if ! iptables -C INPUT -p tcp --dport "$p" -m state --state NEW -j ACCEPT 2>/dev/null; then
    n=$(iptables -L INPUT --line-numbers -n | awk '$2=="REJECT"{print $1; exit}')
    if [ -n "${n:-}" ]; then iptables -I INPUT "$n" -p tcp --dport "$p" -m state --state NEW -j ACCEPT
    else iptables -A INPUT -p tcp --dport "$p" -m state --state NEW -j ACCEPT; fi
  fi
done
netfilter-persistent save

echo "==> Sao lưu mỗi giờ"
install -m 755 "$HERE/backup.sh" /usr/local/bin/event-tracker-backup
echo '7 * * * * eventapp /usr/local/bin/event-tracker-backup >>/var/log/event-tracker-backup.log 2>&1' > /etc/cron.d/event-tracker-backup
touch /var/log/event-tracker-backup.log && chown eventapp /var/log/event-tracker-backup.log

echo "==> Xong"
iptables -L INPUT -n --line-numbers
