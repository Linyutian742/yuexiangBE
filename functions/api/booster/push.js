// GET /api/booster/push?since=<消息id>
// 打手推送通道（App 系统通知的数据源）：只返回「管理后台审核通过时」写给本人的推送记录。
// 鉴权严格限定 OP 等级 = 2 且未封禁：等级 1（普通用户）与等级 3（管理员）一律 403，且不返回任何订单内容。
// since 传上次拿到的最大 id，App 每次只增量拉取；不传则返回最近 50 条。
import { json } from '../../_lib/http.js';
import { currentPushBooster } from '../../_lib/auth.js';

const MAX_ROWS = 50;

export async function onRequestGet({ request, env }) {
  const user = await currentPushBooster(request, null, env);
  if (!user) return json({ success: false, msg: '无权限' }, 403);

  let since = 0;
  try {
    since = parseInt(new URL(request.url).searchParams.get('since') || '0', 10) || 0;
  } catch (e) {}

  const uid = user.uid;
  const [rows, unread, latest] = await Promise.all([
    env.DB.prepare(
      'SELECT p.id, p.order_id, p.title, p.body, p.created_at, p.read_at, ' +
        'o.username, o.product_title, o.game_id, o.server_area, o.message, o.submit_time, o.status AS order_status ' +
        'FROM push_messages p LEFT JOIN orders o ON o.id = p.order_id ' +
        'WHERE p.uid = ? AND p.id > ? ORDER BY p.id ASC LIMIT ' + MAX_ROWS
    )
      .bind(uid, since)
      .all(),
    env.DB.prepare("SELECT COUNT(*) AS c FROM push_messages WHERE uid = ? AND read_at = ''").bind(uid).first(),
    env.DB.prepare('SELECT MAX(id) AS m FROM push_messages WHERE uid = ?').bind(uid).first(),
  ]);

  const messages = ((rows && rows.results) || []).map(function (r) {
    return {
      id: r.id || 0,
      order_id: r.order_id || 0,
      title: r.title || '',
      body: r.body || '',
      created_at: r.created_at || '',
      read: r.read_at ? true : false,
      username: r.username || '',
      product_title: r.product_title || '',
      game_id: r.game_id || '',
      server_area: r.server_area || '',
      message: r.message || '',
      submit_time: r.submit_time || '',
      order_status: r.order_status || '',
    };
  });

  return json({
    success: true,
    op_level: 2,
    since: since,
    unread: unread ? Number(unread.c || 0) : 0,
    last_id: latest && latest.m ? Number(latest.m) : 0,
    messages: messages,
  });
}