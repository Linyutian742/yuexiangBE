// POST /api/admin/order/verify —— 核对订单通过：状态置 verified，并向 OP 等级为 2 的打手写入推送记录。
// 推送只在这里发生：未审核（pending）或已驳回（rejected）的订单永远不会进 push_messages，
// 因此「只有后台通过后才推送」「只有等级 2 的打手收得到」两条规则都落在服务端，前端绕不过去。
import { json, readJson, nowText } from '../../../_lib/http.js';
import { currentAdmin } from '../../../_lib/auth.js';
import { adminLog } from '../../../_lib/adminlog.js';

const CONTACT_MARK = '【联系方式】';
const MESSAGE_MARK = '【留言】';

// 订单留言约定：【联系方式】<类型> <号码> 【留言】<原留言>（与前端 splitOrderMessage 一致）
function splitContact(msg) {
  const text = msg === undefined || msg === null ? '' : String(msg);
  if (text.indexOf(CONTACT_MARK) !== 0) return '';
  const rest = text.slice(CONTACT_MARK.length);
  const pos = rest.indexOf(MESSAGE_MARK);
  return (pos === -1 ? rest : rest.slice(0, pos)).trim();
}

function pushBody(order) {
  const parts = ['#' + order.id];
  if (order.product_title) parts.push(String(order.product_title));
  if (order.server_area) parts.push(String(order.server_area));
  const contact = splitContact(order.message);
  if (contact) parts.push(contact);
  return parts.join(' · ');
}

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const admin = await currentAdmin(request, body, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  const oid = parseInt(String(body.id || 0), 10) || 0;
  if (!oid) return json({ success: false, msg: '订单不存在' }, 404);

  const order = await env.DB.prepare(
    'SELECT id, username, product_title, server_area, message, status FROM orders WHERE id = ?'
  )
    .bind(oid)
    .first();
  if (!order) return json({ success: false, msg: '订单不存在' }, 404);

  // 条件更新：只有 pending 才算「本次通过」。重复点通过不会重复推送（防止刷单）。
  const res = await env.DB.prepare(
    "UPDATE orders SET status = 'verified', reject_reason = '' WHERE id = ? AND status = 'pending'"
  )
    .bind(oid)
    .run();
  const changed = res && res.meta ? Number(res.meta.changes || 0) : 0;
  if (!changed) {
    return json({ success: true, pushed: 0, msg: '该订单不是待核对状态，未重复推送' });
  }

  await adminLog(env, admin, '核对了订单 #' + oid + ' -> 已通过');

  // 收件人：OP 等级正好为 2 且未封禁的打手。等级 1 / 3 不在查询结果里。
  const boosters = await env.DB.prepare(
    "SELECT uid, username FROM users WHERE op_level = 2 AND status = 'yes'"
  ).all();
  const rows = (boosters && boosters.results) || [];
  if (!rows.length) return json({ success: true, pushed: 0 });

  const now = nowText();
  const bodyText = pushBody(order);
  // INSERT OR IGNORE 配合唯一索引 (order_id, uid)：同一个订单不会给同一个人推两条。
  const stmts = rows.map(function (b) {
    return env.DB.prepare(
      'INSERT OR IGNORE INTO push_messages (order_id, uid, username, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(oid, b.uid || '', b.username || '', '新订单待接单', bodyText, now);
  });
  await env.DB.batch(stmts);

  return json({ success: true, pushed: rows.length });
}