// GET /api/application/mine
// 读本人最近一条报名记录：鉴权读一次 users 行 → 读一次 applications，共 2 次 D1 读，无写。
// 报名表可能还没建（D1 控制台未执行建表脚本），这里兜住异常返回可读 JSON，避免个人主页整页 500。
import { json } from '../../_lib/http.js';
import { currentUser } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const row = await currentUser(request, {}, env);
  if (!row) return json({ success: false, msg: '未登录' }, 401);
  if (row.status !== 'yes') return json({ success: false, msg: '账号已封禁' }, 403);

  let res;
  try {
    res = await env.DB.prepare(
      'SELECT id, uid, username, nickname, game_id, server_area, game_rank, specialty, contact, online_time, intro, submit_time, status, reject_reason, review_admin, review_time FROM applications WHERE uid = ? ORDER BY id DESC LIMIT 1'
    )
      .bind(row.uid)
      .first();
  } catch (e) {
    return json({ success: true, application: null, application_error: '报名信息读取失败：' + ((e && e.message) || e) });
  }

  const application = res
    ? {
        id: res.id || 0,
        nickname: res.nickname || '',
        game_id: res.game_id || '',
        server_area: res.server_area || '',
        game_rank: res.game_rank || '',
        specialty: res.specialty || '',
        contact: res.contact || '',
        online_time: res.online_time || '',
        intro: res.intro || '',
        submit_time: res.submit_time || '',
        status: res.status || 'pending',
        reject_reason: res.reject_reason || '',
        review_time: res.review_time || '',
      }
    : null;

  return json({ success: true, application, application_error: '' });
}