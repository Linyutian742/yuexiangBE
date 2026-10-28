// POST /api/admin/product/delete —— 删除商品（旧后端不记 admin 日志）。
import { json, readJson } from '../../../_lib/http.js';
import { currentAdmin } from '../../../_lib/auth.js';
import { purge } from '../../../_lib/cache.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const admin = await currentAdmin(request, body, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(body.id || 0).run();
  await purge(request, ['/api/products']);
  return json({ success: true });
}