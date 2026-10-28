// GET /api/admin/users —— 全部用户列表（不含密码），按注册时间倒序。
// 鉴权在接口内完成；返回键名沿用旧后端的 user（不是 username）。
import { json } from '../../_lib/http.js';
import { currentAdmin } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const admin = await currentAdmin(request, null, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  const res = await env.DB.prepare(
    'SELECT uid, username, tag, op_level, status, created_at FROM users ORDER BY created_at DESC'
  ).all();

  const users = ((res && res.results) || []).map((u) => ({
    uid: u.uid || '',
    user: u.username || '',
    tag: u.tag || '',
    op_level: u.op_level == null ? 1 : u.op_level,
    status: u.status || '',
    reg_time: u.created_at || '',
  }));

  return json({ success: true, users });
}