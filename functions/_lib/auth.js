// 接口内一次性鉴权：验签 → 读一行 users → 比对密码版本指纹。
// 不设中间件、不设独立校验接口，只有需要登录态的接口在内部调用一次。

import { verifyToken } from './jwt.js';
import { bearer } from './http.js';

const USER_COLS = 'uid, username, password, tag, op_level, status, created_at';

// 新账号 uid：沿用旧后端生成方式（128 位随机整数的前 10 位数字）。
export function newUid() {
  const hex = crypto.randomUUID().replace(/-/g, '');
  return BigInt('0x' + hex).toString().slice(0, 10);
}

// 密码版本指纹：取存库哈希尾部 12 字符。
// 改密/重置密码后指纹变化，旧 token 立刻失效，等效旧后端「清空 token」，但无需额外存储。
export function pwdPrint(stored) {
  const s = String(stored || '');
  return s.length <= 12 ? s : s.slice(-12);
}

// 返回用户行或 null（token 无效 / 用户不存在 / 密码已改）。被封禁的用户仍会返回行，由调用方决定提示。
export async function currentUser(request, body, env) {
  const claims = await verifyToken(bearer(request, body), env.JWT_SECRET);
  if (!claims || !claims.uid) return null;
  const row = await env.DB.prepare('SELECT ' + USER_COLS + ' FROM users WHERE uid = ?')
    .bind(claims.uid)
    .first();
  if (!row) return null;
  if (pwdPrint(row.password) !== String(claims.pwv || '')) return null;
  return row;
}

// 打手/半管理：op_level >= 2（与旧后端一致，不要求 == 2）
export async function currentBooster(request, body, env) {
  const u = await currentUser(request, body, env);
  if (!u || u.status !== 'yes') return null;
  if (Number(u.op_level || 1) < 2) return null;
  return u;
}

// 管理员：op_level >= 3
export async function currentAdmin(request, body, env) {
  const u = await currentUser(request, body, env);
  if (!u || u.status !== 'yes') return null;
  if (Number(u.op_level || 1) < 3) return null;
  return u;
}