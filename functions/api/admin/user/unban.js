// POST /api/admin/user/unban —— 解封用户。
import { json, readJson } from '../../../_lib/http.js';
import { currentAdmin } from '../../../_lib/auth.js';
import { adminLog } from '../../../_lib/adminlog.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const admin = await currentAdmin(request, body, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  const uid = String(body.uid || '');
  const target = await env.DB.prepare('SELECT uid, username FROM users WHERE uid = ?').bind(uid).first();
  if (!target) return json({ success: false, msg: '用户不存在' });

  await env.DB.prepare("UPDATE users SET status = 'yes' WHERE uid = ?").bind(uid).run();
  await adminLog(env, admin, '解封了 ' + (target.username || '') + '(' + uid + ')');
  return json({ success: true });
}