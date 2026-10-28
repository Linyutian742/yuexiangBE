// POST /api/admin/user/reset_password —— 重置为固定临时密码 123456。
// 改密后密码版本指纹变化，该用户所有旧 JWT 立即失效（等效旧后端清空 token）。
import { json, readJson } from '../../../_lib/http.js';
import { currentAdmin } from '../../../_lib/auth.js';
import { hashPassword } from '../../../_lib/password.js';
import { adminLog } from '../../../_lib/adminlog.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const admin = await currentAdmin(request, body, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  const uid = String(body.uid || '');
  const target = await env.DB.prepare('SELECT uid, username FROM users WHERE uid = ?').bind(uid).first();
  if (!target) return json({ success: false, msg: '用户不存在' });

  const hash = await hashPassword('123456', env);
  await env.DB.prepare('UPDATE users SET password = ? WHERE uid = ?').bind(hash, uid).run();

  await adminLog(env, admin, '重置了 ' + (target.username || '') + '(' + uid + ') 的密码');
  return json({ success: true, msg: '已重置密码，临时密码为: 123456' });
}