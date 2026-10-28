// POST /api/change_password
// 旧后端改密后会清空库里的 token；这里靠 token 内的密码版本指纹达成同样效果：
// 改完密码后所有旧 token 自动失效（下一次鉴权时指纹对不上），无需任何额外存储或请求。
// 验证码只在登录接口要求，本接口不校验（前端改密弹窗也不再加载验证码）。
import { json, readJson } from '../_lib/http.js';
import { currentUser } from '../_lib/auth.js';
import { hashPassword, verifyPassword } from '../_lib/password.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);

  // 接口内验一次登录态（失败提示与旧后端一致：统一「操作失败」）
  const row = await currentUser(request, body, env);
  if (!row) return json({ success: false, msg: '操作失败' }, 401);

  if (String(body.uid || '') !== String(row.uid)) return json({ success: false, msg: '操作失败' });

  if (!(await verifyPassword(String(body.old_password || ''), row.password, env))) {
    return json({ success: false, msg: '操作失败' });
  }

  const newPassword = String(body.new_password || '');
  if (!newPassword) return json({ success: false, msg: '操作失败' });

  const hash = await hashPassword(newPassword, env);
  await env.DB.prepare('UPDATE users SET password = ? WHERE uid = ?').bind(hash, row.uid).run();

  return json({ success: true });
}