// GET /api/admin/feedback —— 全部反馈，按 id 倒序。
import { json } from '../../_lib/http.js';
import { currentAdmin } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const admin = await currentAdmin(request, null, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  // 兜住 D1 异常：返回可读 JSON，避免整页 500 导致后台静默空白（同 admin/reports.js）。
  let res;
  try {
    res = await env.DB.prepare(
      'SELECT id, uid, username, category, content, contact, submit_time, status, reject_reason FROM feedback ORDER BY id DESC'
    ).all();
  } catch (e) {
    return json({ success: false, msg: '反馈读取失败：' + ((e && e.message) || e) }, 500);
  }

  const feedback = ((res && res.results) || []).map((r) => ({
    id: r.id || 0,
    uid: r.uid || '',
    username: r.username || '',
    category: r.category || '',
    content: r.content || '',
    contact: r.contact || '',
    submit_time: r.submit_time || '',
    status: r.status || '',
    reject_reason: r.reject_reason || '',
  }));

  return json({ success: true, feedback });
}