// POST /api/admin/application/reject —— 拒绝报名，理由必填，默认「您不符合我们招收标准」。
import { json, readJson, nowText } from '../../../_lib/http.js';
import { currentAdmin } from '../../../_lib/auth.js';
import { adminLog } from '../../../_lib/adminlog.js';

const DEFAULT_REASON = '您不符合我们招收标准';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const admin = await currentAdmin(request, body, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  const id = body.id || 0;
  if (!id) return json({ success: false, msg: '操作失败' });

  let reason = String(body.reason || '').trim();
  if (!reason) reason = DEFAULT_REASON;

  try {
    await env.DB.prepare(
      "UPDATE applications SET status = 'rejected', reject_reason = ?, review_admin = ?, review_time = ? WHERE id = ?"
    )
      .bind(reason, admin.username || '', nowText(), id)
      .run();
  } catch (e) {
    return json({ success: false, msg: '操作失败：' + ((e && e.message) || e) }, 500);
  }

  await adminLog(env, admin, '拒绝了报名 #' + id + ' 理由: ' + reason);
  return json({ success: true, msg: '已拒绝' });
}