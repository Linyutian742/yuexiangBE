// 密码存储：PBKDF2-SHA256（WebCrypto 原生实现，不占 JS CPU 热点）。
//
// 免费版 Workers 单请求 CPU 上限 10ms，而 PBKDF2 的迭代次数本身就是 CPU 开销：
// 本机实测 100000 次 ≈ 116ms、1000 次 ≈ 1.4ms。所以默认迭代数压到 1000，用「服务端 pepper」补强度：
//     derived = PBKDF2(key = pepper, salt = 随机 16 字节 || 口令, iterations)
//   pepper 当 PBKDF2 的 HMAC 密钥（不是拼进口令），口令放进 salt —— 库被拖走但 pepper 不泄露时，
//   攻击者连一次猜测都无法求值；即使 pepper 泄露，仍要按迭代数逐次爆破。
//
// 存库格式不变：pbkdf2$<迭代数>$<saltBase64>$<hashBase64>
// pepper 取 env.PWD_PEPPER，未配置则回落 env.JWT_SECRET。两者都必须保持稳定：轮换会让所有密码失效。
//
// 旧 bcrypt 哈希（$2a$/$2b$/$2y$）默认不校验：纯 JS bcrypt 单次 ≈ 870ms，免费版必然超限。
// 需要兼容旧账号时设 env.PWD_ALLOW_BCRYPT=1（配合付费计划），登录成功后照旧透明升级为上面的格式。

import { fromBase64, toBase64 } from './base64.js';

// 免费版 10ms 预算下的默认值（本机 ≈1.4ms）；付费计划可通过 PWD_ITERATIONS 调高。
export const DEFAULT_ITERATIONS = 1000;
// 免费版建议上限（本机 ≈4.3ms），超过就该上付费计划了。
export const MAX_FREE_TIER_ITERATIONS = 3000;
// 兜底：拒绝异常迭代数，避免一条脏数据把整个请求的 CPU 烧穿。
const MAX_ITERATIONS = 600000;

const KEY_BITS = 256;
const SALT_BYTES = 16;
const enc = new TextEncoder();

export function iterationsOf(env) {
  const n = parseInt(env && env.PWD_ITERATIONS, 10);
  return Number.isFinite(n) && n >= 1 && n <= MAX_ITERATIONS ? n : DEFAULT_ITERATIONS;
}

export function pepperOf(env) {
  return String((env && (env.PWD_PEPPER || env.JWT_SECRET)) || '');
}

export function allowLegacyBcrypt(env) {
  const v = env && env.PWD_ALLOW_BCRYPT;
  return v === '1' || v === 'true' || v === true;
}

function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// 同一 isolate 内 pepper 不会变，导入的密钥直接缓存，省掉每次请求的 importKey。
let keyCache = { pepper: null, key: null };

async function pbkdf2Key(pepper) {
  if (keyCache.key && keyCache.pepper === pepper) return keyCache.key;
  const key = await crypto.subtle.importKey('raw', enc.encode(pepper), 'PBKDF2', false, ['deriveBits']);
  keyCache = { pepper: pepper, key: key };
  return key;
}

// salt 输入 = 随机盐 || 口令字节
function saltInput(salt, password) {
  const pw = enc.encode(String(password));
  const out = new Uint8Array(salt.length + pw.length);
  out.set(salt, 0);
  out.set(pw, salt.length);
  return out;
}

async function derive(password, salt, iterations, pepper) {
  const key = await pbkdf2Key(pepper);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltInput(salt, password), iterations: iterations, hash: 'SHA-256' },
    key,
    KEY_BITS
  );
  return new Uint8Array(bits);
}

// 旧后端 auth.py 用的是 bcrypt（$2b$12$...）
export function isLegacyHash(stored) {
  return /^\$2[aby]\$/.test(String(stored || ''));
}

export function isPbkdf2Hash(stored) {
  return String(stored || '').startsWith('pbkdf2$');
}

// 格式：pbkdf2$<迭代数>$<saltBase64>$<hashBase64>
export async function hashPassword(password, env) {
  const iterations = iterationsOf(env);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const bits = await derive(password, salt, iterations, pepperOf(env));
  return 'pbkdf2$' + iterations + '$' + toBase64(salt) + '$' + toBase64(bits);
}

export async function verifyPassword(password, stored, env) {
  const s = String(stored || '');
  if (isPbkdf2Hash(s)) {
    const parts = s.split('$');
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1], 10);
    if (!iterations || iterations < 1 || iterations > MAX_ITERATIONS) return false;
    let salt;
    let want;
    try {
      salt = fromBase64(parts[2]);
      want = fromBase64(parts[3]);
    } catch (e) {
      return false;
    }
    if (salt.length !== SALT_BYTES || want.length !== KEY_BITS / 8) return false;
    const got = await derive(password, salt, iterations, pepperOf(env));
    return sameBytes(got, want);
  }

  if (isLegacyHash(s)) {
    // 默认关闭：这段是纯 JS 实现，单次 ~870ms，免费版一定超 CPU 上限。
    if (!allowLegacyBcrypt(env)) return false;
    const bcrypt = (await import('./bcrypt.js')).default;
    return bcrypt.compareSync(String(password), s) === true;
  }

  return false;
}