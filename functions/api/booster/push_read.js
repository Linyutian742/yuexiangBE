// POST /api/booster/push_read —— 标记推送已读（打手在消息页点开 / 全部已读）。
// body: { id: 12 } 单条；{ all: true } 本人全部。
import { json, readJson, nowText } from '../../_lib/http.js';
import { currentPushBooster } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const user = await currentPushBooster(request, body, env);
  if (!user) return json({ success: false, msg: '无权限' }, 403);

  const now = nowText();
  if (body.all === true) {
    await env.DB.prepare("UPDATE push_messages SET read_at = ? WHERE uid = ? AND read_at = ''")
      .bind(now, user.uid)
      .run();
    return json({ success: true });
  }

  const id = parseInt(String(body.id || ''), 10);
  if (!id) return json({ success: false, msg: '参数错误' });
  await env.DB.prepare("UPDATE push_messages SET read_at = ? WHERE id = ? AND uid = ? AND read_at = ''")
    .bind(now, id, user.uid)
    .run();
  return json({ success: true });
}