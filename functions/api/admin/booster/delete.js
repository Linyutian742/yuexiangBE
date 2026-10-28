// POST /api/admin/booster/delete —— 删除打手信息，成功后失效打手信息缓存。
import { json, readJson } from '../../../_lib/http.js';
import { currentAdmin } from '../../../_lib/auth.js';
import { adminLog } from '../../../_lib/adminlog.js';
import { purge } from '../../../_lib/cache.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const admin = await currentAdmin(request, body, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  const bid = body.id || 0;
  await env.DB.prepare('DELETE FROM booster_info WHERE id = ?').bind(bid).run();
  await adminLog(env, admin, '删除了打手信息 #' + bid);
  await purge(request, ['/api/boosters_info']);
  return json({ success: true });
}