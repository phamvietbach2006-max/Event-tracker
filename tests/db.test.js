import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, getState } from '../lib/db.js';

function fixture() {
  const db = openDb();
  db.prepare("INSERT INTO users(email,name) VALUES ('a@x.vn','Nguyễn Văn A')").run();
  db.prepare("INSERT INTO groups(id,name,sort) VALUES (1,'Khối C2',1)").run();
  db.prepare("INSERT INTO rooms(id,group_id,name,sort,updated_at) VALUES (5,1,'Sảnh C2',1,1000)").run();
  db.prepare("INSERT INTO room_owners(room_id,email) VALUES (5,'a@x.vn')").run();
  db.prepare("INSERT INTO tasks(id,room_id,text,sort,updated_at) VALUES (501,5,'In thẻ',1,1000)").run();
  return db;
}

test('state rỗng khi chưa có dữ liệu', () => {
  assert.deepEqual(getState(openDb()), { version: 1, groups: [] });
});

test('getState gom khối > khu > việc, chủ khu chỉ có tên, không lộ email', () => {
  const s = getState(fixture());
  const room = s.groups[0].rooms[0];
  assert.equal(room.name, 'Sảnh C2');
  assert.equal(room.status, 'red');
  assert.equal(room.note, '');
  assert.equal(room.updatedAt, 1000);
  assert.deepEqual(room.owners, [{ name: 'Nguyễn Văn A' }]);
  assert.deepEqual(room.tasks, [{ id: 501, text: 'In thẻ', state: 'todo', sort: 1 }]);
  assert.ok(!JSON.stringify(s).includes('a@x.vn'));
});

test('sắp theo sort rồi id', () => {
  const db = fixture();
  db.prepare("INSERT INTO rooms(id,group_id,name,sort,updated_at) VALUES (6,1,'Hội trường',0,1000)").run();
  assert.deepEqual(getState(db).groups[0].rooms.map((r) => r.id), [6, 5]);
});

test('CHECK chặn status và state lạ', () => {
  const db = fixture();
  assert.throws(() => db.prepare("UPDATE rooms SET status='blue' WHERE id=5").run());
  assert.throws(() => db.prepare("UPDATE tasks SET state='xong' WHERE id=501").run());
});

test('xoá khu kéo theo việc và người phụ trách (foreign key)', () => {
  const db = fixture();
  db.prepare('DELETE FROM rooms WHERE id=5').run();
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tasks').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM room_owners').get().n, 0);
});
