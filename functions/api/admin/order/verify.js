// POST /api/admin/order/verify —— 核对订单通过，状态置 verified 并清空驳回原因。
import { json, readJson } from '../../../_lib/http.js';
import { currentAdmin } from '../../../_lib/auth.js';
import { adminLog } from '../../../_lib/adminlog.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const admin = await currentAdmin(request, body, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  const oid = body.id || 0;
  await env.DB.prepare("UPDATE orders SET status = 'verified', reject_reason = '' WHERE id = ?").bind(oid).run();
  await adminLog(env, admin, '核对了订单 #' + oid + ' -> 已通过');
  return json({ success: true });
}