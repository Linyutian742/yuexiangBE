// POST /api/booster/accept
// 打手接单：仅 verified 可接，接后状态 accepted 并写入接单打手。
// 用条件 UPDATE 保证并发下同一订单不会被两人接走（等效旧后端文件锁语义）。

import { json, readJson } from '../../_lib/http.js';
import { currentBooster } from '../../_lib/auth.js';

const FAIL = { success: false, msg: '接单失败，订单可能已被接或状态不符' };

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const user = await currentBooster(request, body, env);
  if (!user) return json({ success: false, msg: '无权限' }, 403);

  const oid = parseInt(String(body.id || ''), 10);
  if (!oid) return json(FAIL);

  const res = await env.DB.prepare(
    "UPDATE orders SET status = 'accepted', booster = ? WHERE id = ? AND status = 'verified'"
  )
    .bind(user.username || '', oid)
    .run();

  const changed = res && res.meta ? Number(res.meta.changes || 0) : 0;
  return changed > 0 ? json({ success: true, msg: '接单成功' }) : json(FAIL);
}