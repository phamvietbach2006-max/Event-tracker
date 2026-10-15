export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function req(method, path, body, timeoutMs = 15000) {
  const signal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined;
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || /timeout|aborted|signal/i.test(err.message)) {
      throw new ApiError(408, 'timeout', 'Quá thời gian kết nối (timeout). Hệ thống có thể đang xử lý dữ liệu lớn, vui lòng thử lại hoặc tải lại trang.');
    }
    throw err;
  }
  const t = await res.text();
  let data = null;
  try { data = t ? JSON.parse(t) : null; } catch { /* body không phải JSON */ }
  if (!res.ok) throw new ApiError(res.status, data?.error ?? 'error', data?.message ?? `Lỗi ${res.status}`);
  return data;
}

const u = encodeURIComponent;

export const api = {
  state: async () => {
    return await req('GET', '/api/state', undefined, 12000);
  },
  contacts: async () => {
    return await req('GET', '/api/contacts', undefined, 15000);
  },
  me: async () => {
    try {
      return await req('GET', '/api/me', undefined, 25000);
    } catch {
      return null;
    }
  },
  login: (email, password) => req('POST', '/api/auth/login', { email, password }),
  changePassword: (oldPassword, newPassword) => req('POST', '/api/auth/change-password', { oldPassword, newPassword }),
  logout: () => req('POST', '/auth/logout'),
  setStatus: (id, status, force = false, note = undefined) => req('PATCH', `/api/rooms/${id}/status`, { status, force, ...(note !== undefined ? { note } : {}) }),
  setAttendance: (id, attendees, totalMembers) => req('PATCH', `/api/rooms/${id}/attendance`, { attendees, totalMembers }),
  setNote: (id, note) => req('PATCH', `/api/rooms/${id}/note`, { note }),
  setTask: (id, state) => req('PATCH', `/api/tasks/${id}`, state === undefined ? {} : { state }),
  lockRoom: (id) => req('POST', `/api/rooms/${id}/lock`),
  unlockRoom: (id) => req('POST', `/api/rooms/${id}/unlock`),
  logs: (params = {}) => {
    const cleanParams = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''));
    const qs = new URLSearchParams(cleanParams).toString();
    return req('GET', `/api/admin/logs${qs ? '?' + qs : ''}`);
  },
  // quản trị
  addGroup: (name) => req('POST', '/api/groups', { name }),
  patchGroup: (id, p) => req('PATCH', `/api/groups/${id}`, p),
  delGroup: (id, force = false) => req('DELETE', `/api/groups/${id}${force ? '?force=1' : ''}`),
  importUnit: (payload) => req('POST', '/api/units/import', payload, 120000),
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
  // thông báo hệ thống
  notifications: () => req('GET', '/api/notifications'),
  notificationTargets: () => req('GET', '/api/notifications/targets'),
  sendNotification: (data) => req('POST', '/api/notifications', data),
  readNotification: (id) => req('POST', `/api/notifications/${id}/read`),
  readAllNotifications: () => req('POST', '/api/notifications/read-all'),
  // phê duyệt ngoại lệ sĩ số
  requestQuorumExemption: (roomId, targetType, attendees, totalMembers) =>
    req('POST', `/api/rooms/${roomId}/quorum-request`, { targetType, attendees, totalMembers }),
  pendingQuorumRequests: () => req('GET', '/api/quorum-requests/pending'),
  decideQuorumRequest: (id, decision) => req('POST', `/api/quorum-requests/${id}/decision`, { decision }),
  quorumStatus: (roomId) => req('GET', `/api/rooms/${roomId}/quorum-status`),
  // mẫu nhận xét kiểm tra
  getReviewTemplate: () => req('GET', '/api/template/review'),
  setReviewTemplate: (content) => req('PUT', '/api/template/review', { content }),
};
