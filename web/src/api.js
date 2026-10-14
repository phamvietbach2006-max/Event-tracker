export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function req(method, path, body) {
  const signal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined;
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const t = await res.text();
  let data = null;
  try { data = t ? JSON.parse(t) : null; } catch { /* body không phải JSON */ }
  if (!res.ok) throw new ApiError(res.status, data?.error ?? 'error', data?.message ?? `Lỗi ${res.status}`);
  return data;
}

const u = encodeURIComponent;

export const api = {
  state: () => req('GET', '/api/state'),
  contacts: () => req('GET', '/api/contacts'),
  me: () => req('GET', '/api/me'),
  login: (email, password) => req('POST', '/api/auth/login', { email, password }),
  changePassword: (oldPassword, newPassword) => req('POST', '/api/auth/change-password', { oldPassword, newPassword }),
  logout: () => req('POST', '/auth/logout'),
  setStatus: (id, status) => req('PATCH', `/api/rooms/${id}/status`, { status }),
  setNote: (id, note) => req('PATCH', `/api/rooms/${id}/note`, { note }),
  setTask: (id, state) => req('PATCH', `/api/tasks/${id}`, { state }),
  // quản trị
  addGroup: (name) => req('POST', '/api/groups', { name }),
  patchGroup: (id, p) => req('PATCH', `/api/groups/${id}`, p),
  delGroup: (id, force = false) => req('DELETE', `/api/groups/${id}${force ? '?force=1' : ''}`),
  importUnit: (payload) => req('POST', '/api/units/import', payload),
  addRoom: (groupId, name) => req('POST', `/api/groups/${groupId}/rooms`, { name }),
  patchRoom: (id, p) => req('PATCH', `/api/rooms/${id}`, p),
  delRoom: (id) => req('DELETE', `/api/rooms/${id}`),
  setOwners: (id, emails) => req('PUT', `/api/rooms/${id}/owners`, { emails }),
  setOwnerNames: (id, names) => req('PUT', `/api/rooms/${id}/owners`, { names }),
  addTask: (roomId, text) => req('POST', `/api/rooms/${roomId}/tasks`, { text }),
  patchTaskText: (id, text) => req('PATCH', `/api/tasks/${id}`, { text }),
  delTask: (id) => req('DELETE', `/api/tasks/${id}`),
  users: () => req('GET', '/api/users'),
  addUser: (user) => req('POST', '/api/users', user),
  patchUser: (email, p) => req('PATCH', `/api/users/${u(email)}`, p),
  delUser: (email) => req('DELETE', `/api/users/${u(email)}`),
  resetUserPassword: (email) => req('POST', `/api/users/${u(email)}/reset-password`),
  userLink: (email) => req('POST', `/api/users/${u(email)}/token`),
};
