// GET /api/admin/applications —— 全部报名，按 id 倒序。
import { json } from '../../_lib/http.js';
import { currentAdmin } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const admin = await currentAdmin(request, null, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  // 兜住 D1 异常：返回可读 JSON，避免整页 500 导致后台静默空白（同 admin/reports.js）。
  let res;
  try {
    res = await env.DB.prepare(
      'SELECT id, uid, username, nickname, game_id, server_area, game_rank, specialty, contact, online_time, intro, submit_time, status, reject_reason, review_admin, review_time FROM applications ORDER BY id DESC'
    ).all();
  } catch (e) {
    return json({ success: false, msg: '报名读取失败：' + ((e && e.message) || e) }, 500);
  }

  const applications = ((res && res.results) || []).map((r) => ({
    id: r.id || 0,
    uid: r.uid || '',
    username: r.username || '',
    nickname: r.nickname || '',
    game_id: r.game_id || '',
    server_area: r.server_area || '',
    game_rank: r.game_rank || '',
    specialty: r.specialty || '',
    contact: r.contact || '',
    online_time: r.online_time || '',
    intro: r.intro || '',
    submit_time: r.submit_time || '',
    status: r.status || '',
    reject_reason: r.reject_reason || '',
    review_admin: r.review_admin || '',
    review_time: r.review_time || '',
  }));

  return json({ success: true, applications });
}