// POST /api/admin/user/ban —— 封禁用户（不能封禁管理员）。
// 封禁后旧 JWT 在到期前签名仍有效，但各业务接口都会读到 status='no' 并拒绝。
import { json, readJson } from '../../../_lib/http.js';
import { currentAdmin } from '../../../_lib/auth.js';
import { adminLog } from '../../../_lib/adminlog.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const admin = await currentAdmin(request, body, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  const uid = String(body.uid || '');
  const target = await env.DB.prepare('SELECT uid, username, op_level FROM users WHERE uid = ?').bind(uid).first();
  if (!target) return json({ success: false, msg: '用户不存在' });
  if (Number(target.op_level || 1) >= 3) return json({ success: false, msg: '不能封禁管理员账号' });

  await env.DB.prepare("UPDATE users SET status = 'no' WHERE uid = ?").bind(uid).run();
  await adminLog(env, admin, '封禁了 ' + (target.username || '') + '(' + uid + ')');
  return json({ success: true });
}