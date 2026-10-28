// POST /api/admin/user/add —— 管理员新建普通用户（tag=deop, op_level=1）。
import { json, readJson, nowText } from '../../../_lib/http.js';
import { currentAdmin, newUid } from '../../../_lib/auth.js';
import { hashPassword } from '../../../_lib/password.js';
import { adminLog } from '../../../_lib/adminlog.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const admin = await currentAdmin(request, body, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  const username = String(body.username || '').trim();
  const password = String(body.password || '').trim();
  if (!username || !password) return json({ success: false, msg: '用户名和密码不能为空' });
  if (!/^[\w\u4e00-\u9fff]{2,20}$/.test(username)) return json({ success: false, msg: '用户名包含非法字符' });

  const dup = await env.DB.prepare('SELECT uid FROM users WHERE username = ?').bind(username).first();
  if (dup) return json({ success: false, msg: '用户名已存在' });

  const uid = newUid();
  const hash = await hashPassword(password, env);
  await env.DB.prepare(
    'INSERT INTO users (uid, username, password, tag, op_level, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(uid, username, hash, 'deop', 1, 'yes', nowText())
    .run();

  await adminLog(env, admin, '添加了用户 ' + username + '(' + uid + ')');
  return json({ success: true, uid: uid });
}