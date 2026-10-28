// POST /api/register
// 校验顺序：空值 → 用户名格式 → 重名。
// 验证码只在登录接口要求，本接口不校验（前端注册表单也不再加载验证码）。
// 密码存 PBKDF2-SHA256（WebCrypto 原生），不再产生新的 bcrypt 哈希。
import { json, readJson, nowText } from '../_lib/http.js';
import { newUid } from '../_lib/auth.js';
import { hashPassword } from '../_lib/password.js';

const NAME_RE = /^[\w\u4e00-\u9fff]{2,20}$/;

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const username = String(body.username || '').trim();
  const password = String(body.password || '').trim();

  if (!username || !password) return json({ success: false, msg: '用户名和密码不能为空' });
  if (!NAME_RE.test(username)) {
    return json({ success: false, msg: '用户名只能包含中文、字母、数字和下划线，2-20个字符' });
  }
  if (!env.DB) return json({ success: false, msg: '服务未配置' }, 500);

  // 重名直接拒（旧后端同样只回「验证失败」）
  const dup = await env.DB.prepare('SELECT uid FROM users WHERE username = ?').bind(username).first();
  if (dup) return json({ success: false, msg: '验证失败' });

  const uid = newUid();
  const hash = await hashPassword(password, env);
  await env.DB.prepare(
    'INSERT INTO users (uid, username, password, tag, op_level, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(uid, username, hash, 'deop', 1, 'yes', nowText())
    .run();

  return json({ success: true, msg: '注册成功' });
}