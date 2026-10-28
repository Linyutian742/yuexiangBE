// POST /api/admin/booster/add —— 新增打手信息，成功后失效打手信息缓存。
import { json, readJson } from '../../../_lib/http.js';
import { currentAdmin } from '../../../_lib/auth.js';
import { adminLog } from '../../../_lib/adminlog.js';
import { purge } from '../../../_lib/cache.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const admin = await currentAdmin(request, body, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  const uid = String(body.uid || '');
  const name = String(body.name || '').trim();
  const rank = String(body.rank || '').trim();
  const specialty = String(body.specialty || '').trim();
  const intro = String(body.intro || '').trim();
  if (!name) return json({ success: false, msg: '打手名不能为空' });

  const res = await env.DB.prepare(
    'INSERT INTO booster_info (uid, name, rank, specialty, intro) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(uid, name, rank, specialty, intro)
    .run();
  await adminLog(env, admin, '添加了打手信息 ' + name);
  await purge(request, ['/api/boosters_info']);
  return json({ success: true, id: res.meta ? res.meta.last_row_id : 0 });
}