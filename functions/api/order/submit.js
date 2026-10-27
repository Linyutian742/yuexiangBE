// POST /api/order/submit
// 与举报接口同模式：验一次 JWT → 校验账户状态 → 写 D1 → 返回。
// 图片在本步不做服务端处理：只接前端直传 R2 后的对象名 screenshot_key（第 4 步接入）。
import { verifyToken } from '../../_lib/jwt.js';
import { json, readJson, bearer, nowText } from '../../_lib/http.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);

  // 1) 接口内验一次登录态
  const claims = await verifyToken(bearer(request, body), env.JWT_SECRET);
  if (!claims) return json({ success: false, msg: '未登录' }, 401);

  // 2) 维护开关走环境变量，避免每次请求多读一份配置
  if (env.MAINTENANCE === '1' || env.MAINTENANCE === 'true') {
    return json({ success: false, msg: '服务器维护中' }, 503);
  }

  // 3) 封禁校验：只读一行状态（写入前必须拦下被封账号）
  const row = await env.DB.prepare('SELECT status FROM users WHERE uid = ?')
    .bind(claims.uid)
    .first();
  if (!row) return json({ success: false, msg: '未登录' }, 401);
  if (row.status !== 'yes') return json({ success: false, msg: '账号已封禁' }, 403);

  // 4) 组装订单：字段与原 JSON 库一一对应，仅图片改为对象名
  const product_title = String(body.product_title || '');
  const screenshot_key = String(body.screenshot_key || '');
  const order_no = String(body.order_no || '');
  const game_id = String(body.game_id || '');
  const server_area = String(body.server_area || '');
  const message = String(body.message || '');
  const designated_booster = String(body.designated_booster || '');

  await env.DB.prepare(
    'INSERT INTO orders (booster, uid, username, product_title, game_id, screenshot_key, order_no, server_area, designated_booster, message, submit_time, status, reject_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(
      '',
      claims.uid || '',
      claims.username || '',
      product_title,
      game_id,
      screenshot_key,
      order_no,
      server_area,
      designated_booster,
      message,
      nowText(),
      'pending',
      ''
    )
    .run();

  return json({ success: true, msg: '等待管理员核对' });
}