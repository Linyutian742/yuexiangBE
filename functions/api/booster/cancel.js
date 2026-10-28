// POST /api/booster/cancel
// 打手取消：本人接的 accepted 订单退回 verified 池并清空接单打手（与旧后端一致）。

import { json, readJson } from '../../_lib/http.js';
import { currentBooster } from '../../_lib/auth.js';

const FAIL = { success: false, msg: '取消失败，订单状态不符' };

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const user = await currentBooster(request, body, env);
  if (!user) return json({ success: false, msg: '无权限' }, 403);

  const oid = parseInt(String(body.id || ''), 10);
  if (!oid) return json(FAIL);

  const res = await env.DB.prepare(
    "UPDATE orders SET status = 'verified', booster = '' WHERE id = ? AND status = 'accepted' AND booster = ?"
  )
    .bind(oid, user.username || '')
    .run();

  const changed = res && res.meta ? Number(res.meta.changes || 0) : 0;
  return changed > 0 ? json({ success: true, msg: '已取消订单' }) : json(FAIL);
}