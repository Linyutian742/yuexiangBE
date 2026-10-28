// POST /api/admin/report/handle —— 处理举报：可选同时封禁被举报人，然后标记举报已处理。
import { json, readJson } from '../../../_lib/http.js';
import { currentAdmin } from '../../../_lib/auth.js';
import { adminLog } from '../../../_lib/adminlog.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const admin = await currentAdmin(request, body, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  const rid = body.id || 0;
  const targetId = String(body.target_id || '');

  if (body.ban && targetId) {
    const target = await env.DB.prepare('SELECT uid, username FROM users WHERE uid = ?').bind(targetId).first();
    if (target) {
      await env.DB.prepare("UPDATE users SET status = 'no' WHERE uid = ?").bind(targetId).run();
      await adminLog(env, admin, '通过举报封禁了 ' + (target.username || '') + '(' + targetId + ')');
    }
  }

  await env.DB.prepare("UPDATE reports SET status = 'handled', reject_reason = '' WHERE id = ?").bind(rid).run();
  return json({ success: true });
}