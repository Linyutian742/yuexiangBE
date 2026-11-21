// POST /api/booster/push_ack —— App 把「已送到手机通知栏」的消息 id 回报给服务端。
// 只改本人（token 里的 uid）的记录，别人的 id 传进来也不会命中。
import { json, readJson, nowText } from '../../_lib/http.js';
import { currentPushBooster } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const user = await currentPushBooster(request, body, env);
  if (!user) return json({ success: false, msg: '无权限' }, 403);

  const list = Array.isArray(body.ids) ? body.ids : [];
  const ids = [];
  for (let i = 0; i < list.length && ids.length < 50; i++) {
    const id = parseInt(String(list[i]), 10);
    if (id > 0) ids.push(id);
  }
  if (!ids.length) return json({ success: true, acked: 0 });

  const now = nowText();
  const stmts = ids.map(function (id) {
    return env.DB.prepare("UPDATE push_messages SET ack_at = ? WHERE id = ? AND uid = ? AND ack_at = ''")
      .bind(now, id, user.uid);
  });
  await env.DB.batch(stmts);
  return json({ success: true, acked: ids.length });
}