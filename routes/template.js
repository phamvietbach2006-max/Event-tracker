import { HttpError } from '../lib/http.js';
import { requireAdmin } from '../lib/perm.js';
import { logActivity } from '../lib/repo.js';
import { getReviewTemplate, setReviewTemplate } from '../lib/db.js';

export function registerTemplate(router) {
  // ── GET /api/template/review: Xem mẫu nhận xét (mọi người đều xem được) ──
  router.add('GET', '/api/template/review', ({ db }) => {
    return getReviewTemplate(db);
  });

  // ── PUT /api/template/review: Cập nhật mẫu nhận xét (chỉ admin) ──
  router.add('PUT', '/api/template/review', ({ db, user, config, body, sse }) => {
    if (!config?.openAccess) {
      requireAdmin(user);
    }
    const content = typeof body?.content === 'string' ? body.content : '';
    const updated = setReviewTemplate(db, content, user);
    logActivity(db, user, null, 'template.update', 'Cập nhật nội dung Mẫu nhận xét kiểm tra Đại hội');
    sse.broadcast();
    return { ok: true, ...updated };
  });
}
