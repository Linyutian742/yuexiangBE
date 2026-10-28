// 生成首个管理员的 INSERT 语句。
// D1 里默认没有任何管理员（旧账号只存在于 legacy-backend/accounts.json），后台要用必须先种一个。
//
// 用法：node db/seed-admin.mjs <用户名> <密码> [迭代数]
//
// ⚠️ pepper 必须与线上完全一致：本脚本用环境变量 PWD_PEPPER（未设置则用 JWT_SECRET）参与派生。
//    这里算出来的哈希只有在同一个 pepper 下才能通过校验，所以请把线上的那个值带进来跑：
//        JWT_SECRET=你的密钥 node db/seed-admin.mjs admin 你的密码
//    线上建议单独设一个固定的 PWD_PEPPER（这样轮换 JWT_SECRET 不会连带废掉所有密码）。
//    确实想生成一个不带 pepper 的哈希（仅本地测试）时，加 --no-pepper。
//
// 只打印 SQL，不连接任何数据库、不写文件。

import { newUid } from '../functions/_lib/auth.js';
import { hashPassword, DEFAULT_ITERATIONS } from '../functions/_lib/password.js';
import { nowText } from '../functions/_lib/http.js';

const args = process.argv.slice(2).filter((a) => a !== '--no-pepper');
const noPepper = process.argv.includes('--no-pepper');

const username = String(args[0] || '').trim();
const password = String(args[1] || '');

if (!username || !password) {
  console.error('用法: [JWT_SECRET=...] node db/seed-admin.mjs <用户名> <密码> [迭代数] [--no-pepper]');
  process.exit(1);
}
if (!/^[\w\u4e00-\u9fff]{2,20}$/.test(username)) {
  console.error('用户名需为 2-20 位中文、字母、数字或下划线');
  process.exit(1);
}

const pepper = String(process.env.PWD_PEPPER || process.env.JWT_SECRET || '');
if (!pepper && !noPepper) {
  console.error(
    [
      '未检测到 pepper：请带上线上同一个密钥再跑，例如',
      '    JWT_SECRET=你的密钥 node db/seed-admin.mjs ' + username + ' <密码>',
      '否则生成的哈希在线上永远校验不通过。仅本地测试可加 --no-pepper。',
    ].join('\n')
  );
  process.exit(1);
}

const env = {
  PWD_PEPPER: pepper,
  JWT_SECRET: pepper,
  PWD_ITERATIONS: args[2],
};

const uid = newUid();
const hash = await hashPassword(password, env);
const esc = (s) => String(s).replace(/'/g, "''");

console.log(
  "INSERT INTO users (uid, username, password, tag, op_level, status, created_at) VALUES (" +
    "'" + esc(uid) + "', '" + esc(username) + "', '" + esc(hash) + "', 'op', 3, 'yes', '" + esc(nowText()) + "');"
);
console.log(
  '-- 迭代数 ' +
    (args[2] ? parseInt(args[2], 10) : DEFAULT_ITERATIONS) +
    '（线上可用 PWD_ITERATIONS 覆盖；免费版建议不超过 3000，默认 ' +
    DEFAULT_ITERATIONS +
    '）' +
    (pepper ? '；已使用 pepper 派生' : '；未使用 pepper')
);