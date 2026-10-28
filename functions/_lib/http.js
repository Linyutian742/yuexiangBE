// 极小工具层：统一 JSON 响应、请求体解析、token 提取。
// 前后端同域名，无需 CORS 头与预检处理。

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: Object.assign({ 'content-type': 'application/json; charset=utf-8' }, extra),
  });
}

export async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : {};
  } catch (e) {
    return {};
  }
}

// 前端 ajaxPost 把 token 放 body；同时兼容 Authorization 头与 query，便于接口自测。
export function bearer(request, body) {
  if (body && typeof body.token === 'string' && body.token) return body.token;
  const h = request.headers.get('Authorization') || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  try {
    const t = new URL(request.url).searchParams.get('token');
    if (t) return t;
  } catch (e) {}
  return null;
}

// 本地时间字符串（与原 JSON 库 '%Y-%m-%d %H:%M:%S' 一致，取自 UTC+8）
export function nowText() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

// 文件夹名用的时间戳（对应原后端的 '%Y-%m-%d_%H-%M-%S'）
export function stampText() {
  return nowText().replace(' ', '_').replace(/:/g, '-');
}