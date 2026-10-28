-- 悦翔电竞 D1 建表脚本（Cloudflare 控制台 D1 → Console 里执行一次即可）
-- 字段用英文，与旧 JSON 库中文键一一对应。
-- 共 7 张表：users / reports / orders / products / booster_info / reviews / admin_log。

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

-- ==================== 商品（原 products.json）====================
-- 后台新增/删除商品走这里；前台 products.html 读的是静态 frontend/data/products.json（两套数据源，勿混）。
CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT,                       -- 原 商品名称
  price       TEXT,                       -- 原 价格
  description TEXT,                       -- 原 描述
  created_at  TEXT                        -- 原 创建时间（%Y-%m-%d %H:%M）
);

-- ==================== 打手档案（原 boosters.json）====================
-- 前台 booster-info.html 只读 name/rank/specialty/intro；后台列表额外需要 uid 关联账号。
CREATE TABLE IF NOT EXISTS booster_info (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  uid       TEXT DEFAULT '',            -- 关联 users.uid（可为空：仅展示用的档案）
  name      TEXT,                        -- 原 打手名
  rank      TEXT,                        -- 原 段位
  specialty TEXT,                        -- 原 擅长模式
  intro     TEXT                         -- 原 自我介绍
);

-- ==================== 评价（原 reviews.json）====================
-- 订单是否已评价靠 reviews.order_id 反查（orders 表没有 review 字段）。
CREATE TABLE IF NOT EXISTS reviews (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id      INTEGER,                -- 原 订单id
  reviewer_name TEXT,                   -- 原 评价人
  reviewer_uid  TEXT,                   -- 原 评价人uid
  booster_name  TEXT,                   -- 原 打手名
  booster_uid   TEXT,                   -- 原 打手uid
  stars         INTEGER,                -- 原 评分 1-5
  comment       TEXT,                   -- 原 评价内容
  review_time   TEXT                    -- 原 评价时间
);

-- ==================== 管理员操作日志（原 admin_log.txt）====================
-- 边缘环境没有本地文件系统，原来追加写 txt 的日志改为写这张表。
CREATE TABLE IF NOT EXISTS admin_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_uid  TEXT,                      -- 操作管理员 uid
  admin_name TEXT,                      -- 操作管理员用户名
  action     TEXT,                      -- 动作文本（如「核对了订单 #1 -> 已通过」）
  log_time   TEXT                       -- 时间（%Y-%m-%d %H:%M:%S）
);

CREATE INDEX IF NOT EXISTS idx_reviews_order ON reviews (order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_booster ON reviews (booster_uid);
CREATE INDEX IF NOT EXISTS idx_admin_log_time ON admin_log (log_time DESC);