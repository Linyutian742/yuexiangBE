// GET /api/booster/orders
// 打手工作台：可接订单（全库 status=verified，与旧后端一致，不限指定打手）+ 我已接订单。
// 鉴权在当前接口内一次完成，不额外发校验请求。

import { json } from '../../_lib/http.js';
import { currentBooster } from '../../_lib/auth.js';

const COLS =
  'id, username, product_title, game_id, server_area, message, designated_booster, status, submit_time';

function mapOrder(o) {
  return {
    id: o.id || 0,
    username: o.username || '',
    product_title: o.product_title || '',
    game_id: o.game_id || '',
    server_area: o.server_area || '',
    message: o.message || '',
    designated_booster: o.designated_booster || '',
    status: o.status || '',
    submit_time: o.submit_time || '',
  };
}

export async function onRequestGet({ request, env }) {
  const user = await currentBooster(request, null, env);
  if (!user) return json({ success: false, msg: '无权限' }, 403);

  const [avail, mine] = await Promise.all([
    env.DB.prepare('SELECT ' + COLS + " FROM orders WHERE status = 'verified' ORDER BY id DESC").all(),
    env.DB.prepare('SELECT ' + COLS + ' FROM orders WHERE booster = ? ORDER BY id DESC')
      .bind(user.username || '')
      .all(),
  ]);

  return json({
    success: true,
    available: ((avail && avail.results) || []).map(mapOrder),
    my_orders: ((mine && mine.results) || []).map(mapOrder),
  });
}