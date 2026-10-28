// 公开只读接口的边缘缓存：用 Cloudflare 自带的 caches.default，不额外发请求、不额外计费。
// 规则：带 Authorization 头的请求（管理后台）绕过缓存直读 D1；其余读缓存、未命中才回源并回填。
// 写操作后调用 purge() 主动失效，避免管理员改完数据还要等 TTL。

const DEFAULT_TTL = 60;

export function hasAuth(request) {
  const h = request.headers.get('Authorization') || '';
  return h.startsWith('Bearer ');
}

function cacheKey(request, path) {
  return new Request(new URL(path, new URL(request.url).origin).toString(), { method: 'GET' });
}

function defaultCache() {
  try {
    return typeof caches !== 'undefined' && caches.default ? caches.default : null;
  } catch (e) {
    return null;
  }
}

// build() 返回要返回的 JSON 对象
export async function cached(request, path, ttlSeconds, build) {
  const cache = defaultCache();
  const bypass = hasAuth(request);

  if (cache && !bypass) {
    const hit = await cache.match(cacheKey(request, path));
    if (hit) return hit;
  }

  const data = await build();
  const ttl = ttlSeconds || DEFAULT_TTL;
  const resp = new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, s-maxage=' + ttl + ', max-age=' + ttl,
    },
  });

  if (cache && !bypass) {
    try {
      await cache.put(cacheKey(request, path), resp.clone());
    } catch (e) {}
  }
  return resp;
}

export async function purge(request, paths) {
  const cache = defaultCache();
  if (!cache) return;
  for (const p of paths) {
    try {
      await cache.delete(cacheKey(request, p));
    } catch (e) {}
  }
}