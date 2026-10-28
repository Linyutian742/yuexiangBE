// POST /api/admin/product/add —— 新增商品（旧后端不记 admin 日志）。
import { json, readJson, nowText } from '../../../_lib/http.js';
import { currentAdmin } from '../../../_lib/auth.js';
import { purge } from '../../../_lib/cache.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const admin = await currentAdmin(request, body, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  const title = String(body.title || '').trim();
  const price = String(body.price || '').trim();
  const description = String(body.description || '').trim();
  if (!title || !price) return json({ success: false, msg: '标题和价格不能为空' });

  const res = await env.DB.prepare(
    'INSERT INTO products (title, price, description, created_at) VALUES (?, ?, ?, ?)'
  )
    .bind(title, price, description, nowText().slice(0, 16))
    .run();
  await purge(request, ['/api/products']);
  return json({ success: true, id: res.meta ? res.meta.last_row_id : 0 });
}