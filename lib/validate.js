import { HttpError } from './http.js';

export const STATUSES = ['red', 'yellow', 'green'];
export const TASK_STATES = ['todo', 'doing', 'done'];

const bad = (field, msg) => new HttpError(400, 'bad_request', `${field}: ${msg}`);

export function oneOf(v, list, field) {
  if (!list.includes(v)) throw bad(field, `phải là một trong ${list.join(', ')}`);
  return v;
}

export function text(v, max, field, { allowEmpty = false } = {}) {
  if (typeof v !== 'string') throw bad(field, 'phải là chuỗi');
  const s = v.trim();
  if (!allowEmpty && !s) throw bad(field, 'không được để trống');
  if (s.length > max) throw bad(field, `tối đa ${max} ký tự`);
  return s;
}

export function toInt(v) {
  const n = typeof v === 'number' ? v : /^-?\d+$/.test(String(v)) ? Number(v) : NaN;
  return Number.isInteger(n) ? n : null;
}

export function int(v, field) {
  const n = toInt(v);
  if (n === null) throw bad(field, 'phải là số nguyên');
  return n;
}

export function email(v, field = 'email') {
  const s = text(v, 120, field).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw bad(field, 'email không hợp lệ');
  return s;
}
