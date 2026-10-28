// GET /api/admin/boosters_info —— 打手档案（管理版额外返回 uid），按 id 升序。
import { json } from '../../_lib/http.js';
import { currentAdmin } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const admin = await currentAdmin(request, null, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  const res = await env.DB.prepare(
    'SELECT id, uid, name, rank, specialty, intro FROM booster_info ORDER BY id ASC'
  ).all();

  const boosters = ((res && res.results) || []).map((b) => ({
    id: b.id || 0,
    uid: b.uid || '',
    name: b.name || '',
    rank: b.rank || '',
    specialty: b.specialty || '',
    intro: b.intro || '',
  }));

  return json({ success: true, boosters });
}