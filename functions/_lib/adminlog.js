// 管理员操作日志：旧后端写 admin_log.txt，边缘环境没有本地文件系统，改写入 D1 表 admin_log。
// 只记文本动作，不含截图等大体积内容；失败不影响主流程（表缺失时动作仍然生效）。

import { nowText } from './http.js';

export async function adminLog(env, admin, action) {
  try {
    await env.DB.prepare(
      'INSERT INTO admin_log (admin_uid, admin_name, action, log_time) VALUES (?, ?, ?, ?)'
    )
      .bind((admin && admin.uid) || '', (admin && admin.username) || '', String(action || ''), nowText())
      .run();
  } catch (e) {}
}