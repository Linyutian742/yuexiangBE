// GET /api/captcha —— 生成一个验证码：前端只拿到题面，答案签在 session_id 里。
// 不落库、不占内存、不额外发请求。
import { issueCaptcha } from '../_lib/captcha.js';
import { json } from '../_lib/http.js';

export async function onRequestGet({ env }) {
  if (!env.JWT_SECRET) return json({ success: false, msg: '服务未配置' }, 500);
  const captcha = await issueCaptcha(env.JWT_SECRET);
  return json({ success: true, captcha: captcha }, 200, { 'cache-control': 'no-store' });
}