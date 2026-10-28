// POST /api/report/submit
// 接收数据 → 接口内验一次 JWT → 校验验证码 → 写 D1 → 返回。全程 0 次额外读。
import { verifyToken } from '../../_lib/jwt.js';
import { verifyCaptcha } from '../../_lib/captcha.js';
import { json, readJson, bearer, nowText } from '../../_lib/http.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);

  // 1) 接口内验一次登录态
  const claims = await verifyToken(bearer(request, body), env.JWT_SECRET);
  if (!claims) return json({ success: false, msg: '未登录' }, 401);

  // 2) 校验验证码：签名无效或过期即拒，答案按题型比对
  const passed = await verifyCaptcha(body.captcha_session, body.captcha_answer, env.JWT_SECRET);
  if (!passed) return json({ success: false, msg: '验证失败' });

  // 3) 取字段（user 名直接来自 token，免一次 D1 读）
  const target_id = String(body.target_id || '').trim().replace(/[\\/]+/g, '');
  const reason = String(body.reason || '').trim();
  if (!target_id || !reason) return json({ success: false, msg: '提交失败' });

  // 4) 直接写 D1，不做服务端二次加工
  await env.DB.prepare(
    'INSERT INTO reports (reporter_name, target_id, reason, submit_time, status, reject_reason) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(claims.username || '', target_id, reason, nowText(), 'pending', '')
    .run();

  return json({ success: true, msg: '提交成功' });
}