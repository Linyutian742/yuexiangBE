// POST /api/application/submit
// 报名（加入我们）提交：接口内验一次 JWT → 读一次本人已有报名 → 写/更新一次。
// 不加验证码（验证码只在登录接口要求，与 report/submit.js 一致）。
import { verifyToken } from '../../_lib/jwt.js';
import { json, readJson, bearer, nowText } from '../../_lib/http.js';

const CONTACT_LABELS = { wechat: '微信', qq: 'QQ', phone: '手机号' };
const REJECT_RESET = { status: 'pending', reject_reason: '', review_admin: '', review_time: '' };

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);

  // 1) 接口内验一次登录态（用户名/uid 直接取自 token，免一次 D1 读）
  const claims = await verifyToken(bearer(request, body), env.JWT_SECRET);
  if (!claims || !claims.uid) return json({ success: false, msg: '未登录' }, 401);

  // 2) 取字段
  const nickname = String(body.nickname || '').trim();
  const game_id = String(body.game_id || '').trim();
  const server_area = String(body.server_area || '').trim();
  const game_rank = String(body.game_rank || '').trim();
  const specialty = String(body.specialty || '').trim();
  const online_time = String(body.online_time || '').trim();
  const intro = String(body.intro || '').trim();

  // 联系方式：类型 + 号码，存成「微信 abc123」这种单串（与订单页约定一致）
  const contactType = String(body.contact_type || '').trim();
  const contactValue = String(body.contact_value || '').trim();
  const contact = contactValue ? (CONTACT_LABELS[contactType] || contactType || '') + ' ' + contactValue : '';

  // 必填：游戏 ID、区服、段位、联系方式
  if (!game_id) return json({ success: false, msg: '请填写游戏 ID' });
  if (!server_area) return json({ success: false, msg: '请选择区服' });
  if (!game_rank) return json({ success: false, msg: '请选择段位' });
  if (!contactType || !CONTACT_LABELS[contactType]) return json({ success: false, msg: '请选择联系方式类型' });
  if (!contactValue) return json({ success: false, msg: '请填写联系方式' });

  // 3) 读一次本人已有报名
  let existing = null;
  try {
    existing = await env.DB.prepare('SELECT id, status FROM applications WHERE uid = ? ORDER BY id DESC LIMIT 1')
      .bind(claims.uid)
      .first();
  } catch (e) {
    return json({ success: false, msg: '报名提交失败：' + ((e && e.message) || e) }, 500);
  }

  if (existing && existing.status === 'pending') {
    return json({ success: false, msg: '你已提交报名，请等待管理员审核' });
  }
  if (existing && existing.status === 'approved') {
    return json({ success: false, msg: '你已通过报名审核，无需重复提交' });
  }

  const cols =
    'uid, username, nickname, game_id, server_area, game_rank, specialty, contact, online_time, intro, submit_time, status, reject_reason, review_admin, review_time';
  const vals = [
    claims.uid,
    claims.username || '',
    nickname,
    game_id,
    server_area,
    game_rank,
    specialty,
    contact,
    online_time,
    intro,
    nowText(),
    REJECT_RESET.status,
    REJECT_RESET.reject_reason,
    REJECT_RESET.review_admin,
    REJECT_RESET.review_time,
  ];

  try {
    if (existing) {
      // 被拒过 → 允许重新提交，作为新的一条待审记录（清空上一次的拒绝理由）
      await env.DB.prepare(
        'UPDATE applications SET nickname = ?, game_id = ?, server_area = ?, game_rank = ?, specialty = ?, contact = ?, online_time = ?, intro = ?, submit_time = ?, status = ?, reject_reason = ?, review_admin = ?, review_time = ? WHERE id = ?'
      )
        .bind(
          nickname,
          game_id,
          server_area,
          game_rank,
          specialty,
          contact,
          online_time,
          intro,
          nowText(),
          REJECT_RESET.status,
          REJECT_RESET.reject_reason,
          REJECT_RESET.review_admin,
          REJECT_RESET.review_time,
          existing.id
        )
        .run();
      return json({ success: true, msg: '已重新提交，请等待审核' });
    }

    const placeholders = cols
      .split(',')
      .map(() => '?')
      .join(', ');
    await env.DB.prepare('INSERT INTO applications (' + cols + ') VALUES (' + placeholders + ')')
      .bind(...vals)
      .run();
    return json({ success: true, msg: '提交成功，请等待管理员审核' });
  } catch (e) {
    return json({ success: false, msg: '报名提交失败：' + ((e && e.message) || e) }, 500);
  }
}