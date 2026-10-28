// POST /api/order/submit
// 顺序与旧后端一致：维护开关 → 验一次登录态（顺带拿封禁状态）→ 验证码 → 存截图 → 写 D1。
// 图片只做转发：前端仍是 base64 data URL，后端直接解出字节丢进 R2，不二次压缩、不改格式、不写进 D1。
// 未绑定 R2 时截图不落库（宁可少存图，也不把大体积 base64 塞进数据库）。
import { verifyCaptcha } from '../../_lib/captcha.js';
import { json, readJson, nowText, stampText } from '../../_lib/http.js';
import { currentUser } from '../../_lib/auth.js';
import { fromBase64 } from '../../_lib/base64.js';

const EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
};

function safeName(s) {
  return String(s || '').replace(/[\\/]/g, '_');
}

// 只解 base64 装箱，不做像素级处理。
// 解码走 _lib/base64.js：有原生实现就用原生（300KB 实测 3.0ms → 0.7ms），否则分块回落。
function decodeImage(dataUrl) {
  const s = String(dataUrl || '');
  const i = s.indexOf(',');
  if (i < 0) return null;
  const m = /^data:(image\/[a-z0-9.+-]+);base64$/i.exec(s.slice(0, i).trim());
  if (!m) return null;
  return { bytes: fromBase64(s.slice(i + 1)), mime: m[1].toLowerCase() };
}

// 一次 R2 写；key 沿用旧后端的目录形态：付款记录/<用户名>/<时间戳>/付款截图.<ext>
async function storeShot(env, username, dataUrl) {
  const img = decodeImage(dataUrl);
  if (!img || !env.BUCKET) return '';
  const ext = EXT[img.mime] || 'png';
  const key = '付款记录/' + safeName(username) + '/' + stampText() + '/付款截图.' + ext;
  await env.BUCKET.put(key, img.bytes, { httpMetadata: { contentType: img.mime } });
  return key;
}

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);

  // 1) 维护开关：读环境变量，0 次 IO
  if (env.MAINTENANCE === '1' || env.MAINTENANCE === 'true') {
    return json({ success: false, msg: '服务器维护中' }, 503);
  }

  // 2) 接口内验一次登录态：验签 + 读一行 users，同时拿到封禁状态
  const user = await currentUser(request, body, env);
  if (!user) return json({ success: false, msg: '未登录' }, 401);
  if (user.status !== 'yes') return json({ success: false, msg: '账号已封禁' }, 403);

  // 3) 验证码：签名无效或过期即拒
  if (!(await verifyCaptcha(body.captcha_session, body.captcha_answer, env.JWT_SECRET))) {
    return json({ success: false, msg: '验证失败' });
  }

  // 4) 截图：优先用前端已直传得到的对象名，否则把 base64 原样转发到 R2
  let screenshot_key = String(body.screenshot_key || '');
  if (!screenshot_key && body.screenshot) {
    try {
      screenshot_key = await storeShot(env, user.username, body.screenshot);
    } catch (e) {
      screenshot_key = '';
    }
  }

  // 5) 组装订单：字段与原 JSON 库一一对应
  await env.DB.prepare(
    'INSERT INTO orders (booster, uid, username, product_title, game_id, screenshot_key, order_no, server_area, designated_booster, message, submit_time, status, reject_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(
      '',
      user.uid || '',
      user.username || '',
      String(body.product_title || ''),
      String(body.game_id || ''),
      screenshot_key,
      String(body.order_no || ''),
      String(body.server_area || ''),
      String(body.designated_booster || ''),
      String(body.message || ''),
      nowText(),
      'pending',
      ''
    )
    .run();

  return json({ success: true, msg: '等待管理员核对' });
}