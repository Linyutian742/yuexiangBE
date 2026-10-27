-- 悦翔电竞 D1 建表脚本（Cloudflare 控制台 D1 → Console 里执行一次即可）
-- 字段用英文，与旧 JSON 库中文键一一对应；写操作接口只用到 reports / orders / users。

CREATE TABLE IF NOT EXISTS users (
  uid        TEXT PRIMARY KEY,          -- 原 uid
  username   TEXT NOT NULL UNIQUE,      -- 原 用户名
  password   TEXT NOT NULL,             -- 原 密码（bcrypt 串）
  tag        TEXT DEFAULT 'deop',       -- 原 用户标签
  op_level   INTEGER DEFAULT 1,         -- 原 op等级
  status     TEXT DEFAULT 'yes',        -- 原 账户状态（yes/no）
  created_at TEXT                       -- 原 注册时间
);

CREATE TABLE IF NOT EXISTS reports (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_name TEXT,                   -- 原 举报用户
  target_id     TEXT,                   -- 原 被举报人
  reason        TEXT,                   -- 原 举报原因
  submit_time   TEXT,                   -- 原 举报时间
  status        TEXT DEFAULT 'pending', -- 原 状态
  reject_reason TEXT DEFAULT ''         -- 原 驳回原因
);

CREATE TABLE IF NOT EXISTS orders (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  booster            TEXT DEFAULT '',   -- 原 接单打手
  uid                TEXT,              -- 原 uid
  username           TEXT,              -- 原 点单人
  product_title      TEXT,              -- 原 商品名称
  game_id            TEXT,              -- 原 游戏ID
  screenshot_key     TEXT,              -- 原 转账截图位置（改存 R2 对象名）
  order_no           TEXT,              -- 原 订单号
  server_area        TEXT,              -- 原 区服
  designated_booster TEXT DEFAULT '',   -- 原 指定打手
  message            TEXT,              -- 原 留言
  submit_time        TEXT,              -- 原 下单时间
  status             TEXT DEFAULT 'pending', -- 原 状态
  reject_reason      TEXT DEFAULT ''    -- 原 驳回原因
);

-- 列表页按时间倒序、按 uid 取单都需要索引
CREATE INDEX IF NOT EXISTS idx_reports_time ON reports (submit_time DESC);
CREATE INDEX IF NOT EXISTS idx_orders_time ON orders (submit_time DESC);
CREATE INDEX IF NOT EXISTS idx_orders_uid ON orders (uid);
CREATE INDEX IF NOT EXISTS idx_orders_booster ON orders (booster);