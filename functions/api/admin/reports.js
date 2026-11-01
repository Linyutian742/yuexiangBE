// GET /api/admin/reports —— 全部举报，按 id 倒序。
import { json } from '../../_lib/http.js';
import { currentAdmin } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const admin = await currentAdmin(request, null, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  // 兜住 D1 异常：返回可读 JSON，避免整页 500 导致后台静默空白（同 admin/orders.js）。
  let res;
  try {
    res = await env.DB.prepare(
      'SELECT id, reporter_name, target_id, reason, submit_time, status, reject_reason FROM reports ORDER BY id DESC'
    ).all();
  } catch (e) {
    return json({ success: false, msg: '举报读取失败：' + ((e && e.message) || e) }, 500);
  }

  const reports = ((res && res.results) || []).map((r) => ({
    id: r.id || 0,
    reporter_name: r.reporter_name || '',
    target_id: r.target_id || '',
    reason: r.reason || '',
    submit_time: r.submit_time || '',
    status: r.status || '',
    reject_reason: r.reject_reason || '',
  }));

  return json({ success: true, reports });
}