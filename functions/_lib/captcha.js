// 无状态验证码：题面随机生成，正确答案用签名封进 session_id，不落库、不占内存。
// 题型与判定规则照搬旧后端 captcha.py（共 7 种）。
import { signToken, verifyToken } from './jwt.js';

// 与原后端 SESSION_TIMEOUT 一致
export const TTL_SECONDS = 300;

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

// 从池子里随机填满 9 格，并保证至少有一个目标项
function buildGrid(pool, target, prompt) {
  const grid = [];
  let targetCount = 0;
  while (grid.length < 9) {
    const item = pick(pool);
    grid.push(item);
    if (item === target) targetCount += 1;
  }
  if (targetCount === 0) {
    grid[randInt(0, 8)] = target;
  }
  const indices = [];
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === target) indices.push(String(i));
  }
  return { grid: grid, prompt: prompt, answer: indices.join(',') };
}

export function generateChallenge() {
  const type = randInt(1, 7);

  if (type === 1) {
    let a = randInt(1, 20);
    let b = randInt(1, 20);
    const op = pick(['+', '-']);
    if (op === '-' && a < b) {
      const t = a;
      a = b;
      b = t;
    }
    const answer = String(op === '+' ? a + b : a - b);
    return {
      type: 1,
      data: { question: a + ' ' + op + ' ' + b + ' = ?', hint: 'input' },
      answer: answer,
    };
  }

  if (type === 2) {
    const g = buildGrid(
      ['M416', 'AK47', '平底锅', '三级头', '八倍镜', '急救包', '能量饮料', '烟雾弹'],
      '平底锅',
      '选出所有的「平底锅」'
    );
    return { type: 2, data: { grid: g.grid, hint: 'select', prompt: g.prompt }, answer: g.answer };
  }

  if (type === 3) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars[randInt(0, chars.length - 1)];
    return { type: 3, data: { code: code, hint: 'input_upper' }, answer: code.toUpperCase() };
  }

  if (type === 4) {
    const target = randInt(20, 80);
    return { type: 4, data: { target: target, hint: 'slide' }, answer: String(target) };
  }

  if (type === 5) {
    const g = buildGrid(
      ['空投箱', '弹药箱', '汽油桶', '载具', '掩体', '补给箱', '木箱', '铁桶'],
      '空投箱',
      '选出所有的「空投箱」'
    );
    return { type: 5, data: { grid: g.grid, hint: 'select', prompt: g.prompt }, answer: g.answer };
  }

  if (type === 6) {
    return {
      type: 6,
      data: { question: '和平精英的开发商是？', options: ['腾讯', '网易', '米哈游', '鹰角'], hint: 'choice' },
      answer: '腾讯',
    };
  }

  // type 7
  const animals = ['鸡', '鸭', '鹅', '鸟', '鹰', '猫'];
  for (let i = animals.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    const t = animals[i];
    animals[i] = animals[j];
    animals[j] = t;
  }
  return {
    type: 7,
    data: { prompt: '点击「我不是机器人」，然后选出「鸡」', options: animals, hint: 'select_one' },
    answer: '鸡',
  };
}

// 签发：把答案与有效期一起签进 session_id，前端只拿到题面
export async function issueCaptcha(secret) {
  const ch = generateChallenge();
  const session_id = await signToken({ t: ch.type, a: ch.answer }, secret, TTL_SECONDS);
  return { session_id: session_id, type: ch.type, data: ch.data };
}

function toInt(v) {
  const s = v === null || v === undefined ? '' : String(v).trim();
  if (!/^-?\d+$/.test(s)) return null;
  return parseInt(s, 10);
}

function normIndexList(v) {
  return String(v === null || v === undefined ? '' : v)
    .split(',')
    .map(function (x) {
      return x.trim();
    })
    .filter(function (x) {
      return x !== '';
    })
    .sort()
    .join(',');
}

// 校验：签名无效或过期直接不通过；答案按题型比对（滑块 ±3、点选集合、文字忽略大小写、其余精确）
export async function verifyCaptcha(sessionId, userAnswer, secret) {
  const claims = await verifyToken(sessionId, secret);
  if (!claims || typeof claims.a !== 'string') return false;
  const type = claims.t;
  const correct = claims.a;

  if (type === 4) {
    const u = toInt(userAnswer);
    const c = toInt(correct);
    if (u === null || c === null) return false;
    return Math.abs(u - c) <= 3;
  }

  if (type === 2 || type === 5) {
    const u = normIndexList(userAnswer);
    const c = normIndexList(correct);
    return u !== '' && u === c;
  }

  const user = String(userAnswer === null || userAnswer === undefined ? '' : userAnswer);
  if (type === 3) return user.trim().toUpperCase() === correct;
  return user.trim() === correct.trim();
}