// GET /api/products —— 公开商品列表，走 caches.default 边缘缓存（TTL 60s）。
// 前端带 token 时自动绕过缓存（管理员后台读最新），匿名访客命中缓存时 0 次 D1 读。
// POST /api/products 与旧后端行为一致：同样只是返回列表，不消耗写额度。
import { cached } from '../_lib/cache.js';
import { json } from '../_lib/http.js';

const TTL = 60;

async function list(env) {
  if (!env.DB) return { success: true, products: [] };
  const { results } = await env.DB.prepare(
    'SELECT id, title, price, description FROM products ORDER BY id DESC'
  ).all();
  return { success: true, products: results || [] };
}

export async function onRequestGet({ request, env }) {
  return cached(request, '/api/products', TTL, () => list(env));
}

export async function onRequestPost({ request, env }) {
  const body = await request.clone().json().catch(() => ({}));
  if (!body || typeof body !== 'object') return json({ success: true, products: [] });
  return cached(request, '/api/products', TTL, () => list(env));
}