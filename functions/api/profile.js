// GET /api/profile
// 一次鉴权读 users 行 → 一次读订单（含评价子查询）→ 一次读举报，共 3 次 D1 读，无写。
// 响应字段与旧后端逐字对齐，前端 profile.html 不改。
import { json } from '../_lib/http.js';
import { currentUser } from '../_lib/auth.js';

const ORDER_SQL =
  'SELECT o.id, o.product_title, o.status, o.reject_reason, o.submit_time, o.designated_booster, o.booster, ' +
  '(SELECT uid FROM users WHERE username = o.booster) AS booster_uid, ' +
  '(SELECT id FROM reviews WHERE order_id = o.id) AS review_id, ' +
  '(SELECT stars FROM reviews WHERE order_id = o.id) AS review_stars ' +
  'FROM orders o WHERE o.uid = ? ORDER BY o.id DESC';

export async function onRequestGet({ request, env }) {
  const row = await currentUser(request, {}, env);
  if (!row) return json({ success: false, msg: '未登录' }, 401);
  if (row.status !== 'yes') return json({ success: false, msg: '账号已封禁' }, 403);

  const orders = await env.DB.prepare(ORDER_SQL).bind(row.uid).all();
  const reports = await env.DB.prepare(
    'SELECT id, target_id, reason, submit_time, status, reject_reason FROM reports WHERE reporter_name = ? ORDER BY id DESC'
  )
    .bind(row.username)
    .all();

  const mappedOrders = (orders.results || []).map((o) => {
    const hasReview = o.review_id !== null && o.review_id !== undefined;
    return {
      id: o.id,
      product_title: o.product_title || '',
      status: o.status || '',
      reject_reason: o.reject_reason || '',
      submit_time: o.submit_time || '',
      designated_booster: o.designated_booster || '',
      accepted_booster: o.booster || '',
      booster_uid: o.booster_uid || '',
      can_review: o.status === 'completed' && !!o.booster && !hasReview,
      has_review: hasReview,
      review_stars: hasReview ? o.review_stars || 0 : 0,
    };
  });

  const mappedReports = (reports.results || []).map((r) => ({
    id: r.id,
    target_id: r.target_id || '',
    reason: r.reason || '',
    submit_time: r.submit_time || '',
    status: r.status || '',
    reject_reason: r.reject_reason || '',
  }));

  return json({
    success: true,
    profile: {
      username: row.username,
      uid: row.uid,
      reg_time: row.created_at || '',
      status: row.status || 'yes',
      tag: row.tag || 'deop',
      op_level: Number(row.op_level || 1),
    },
    orders: mappedOrders,
    reports: mappedReports,
  });
}