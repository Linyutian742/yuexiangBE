// POST /api/admin/user/revoke_admin —— 撤销打手/管理员权限，降回普通用户。
import { json, readJson } from '../../../_lib/http.js';
import { currentAdmin } from '../../../_lib/auth.js';
import { adminLog } from '../../../_lib/adminlog.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const admin = await currentAdmin(request, body, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  const uid = String(body.uid || '');
  if (uid === admin.uid) return json({ success: false, msg: '禁止撤销自己' });

  const target = await env.DB.prepare('SELECT uid, username, op_level FROM users WHERE uid = ?').bind(uid).first();
  if (!target) return json({ success: false, msg: '用户不存在' });
  if (Number(target.op_level || 1) < 2) return json({ success: false, msg: '该用户不是管理员/打手' });

  await env.DB.prepare("UPDATE users SET op_level = 1, tag = 'deop' WHERE uid = ?").bind(uid).run();
  await adminLog(env, admin, '撤销了 ' + (target.username || '') + '(' + uid + ') 的权限');
  return json({ success: true });
}