// GET /api/admin/orders —— 全部订单，按 id 倒序。
import { json } from '../../_lib/http.js';
import { currentAdmin } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const admin = await currentAdmin(request, null, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  const res = await env.DB.prepare(
    'SELECT id, uid, username, product_title, order_no, game_id, server_area, message, designated_booster, booster, status, reject_reason, submit_time FROM orders ORDER BY id DESC'
  ).all();

  const orders = ((res && res.results) || []).map((o) => ({
    id: o.id || 0,
    uid: o.uid || '',
    username: o.username || '',
    product_title: o.product_title || '',
    order_no: o.order_no || '',
    game_id: o.game_id || '',
    server_area: o.server_area || '',
    message: o.message || '',
    designated_booster: o.designated_booster || '',
    accepted_booster: o.booster || '',
    status: o.status || '',
    reject_reason: o.reject_reason || '',
    submit_time: o.submit_time || '',
  }));

  return json({ success: true, orders });
}