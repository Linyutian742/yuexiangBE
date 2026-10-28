// GET /api/admin/reviews —— 全部评价（含打手名），按 id 倒序。
import { json } from '../../_lib/http.js';
import { currentAdmin } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const admin = await currentAdmin(request, null, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  const res = await env.DB.prepare(
    'SELECT id, order_id, reviewer_name, booster_name, stars, comment, review_time FROM reviews ORDER BY id DESC'
  ).all();

  const reviews = ((res && res.results) || []).map((rv) => ({
    id: rv.id || 0,
    order_id: rv.order_id || 0,
    reviewer_name: rv.reviewer_name || '',
    booster_name: rv.booster_name || '',
    stars: rv.stars || 0,
    comment: rv.comment || '',
    review_time: rv.review_time || '',
  }));

  return json({ success: true, reviews });
}