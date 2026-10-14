import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';

const db = new DatabaseSync('app.db');
const now = Date.now();

console.log('===> 1. Làm sạch phiên làm việc và nhật ký...');
db.prepare('DELETE FROM sessions').run();
db.prepare('DELETE FROM activity').run();
db.prepare("UPDATE meta SET val = 0 WHERE key = 'visits'").run();

console.log('===> 2. Đưa tất cả phòng và checklist về trạng thái ban đầu...');
db.prepare('UPDATE rooms SET status = ?, note = ?, updated_by = NULL, updated_at = ?')
  .run('red', '', now);
db.prepare('UPDATE tasks SET state = ?, updated_by = NULL, updated_at = ?')
  .run('todo', now);

// Đảm bảo admin có đầy đủ quyền
db.prepare("UPDATE users SET is_admin = 1, role = 'admin' WHERE LOWER(email) = 'admin@example.com'").run();

console.log('===> 3. Xuất toàn bộ dữ liệu sạch sang seed.json...');
const users = db.prepare('SELECT email, name, is_admin, role FROM users ORDER BY is_admin DESC, name ASC').all().map((u) => ({
  email: u.email,
  name: u.name,
  isAdmin: Boolean(u.is_admin),
  role: u.role || (u.is_admin ? 'admin' : 'room_lead'),
}));

const groups = db.prepare('SELECT id, name FROM groups ORDER BY sort, id').all().map((g) => {
  const rooms = db.prepare('SELECT id, name, status, note FROM rooms WHERE group_id = ? ORDER BY sort, id').all(g.id).map((r) => {
    const owners = db.prepare('SELECT email FROM room_owners WHERE room_id = ? ORDER BY email').all(r.id).map((o) => o.email);
    const tasks = db.prepare('SELECT text, state FROM tasks WHERE room_id = ? ORDER BY sort, id').all(r.id).map((t) => [t.text, t.state]);
    return {
      name: r.name,
      status: r.status,
      note: r.note,
      owners,
      tasks,
    };
  });
  return {
    name: g.name,
    rooms,
  };
});

const seedData = { users, groups };
writeFileSync('seed.json', JSON.stringify(seedData, null, 2), 'utf8');

console.log('===> 4. Tối ưu và thu gọn cơ sở dữ liệu (VACUUM)...');
db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').run();
db.prepare('VACUUM').run();

console.log('===> HOÀN TẤT LÀM SẠCH DỮ LIỆU:');
console.log(`- Tổng số cán bộ: ${users.length}`);
console.log(`- Tổng số tầng/khối: ${groups.length}`);
const totalRooms = groups.reduce((acc, g) => acc + g.rooms.length, 0);
const totalTasks = groups.reduce((acc, g) => acc + g.rooms.reduce((ta, r) => ta + r.tasks.length, 0), 0);
console.log(`- Tổng số chi đoàn: ${totalRooms}`);
console.log(`- Tổng số mục giấy tờ: ${totalTasks}`);
console.log(`- Lượt truy cập: 0`);
console.log(`- Phiên đăng nhập còn lại: 0`);
console.log(`- Nhật ký hoạt động còn lại: 0`);
