// POST /api/admin/order/reject —— 驳回订单，默认理由「支付信息不实」。
import { json, readJson } from '../../../_lib/http.js';
import { currentAdmin } from '../../../_lib/auth.js';
import { adminLog } from '../../../_lib/adminlog.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const admin = await currentAdmin(request, body, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  const oid = body.id || 0;
  let reason = String(body.reason || '').trim();
  if (!reason) reason = '支付信息不实';

  await env.DB.prepare("UPDATE orders SET status = 'rejected', reject_reason = ? WHERE id = ?")
    .bind(reason, oid)
    .run();
  await adminLog(env, admin, '驳回了订单 #' + oid + ' 理由: ' + reason);
  return json({ success: true, msg: '已驳回' });
}