// POST /api/feedback/submit
// 反映问题（在线提交）：接口内验一次 JWT → 取字段 → 写 D1 feedback → 返回。全程 0 次额外读。
// 与 report/submit.js 一致：不加验证码（验证码只在登录接口要求）。
import { verifyToken } from '../../_lib/jwt.js';
import { json, readJson, bearer, nowText } from '../../_lib/http.js';

const CATEGORIES = ['功能异常', '订单与充值', '账号与登录', '体验建议', '其他'];
const MIN_CONTENT = 5;
const MAX_CONTENT = 1000;
const MAX_CONTACT = 60;

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);

  // 1) 接口内验一次登录态（uid / 用户名直接取自 token，免一次 D1 读）
  const claims = await verifyToken(bearer(request, body), env.JWT_SECRET);
  if (!claims || !claims.uid) return json({ success: false, msg: '未登录' }, 401);

  // 2) 取字段并做边界校验（服务端不信任前端）
  const category = String(body.category || '').trim();
  const content = String(body.content || '').trim();
  const contact = String(body.contact || '').trim().slice(0, MAX_CONTACT);

  if (!content) return json({ success: false, msg: '请填写问题描述' });
  if (content.length < MIN_CONTENT) return json({ success: false, msg: '问题描述太短了，请多写几个字' });
  if (content.length > MAX_CONTENT) return json({ success: false, msg: '问题描述太长了，请精简到 1000 字以内' });

  // 非白名单类型统一归到「其他」，避免脏值入库
  const safeCategory = CATEGORIES.indexOf(category) >= 0 ? category : '其他';

  // 3) 写 D1，不做服务端二次加工
  try {
    await env.DB.prepare(
      'INSERT INTO feedback (uid, username, category, content, contact, submit_time, status, reject_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(claims.uid, claims.username || '', safeCategory, content, contact, nowText(), 'pending', '')
      .run();
  } catch (e) {
    return json({ success: false, msg: '提交失败：' + ((e && e.message) || e) }, 500);
  }

  return json({ success: true, msg: '提交成功，感谢你的反馈' });
}