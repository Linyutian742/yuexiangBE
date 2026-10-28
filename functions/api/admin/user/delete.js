// POST /api/admin/user/delete —— 删除用户（不能删自己、不能删管理员）。
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
  if (uid === admin.uid) return json({ success: false, msg: '不能删除自己' });
  if (Number(target.op_level || 1) >= 3) return json({ success: false, msg: '不能删除管理员账号' });

  await env.DB.prepare('DELETE FROM users WHERE uid = ?').bind(uid).run();
  await adminLog(env, admin, '删除了用户 ' + (target.username || '') + '(' + uid + ')');
  return json({ success: true });
}