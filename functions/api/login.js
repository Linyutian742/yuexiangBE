// POST /api/login
// 顺序与旧后端一致：验证码 → 查用户 → 查状态 → 验密码。
// 登录成功签发无状态 JWT（含密码版本指纹），不写库、不设轮询校验。
// 旧 bcrypt 账号首次登录成功时透明升级为 PBKDF2（一次性，纯 JS bcrypt 很耗 CPU，升级后彻底摆脱）。
import { verifyCaptcha } from '../_lib/captcha.js';
import { json, readJson } from '../_lib/http.js';
import { signToken } from '../_lib/jwt.js';
import { pwdPrint } from '../_lib/auth.js';
import { hashPassword, verifyPassword, isLegacyHash } from '../_lib/password.js';

const COLS = 'uid, username, password, tag, op_level, status, created_at';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const username = String(body.username || '').trim();
  const password = String(body.password || '').trim();

  if (!env.DB) return json({ success: false, msg: '服务未配置' }, 500);

  // 1) 验证码：无状态，一次校验，不落库
  if (!(await verifyCaptcha(body.captcha_session, body.captcha_answer, env.JWT_SECRET))) {
    return json({ success: false, msg: '验证失败' });
  }

  // 2) 一次 D1 读：用户行（含封禁状态与密码）
  const row = await env.DB.prepare('SELECT ' + COLS + ' FROM users WHERE username = ?')
    .bind(username)
    .first();
  if (!row || row.status !== 'yes') return json({ success: false, msg: '验证失败' });
  if (!(await verifyPassword(password, row.password, env))) return json({ success: false, msg: '验证失败' });

  // 3) 旧 bcrypt 哈希透明升级（仅第一次，失败不影响登录本身）。
  //    免费版默认不开 bcrypt 校验（PWD_ALLOW_BCRYPT），此时走不到这里；开了才会走到。
  let stored = String(row.password || '');
  if (isLegacyHash(stored)) {
    try {
      const upgraded = await hashPassword(password, env);
      await env.DB.prepare('UPDATE users SET password = ? WHERE uid = ?').bind(upgraded, row.uid).run();
      stored = upgraded;
    } catch (e) {}
  }

  // 4) 签发 token：改密/重置后 pwv 变化，旧 token 自动失效，无需任何额外请求
  const payload = {
    uid: row.uid,
    username: row.username,
    tag: row.tag || 'deop',
    op_level: Number(row.op_level || 1),
    pwv: pwdPrint(stored),
  };
  const token = await signToken(payload, env.JWT_SECRET);

  return json({
    success: true,
    user: {
      username: row.username,
      uid: row.uid,
      token,
      tag: row.tag || 'deop',
      op_level: Number(row.op_level || 1),
    },
  });
}