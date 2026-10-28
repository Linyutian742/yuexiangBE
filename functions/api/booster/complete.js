// POST /api/booster/complete
// 打手完工：仅本人接的 accepted 订单可完成（旧后端 complete_order 同时校验状态与归属）。

import { json, readJson } from '../../_lib/http.js';
import { currentBooster } from '../../_lib/auth.js';

const FAIL = { success: false, msg: '操作失败，订单状态不符或无权操作他人订单' };

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const user = await currentBooster(request, body, env);
  if (!user) return json({ success: false, msg: '无权限' }, 403);

  const oid = parseInt(String(body.id || ''), 10);
  if (!oid) return json(FAIL);

  const res = await env.DB.prepare(
    "UPDATE orders SET status = 'completed' WHERE id = ? AND status = 'accepted' AND booster = ?"
  )
    .bind(oid, user.username || '')
    .run();

  const changed = res && res.meta ? Number(res.meta.changes || 0) : 0;
  return changed > 0 ? json({ success: true, msg: '已标记完成' }) : json(FAIL);
}