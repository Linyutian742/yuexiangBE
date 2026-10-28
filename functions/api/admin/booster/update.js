// POST /api/admin/booster/update —— 按 id 更新打手信息，不影响行时报「打手信息不存在」。
import { json, readJson } from '../../../_lib/http.js';
import { currentAdmin } from '../../../_lib/auth.js';
import { adminLog } from '../../../_lib/adminlog.js';
import { purge } from '../../../_lib/cache.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const admin = await currentAdmin(request, body, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  const bid = body.id || 0;
  const name = String(body.name || '').trim();
  const rank = String(body.rank || '').trim();
  const specialty = String(body.specialty || '').trim();
  const intro = String(body.intro || '').trim();

  const res = await env.DB.prepare(
    'UPDATE booster_info SET name = ?, rank = ?, specialty = ?, intro = ? WHERE id = ?'
  )
    .bind(name, rank, specialty, intro, bid)
    .run();
  const changes = res.meta ? res.meta.changes : 0;
  if (!changes) return json({ success: false, msg: '打手信息不存在' });

  await adminLog(env, admin, '更新了打手信息 #' + bid);
  await purge(request, ['/api/boosters_info']);
  return json({ success: true });
}