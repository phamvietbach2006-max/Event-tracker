import { readFileSync, writeFileSync } from 'node:fs';

const seed = JSON.parse(readFileSync('seed.json', 'utf8'));
const officers = JSON.parse(readFileSync('scripts/merged_officers.json', 'utf8'));

// Build lookups
const officerByName = new Map();
const officerByEmail = new Map();
for (const o of officers) {
  officerByName.set(o.name.toLowerCase().trim(), o);
  officerByEmail.set(o.email.toLowerCase().trim(), o);
}

// Special alias matches
const aliasMap = {
  'p.hoang.trung.nghia@hust.local': 'nghia.pht2517099@sis.hust.edu.vn',
  'vu.gia.huy@hust.local': 'huy.nvg2516805@sis.hust.edu.vn',
};

// 1. Update existing users with phone and position
const oldUsersByEmail = new Map();
for (const u of seed.users) {
  oldUsersByEmail.set(u.email.toLowerCase().trim(), u);
  let officer = officerByEmail.get(u.email.toLowerCase().trim()) || officerByName.get(u.name.toLowerCase().trim());
  if (!officer && aliasMap[u.email.toLowerCase().trim()]) {
    officer = officerByEmail.get(aliasMap[u.email.toLowerCase().trim()]);
  }
  if (officer) {
    if (officer.phone) u.phone = officer.phone;
    if (officer.position) u.position = officer.position;
    if (officer.department) u.department = officer.department;
    if (officer.team) u.team = officer.team;
    if (officer.cohort) u.cohort = officer.cohort;
    if (officer.student_id) u.student_id = officer.student_id;
  }
}

// 2. Add all 94 officers to seed.users
for (const o of officers) {
  const existing = seed.users.find((u) => u.email.toLowerCase() === o.email.toLowerCase());
  const isExecutive = o.team === 'Ban Điều hành';
  const isLead = o.position?.includes('Trưởng') || o.position?.includes('Phó');
  const role = isExecutive ? 'admin' : (isLead ? 'unit_lead' : 'room_lead');

  if (existing) {
    existing.name = o.name;
    existing.phone = o.phone || existing.phone || '';
    existing.position = o.position || existing.position || 'Ủy viên';
    existing.department = o.department || existing.department || '';
    existing.team = o.team || existing.team || '';
    existing.cohort = o.cohort || existing.cohort || '';
    existing.student_id = o.student_id || existing.student_id || '';
    if (isExecutive) {
      existing.isAdmin = true;
      existing.role = 'admin';
    }
  } else {
    seed.users.push({
      email: o.email.toLowerCase(),
      name: o.name,
      isAdmin: isExecutive,
      role,
      phone: o.phone || '',
      position: o.position || 'Ủy viên',
      department: o.department || '',
      team: o.team || '',
      cohort: o.cohort || '',
      student_id: o.student_id || '',
    });
  }
}

// 3. Map room owners to official emails
for (const g of seed.groups) {
  for (const r of g.rooms) {
    if (!r.owners) continue;
    r.owners = r.owners.map((ownerEmail) => {
      const e = ownerEmail.toLowerCase().trim();
      if (aliasMap[e]) return aliasMap[e];
      const oldUser = oldUsersByEmail.get(e);
      if (oldUser) {
        const off = officerByName.get(oldUser.name.toLowerCase().trim());
        if (off) return off.email.toLowerCase();
      }
      return e;
    });
  }
}

writeFileSync('seed.json', JSON.stringify(seed, null, 2), 'utf8');
console.log('Updated seed.json successfully!');
console.log('Total users in seed:', seed.users.length);
