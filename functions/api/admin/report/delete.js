// POST /api/admin/report/delete —— 删除举报。
import { json, readJson } from '../../../_lib/http.js';
import { currentAdmin } from '../../../_lib/auth.js';
import { adminLog } from '../../../_lib/adminlog.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const admin = await currentAdmin(request, body, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  const rid = body.id || 0;
  await env.DB.prepare('DELETE FROM reports WHERE id = ?').bind(rid).run();
  await adminLog(env, admin, '删除了举报 #' + rid);
  return json({ success: true, msg: '已删除' });
}