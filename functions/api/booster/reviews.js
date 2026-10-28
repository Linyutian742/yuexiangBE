// GET /api/booster/reviews
// 当前打手收到的评价（按 booster_uid 精确匹配，与旧后端一致），按 id 倒序。

import { json } from '../../_lib/http.js';
import { currentBooster } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const user = await currentBooster(request, null, env);
  if (!user) return json({ success: false, msg: '无权限' }, 403);

  const res = await env.DB.prepare(
    'SELECT id, order_id, reviewer_name, stars, comment, review_time FROM reviews WHERE booster_uid = ? ORDER BY id DESC'
  )
    .bind(user.uid || '')
    .all();

  const reviews = ((res && res.results) || []).map((rv) => ({
    id: rv.id || 0,
    order_id: rv.order_id || 0,
    reviewer_name: rv.reviewer_name || '',
    stars: rv.stars || 0,
    comment: rv.comment || '',
    review_time: rv.review_time || '',
  }));

  return json({ success: true, reviews });
}