// GET /api/boosters —— 可指定打手下拉用的轻量列表（旧后端只取 op_level == 2 且状态正常的账号）。
// 走边缘缓存；前端 ajaxGet 会对 /api/ 自动加 token，因此已登录用户直读 D1、匿名访客命中缓存。
import { cached } from '../_lib/cache.js';

const TTL = 60;

async function list(env) {
  if (!env.DB) return { success: true, boosters: [] };
  const { results } = await env.DB.prepare(
    "SELECT uid, username FROM users WHERE op_level = 2 AND status = 'yes' ORDER BY created_at"
  ).all();
  const boosters = (results || []).map((u) => ({ uid: u.uid || '', name: u.username || '' }));
  return { success: true, boosters };
}

export async function onRequestGet({ request, env }) {
  return cached(request, '/api/boosters', TTL, () => list(env));
}