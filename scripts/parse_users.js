import { readFileSync, writeFileSync } from 'node:fs';

function cleanPhone(raw) {
  if (!raw) return '';
  let p = String(raw).replace(/\D/g, '');
  if (!p) return '';
  if (p.length === 9) p = '0' + p;
  if (p.startsWith('84') && p.length === 11) p = '0' + p.slice(2);
  return p;
}

const s1 = readFileSync('scripts/Sheet1_NhanSuMang_default.csv', 'utf8');
const s2 = readFileSync('scripts/Sheet2_CanBoCTV_default.csv', 'utf8');

// Parse s1
const lines1 = s1.split(/\r?\n/);
let currentTeam = '';
const list1 = [];
for (const rawLine of lines1) {
  const line = rawLine.trim();
  if (!line) continue;
  if (line.includes('BAN ĐIỀU HÀNH') && !line.includes('STT')) {
    currentTeam = 'Ban Điều hành';
    continue;
  }
  if (line.includes('MẢNG TỔ CHỨC VÀ PHÁT TRIỂN ĐOÀN VỤ')) {
    currentTeam = 'Tổ chức & Phát triển Đoàn vụ';
    continue;
  }
  if (line.includes('MẢNG GIÁM SÁT, KIỂM TRA VÀ ĐIỂM RÈN LUYỆN')) {
    currentTeam = 'Giám sát, Kiểm tra & ĐRL';
    continue;
  }
  if (line.includes('MẢNG PHÁT TRIỂN ĐẢNG VÀ CHUYỂN ĐỔI SỐ')) {
    currentTeam = 'Phát triển Đảng & CĐS';
    continue;
  }
  if (line.includes('MẢNG TRUYỀN THÔNG – SỰ KIỆN VÀ PHÁT TRIỂN NỘI BỘ')) {
    currentTeam = 'Truyền thông, Sự kiện & PTNB';
    continue;
  }
  if (line.includes('STT,Họ và tên')) continue;

  const parts = line.split(',').map(s => s.trim());
  const p = parts[0] === '' ? parts.slice(1) : parts;
  if (p.length >= 6 && p[0] && !isNaN(Number(p[0])) && p[1] && p[5]?.includes('@')) {
    list1.push({
      name: p[1],
      position: p[2] || 'Ủy viên',
      cohort: p[3] || '',
      phone: cleanPhone(p[4]),
      email: p[5].toLowerCase(),
      department: p[6] || '',
      team: currentTeam
    });
  }
}

// Parse s2
const lines2 = s2.split(/\r?\n/);
const list2 = [];
for (let i = 1; i < lines2.length; i++) {
  const line = lines2[i].trim();
  if (!line) continue;
  const p = line.split(',').map(s => s.trim());
  if (p.length >= 8 && p[0] && !isNaN(Number(p[0])) && p[1]) {
    let email = p[8]?.toLowerCase() || '';
    if (!email && p[2]) {
      email = `k${p[2]}@sis.hust.edu.vn`;
    }
    list2.push({
      name: p[1],
      student_id: p[2] || '',
      phone: cleanPhone(p[4]),
      dob: p[5] || '',
      department: p[6] || '',
      class_name: p[7] || '',
      email: email,
      position: 'CTV',
      team: 'Cộng tác viên K70/K71'
    });
  }
}

console.log('List 1 valid users:', list1.length);
console.log('List 2 valid users:', list2.length);

// Merge by email
const usersByEmail = new Map();

for (const u of list1) {
  usersByEmail.set(u.email, { ...u });
}

for (const u of list2) {
  if (u.email && usersByEmail.has(u.email)) {
    const existing = usersByEmail.get(u.email);
    if (!existing.phone && u.phone) existing.phone = u.phone;
    if (!existing.department && u.department) existing.department = u.department;
    if (u.student_id) existing.student_id = u.student_id;
    if (u.dob) existing.dob = u.dob;
    if (u.class_name) existing.class_name = u.class_name;
  } else if (u.email) {
    usersByEmail.set(u.email, { ...u });
  }
}

const merged = Array.from(usersByEmail.values());
console.log('Total unique users:', merged.length);
console.log('Users with phone:', merged.filter(u => u.phone).length);
console.log('Users without phone:', merged.filter(u => !u.phone).map(u => ({ name: u.name, email: u.email })));

writeFileSync('scripts/merged_officers.json', JSON.stringify(merged, null, 2), 'utf8');
