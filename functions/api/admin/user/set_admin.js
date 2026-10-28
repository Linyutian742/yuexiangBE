// POST /api/admin/user/set_admin —— 提权（默认 op_level=2），不能改自己、不能改其他管理员。
import { json, readJson } from '../../../_lib/http.js';
import { currentAdmin } from '../../../_lib/auth.js';
import { adminLog } from '../../../_lib/adminlog.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const admin = await currentAdmin(request, body, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  const uid = String(body.uid || '');
  const opLevel = body.op_level == null ? 2 : Number(body.op_level);
  if (uid === admin.uid) return json({ success: false, msg: '禁止修改自己权限' });

  const target = await env.DB.prepare('SELECT uid, username, op_level FROM users WHERE uid = ?').bind(uid).first();
  if (!target) return json({ success: false, msg: '用户不存在' });
  if (Number(target.op_level || 1) >= 3) return json({ success: false, msg: '禁止修改其他管理员' });

  await env.DB.prepare('UPDATE users SET op_level = ?, tag = ? WHERE uid = ?')
    .bind(opLevel, opLevel >= 2 ? 'op' : 'deop', uid)
    .run();

  const levelText = opLevel === 2 ? '打手(等级2)' : opLevel === 3 ? '管理员(等级3)' : '普通用户(等级1)';
  await adminLog(env, admin, '将 ' + (target.username || '') + '(' + uid + ') 设为 ' + levelText);
  return json({ success: true });
}