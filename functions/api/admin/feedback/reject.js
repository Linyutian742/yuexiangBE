// POST /api/admin/feedback/reject —— 驳回反馈，理由必填，默认「反馈不实」。
import { json, readJson } from '../../../_lib/http.js';
import { currentAdmin } from '../../../_lib/auth.js';
import { adminLog } from '../../../_lib/adminlog.js';

const DEFAULT_REASON = '反馈不实';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const admin = await currentAdmin(request, body, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return json({ success: false, msg: '操作失败' });

  let reason = String(body.reason || '').trim();
  if (!reason) reason = DEFAULT_REASON;

  try {
    await env.DB.prepare("UPDATE feedback SET status = 'rejected', reject_reason = ? WHERE id = ?")
      .bind(reason, id)
      .run();
  } catch (e) {
    return json({ success: false, msg: '操作失败：' + ((e && e.message) || e) }, 500);
  }

  await adminLog(env, admin, '驳回了反馈 #' + id + ' 理由: ' + reason);
  return json({ success: true, msg: '已驳回' });
}