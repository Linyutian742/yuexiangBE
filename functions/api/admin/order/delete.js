// POST /api/admin/order/delete —— 删除订单。
import { json, readJson } from '../../../_lib/http.js';
import { currentAdmin } from '../../../_lib/auth.js';
import { adminLog } from '../../../_lib/adminlog.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const admin = await currentAdmin(request, body, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  const oid = body.id || 0;
  await env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(oid).run();
  await adminLog(env, admin, '删除了订单 #' + oid);
  return json({ success: true, msg: '已删除' });
}