// POST /api/admin/application/delete —— 删除报名。
import { json, readJson } from '../../../_lib/http.js';
import { currentAdmin } from '../../../_lib/auth.js';
import { adminLog } from '../../../_lib/adminlog.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const admin = await currentAdmin(request, body, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  const id = body.id || 0;
  if (!id) return json({ success: false, msg: '操作失败' });

  try {
    await env.DB.prepare('DELETE FROM applications WHERE id = ?').bind(id).run();
  } catch (e) {
    return json({ success: false, msg: '操作失败：' + ((e && e.message) || e) }, 500);
  }

  await adminLog(env, admin, '删除了报名 #' + id);
  return json({ success: true, msg: '已删除' });
}