// GET /api/boosters_info —— 打手展示页用的公开简介列表，走边缘缓存。
// 原数据在 boosters.json（本地文件），边缘环境无文件系统，改存 D1 表 booster_info。
import { cached } from '../_lib/cache.js';

const TTL = 60;

async function list(env) {
  if (!env.DB) return { success: true, boosters: [] };
  const { results } = await env.DB.prepare(
    'SELECT id, name, rank, specialty, intro FROM booster_info ORDER BY id ASC'
  ).all();
  return { success: true, boosters: results || [] };
}

export async function onRequestGet({ request, env }) {
  return cached(request, '/api/boosters_info', TTL, () => list(env));
}