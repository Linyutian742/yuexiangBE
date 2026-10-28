// 无状态 JWT (HS256)，仅用运行时内置 Web Crypto，无第三方依赖。
// 只在写操作接口内部调用一次 verifyToken，不做中间件、不做轮询校验。

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(str) {
  let s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// 同一 isolate 内密钥不会变，导入结果缓存复用，省掉每次验签/签发的 importKey 开销。
let keyCache = { secret: null, key: null };

async function hmacKey(secret) {
  const s = secret || '';
  if (keyCache.key && keyCache.secret === s) return keyCache.key;
  const key = await crypto.subtle.importKey('raw', enc.encode(s), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
  keyCache = { secret: s, key: key };
  return key;
}

// 默认有效期与服务端原 TOKEN_EXPIRE_HOURS=240 对齐（10 天）
export async function signToken(payload, secret, ttlSeconds = 240 * 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = Object.assign({}, payload, { iat: now, exp: now + ttlSeconds });
  const head = toB64url(enc.encode(JSON.stringify(header)));
  const data = head + '.' + toB64url(enc.encode(JSON.stringify(body)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(data));
  return data + '.' + toB64url(new Uint8Array(sig));
}

// 返回 payload 或 null（签名不符 / 过期 / 结构非法）
export async function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const data = parts[0] + '.' + parts[1];
  let ok = false;
  try {
    ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64url(parts[2]), enc.encode(data));
  } catch (e) {
    return null;
  }
  if (!ok) return null;
  let payload;
  try {
    payload = JSON.parse(dec.decode(fromB64url(parts[1])));
  } catch (e) {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && now > payload.exp) return null;
  return payload;
}