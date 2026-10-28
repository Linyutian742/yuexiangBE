// POST /api/order/review
// 校验顺序与旧后端逐条一致：参数缺失 → 评分非法 → 评分范围 → 订单归属与状态 → 打手匹配 → 是否已评价。
// 鉴权在接口内一次完成；评价一旦写入，订单的 has_review 随 profile 查询自然生效。
import { json, readJson, nowText } from '../../_lib/http.js';
import { currentUser } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);

  const user = await currentUser(request, body, env);
  if (!user) return json({ success: false, msg: '未登录' }, 401);

  const orderId = /^\d+$/.test(String(body.order_id || '')) ? parseInt(String(body.order_id), 10) : 0;
  const rawStars = body.stars;
  const comment = String(body.comment || '').trim();
  const boosterName = String(body.booster_name || '').trim();
  let boosterUid = String(body.booster_uid || '').trim();

  if (!orderId || rawStars === 0 || rawStars === '0' || rawStars === '' || rawStars == null || !boosterName) {
    return json({ success: false, msg: '参数缺失' });
  }

  let stars;
  if (typeof rawStars === 'number') stars = Math.trunc(rawStars);
  else if (/^-?\d+$/.test(String(rawStars).trim())) stars = parseInt(String(rawStars).trim(), 10);
  else return json({ success: false, msg: '评分无效' });
  if (stars < 1 || stars > 5) return json({ success: false, msg: '评分必须在1-5之间' });

  // 订单必须属于本人且已完成
  const order = await env.DB.prepare('SELECT id, status, booster FROM orders WHERE id = ? AND uid = ?')
    .bind(orderId, user.uid)
    .first();
  if (!order) return json({ success: false, msg: '订单不存在' });
  if (order.status !== 'completed') return json({ success: false, msg: '订单未完成，无法评价' });
  if (String(order.booster || '') !== boosterName) return json({ success: false, msg: '打手信息不匹配' });

  const dup = await env.DB.prepare('SELECT id FROM reviews WHERE order_id = ?').bind(orderId).first();
  if (dup) return json({ success: false, msg: '该订单已评价' });

  if (!boosterUid) {
    const bu = await env.DB.prepare('SELECT uid FROM users WHERE username = ?').bind(boosterName).first();
    if (bu) boosterUid = bu.uid || '';
  }

  const res = await env.DB.prepare(
    'INSERT INTO reviews (order_id, reviewer_name, reviewer_uid, booster_name, booster_uid, stars, comment, review_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(orderId, user.username || '', user.uid || '', boosterName, boosterUid, stars, comment, nowText())
    .run();

  return json({ success: true, review_id: (res.meta && res.meta.last_row_id) || 0 });
}