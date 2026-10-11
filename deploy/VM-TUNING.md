# Cấu hình VM đã chỉnh sau test tải (2026-10-12)

Mỗi người xem mở một kết nối realtime (SSE), nginx tốn 2 kết nối cho mỗi người. Mặc định `worker_connections 768` chỉ chịu được khoảng 380 người cùng lúc; vượt thì lỗi 500 và "worker_connections are not enough".

Đã chỉnh trên VM (không nằm trong repo, làm lại nếu dựng VM mới):

```bash
sudo sed -i 's/worker_connections 768;/worker_connections 8192;/' /etc/nginx/nginx.conf
sudo sed -i '1i worker_rlimit_nofile 32768;' /etc/nginx/nginx.conf
sudo mkdir -p /etc/systemd/system/event-tracker.service.d
printf '[Service]\nLimitNOFILE=65536\n' | sudo tee /etc/systemd/system/event-tracker.service.d/limits.conf
sudo nginx -t && sudo systemctl daemon-reload && sudo systemctl reload nginx && sudo systemctl restart event-tracker
```

Kết quả test tải qua IP (không qua Cloudflare): 800 kết nối realtime + 100 người đọc → 0 lỗi, p95 363 ms; 300 realtime + ghi mỗi 0,5 giây → mọi lần ghi lan tới client trong p95 219 ms.
