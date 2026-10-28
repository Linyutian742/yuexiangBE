# 悦翔电竞（静态前端 + Cloudflare Pages Functions）

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `frontend/` | 静态站点：页面、样式、脚本、图片、静态数据。部署时的**输出目录** |
| `functions/` | Cloudflare Pages Functions，位于仓库根，按文件路径自动生成接口路由 |
| `db/schema.sql` | D1 建表脚本，部署前在 Cloudflare 控制台执行一次 |
| `legacy-backend/` | 旧的 Python 后端，仅供本地对照，与 `functions/` **互不引用**，**已被 `.gitignore` 排除，不会上传** |
| `db/seed-admin.mjs` | 生成「首个管理员」的 INSERT 语句（本地跑一次，不连数据库） |
| `付款记录/`、`举报记录/` | 本地业务记录（含用户信息与截图），**不会上传** |
| `.dumate/` | 本地工作区临时目录，**不会上传** |

## 上传到 GitHub

1. 「一键上传Github.bat」已放在本文件所在的目录（仓库根目录）。
2. 双击运行，按提示完成两次确认。

脚本会 `git add -A` 后**强制推送**，远端同名分支的旧历史会被覆盖。脚本内写死了仓库地址与分支：
`https://github.com/Linyutian742/yuexiangBE.git` 的 `master` 分支 —— 要换仓库或分支，改脚本开头的 `REMOTE_URL`、`BRANCH` 两行即可。

## Cloudflare Pages 部署设置

| 设置项 | 值 |
| --- | --- |
| 框架预设（Framework preset） | **不选任何框架**（保持默认项；中文界面可能显示为「无」） |
| 构建命令（Build command） | `exit 0`（相当于什么都不做；留空也可以） |
| 构建输出目录（Build output directory） | `frontend` |
| 根目录（Root directory） | 仓库根 |

**框架预设不要挑框架**：选 Next.js (Static HTML Export)、Nuxt.js 这类条目会连带把构建命令改成 `npx next build`、`npm run build`，输出目录改成 `out`、`dist` —— 本仓库没有这些构建步骤，会直接构建失败。列表里若真找不到「不选/无」这一项，就保持它当前选中的默认值不动。

`functions/` 不需要构建，Pages 会自动识别并打包。

> **别选错流程**：要创建的是 **Pages** 项目（Workers 和 Pages → 创建应用程序 → **Pages** → 连接到 Git）。如果界面出现「部署命令」「预览命令」（默认 `npx wrangler deploy` / `npx wrangler preview`），说明进的是 **Workers 构建**流程而不是 Pages —— 本仓库的 `functions/` 结构在那边用不了，返回上一步改选 Pages。

## 绑定与环境变量（控制台配置）

| 名称 | 类型 | 用途 |
| --- | --- | --- |
| `DB` | D1 数据库 | 用户、订单、举报数据 |
| `JWT_SECRET` | 密钥（加密保存） | 登录态 JWT 的签名与校验 |
| `MAINTENANCE` | 文本变量 | 填 `1` 表示维护中，下单接口会拒绝 |
| `BUCKET` | R2 存储桶 | 付款截图等图片（图片上传功能接入后再绑定） |
| `PWD_PEPPER` | 密钥（加密保存，建议单独设） | 密码哈希的 pepper（见下文）。**不设就回落用 `JWT_SECRET`** |
| `PWD_ITERATIONS` | 文本变量（可选） | PBKDF2 迭代数，默认 `1000`；免费版建议 ≤`3000`，付费计划可调高 |
| `PWD_ALLOW_BCRYPT` | 文本变量（可选） | 填 `1` 才允许校验历史 bcrypt 哈希（免费版不要开，见下文） |

## 请求走向

`frontend/_routes.json` 只把 `/api/*` 交给 Functions 执行，其余请求全部走不限量免费的静态分发。

## 迁移进度

**旧 Python 后端的全部接口已搬到 `functions/`**（迁移本身前端零改动；后续按需求把验证码收敛到只在登录页使用，改了 `frontend/` 下 4 个页面，见下文「验证码的使用范围」）。旧的 `legacy-backend/` 只留作对照，部署时不会上传，两边互不引用。

| 已迁移接口 | 说明 |
| --- | --- |
| `GET /api/captcha` | 验证码出题（7 种题型，无状态：答案签名进 session_id，TTL 300 秒） |
| `GET /api/products`、`/api/boosters`、`/api/boosters_info` | 公开只读，走 `caches.default` 边缘缓存 60 秒 |
| `POST /api/register`、`/api/login`、`/api/change_password`、`GET /api/profile` | 登录态用无状态 HS256 JWT |
| `POST /api/order/submit`、`GET /api/order/review` | 下单（截图转发到 R2）与评价 |
| `GET /api/booster/{orders,reviews}`、`POST /api/booster/{accept,complete,cancel}` | 打手工作台，订单状态机 `pending → verified → accepted → completed` |
| `GET /api/admin/{users,orders,reports,boosters_info,reviews}`、`POST /api/admin/user/*`（8 个）、`product/*`、`order/*`、`report/*`、`booster/*` | 管理后台全部动作，操作日志写 D1 表 `admin_log` |

**不迁移的接口**：`/api/captcha/verify`、`/api/check_admin`、`/api/check_booster`、`/api/ping` —— 前端从未调用（`frontend/js/captcha.js` 里的 `verify()` 是死代码），留着也不会被触发。

### 验证码的使用范围

- **只有登录要验证码**：`POST /api/login` 必须带 `captcha_session` / `captcha_answer`，校验不过就回 `验证失败`。
- **其余接口一律不要求**：`POST /api/register`、`/api/change_password`、`/api/order/submit`、`/api/report/submit` 都不再校验验证码。它们仍然**接受**这两个字段但直接忽略，所以老客户端带着旧字段请求不会报错。
- 前端只有 `frontend/login.html` 加载 `frontend/js/captcha.js`；`order.html`、`report.html`、`profile.html` 的验证码区块、采集与提交逻辑均已删除，登录页的注册表单也不再显示验证码。

### 首次部署要做的三件事

1. **执行 `db/schema.sql`**（共 7 张表：`users`、`reports`、`orders`、`products`、`booster_info`、`reviews`、`admin_log`）——D1 控制台 → Console 里粘贴执行一次。
2. **种一个管理员**：D1 里默认没有任何管理员账号（旧账号只存在于 `legacy-backend/accounts.json`，且都是 bcrypt 哈希）。在本机跑
   `JWT_SECRET=你的密钥 node db/seed-admin.mjs <用户名> <密码>`，把打印出的那句 SQL 粘到 D1 Console 执行即可（该脚本本地生成 PBKDF2 哈希，不连数据库）。首个管理员是 `op_level=3`。
   可选取第三个参数指定迭代数（`node db/seed-admin.mjs admin 密码 2000`），加 `--no-pepper` 则生成不含 pepper 的哈希（仅本地临时用）。
3. **配置环境变量**：`JWT_SECRET`（必填，缺失时验证码、登录等接口返回 500 `服务未配置`）、`DB`、`BUCKET`、`MAINTENANCE`；建议再加 `PWD_PEPPER`。

> **`PWD_PEPPER` 必须与生成种子哈希时用的一致且保持稳定**。它没配时回落 `JWT_SECRET` —— 所以**轮换 `JWT_SECRET` 会让所有密码失效**（用户只能靠管理员重置密码）。想以后能安全换 JWT 密钥，就现在单独设一个 `PWD_PEPPER`。

### 已知差异与限制（部署前请知悉）

- **双数据源**：`admin.html` 的商品读 D1（`/api/products`），而 `products.html` 读静态文件 `frontend/data/products.json`。Workers 运行时没有文件系统，无法把后台新增的商品写回静态 JSON —— 后台加了商品，前台页面不会自动出现，需手动同步这个文件。
- **CPU 开销已按免费版 10ms 上限压过一轮**：关键路径实测表、以及为了压进这条线做的取舍（低迭代 PBKDF2 + pepper、bcrypt 默认关闭、原生 base64 解码），见下文「免费版 CPU 预算与取舍」一节。
- **封禁语义**：旧后端封禁时会清空 token 使登录态立即失效；新实现是「token 仍可验签，各接口读到 `status='no'` 后拒绝」。目前查了 `status` 的是 `order/submit`、`profile`（都返回 403 `账号已封禁`，`profile.html` 依赖这个文案）与打手/管理员接口（返回 403 `无权限`）；**`order/review`、`change_password`、`report/submit` 只验签名不查封禁状态**，被封禁用户仍可评价/改密/举报（`report/submit` 为了保持「零 D1 读」的设计有意为之）。
- **边缘缓存只对匿名访客生效**：`frontend/js/common.js` 会给出 `/api/` 开头的请求自动带 `Authorization` 头，带 token 的请求一律绕过缓存直读 D1，这是设计如此（避免管理员看到脏数据）。
- **截图仍是 base64 而不是 WebP 表单**：前端 `order.html` 当前就发 base64 data URL，本次迁移不动前端，后端只做「解出字节 → 丢进 R2」，不二次压缩、不改格式；未绑定 R2 时订单照常提交，只是 `screenshot_key` 为空。
  - **请求体越大 CPU 越贵**（JSON 解析 + base64 解码都是按体积走的），所以建议前端压缩后的截屏控制在 **≤300KB**：这个体积下下单接口整条链路约 4~5ms，1MB 会逼近 10ms 上限。
- **`admin_log` 替代了 `admin_log.txt`**：边缘环境没有本地文件系统，管理员操作日志改写入 D1。

### 免费版 CPU 预算与取舍

Workers **免费版单请求 CPU 上限 10ms**（付费计划 30s）。下表为本机实测，`node .dumate/tmp/test-cpu-budget.mjs` 可复现，**任何一项超预算脚本就会失败**：

| 环节 | 实测（min-of-5） | 预算 |
| --- | --- | --- |
| `hashPassword`（默认 1000 迭代） | 1.23ms | ≤4ms |
| `verifyPassword`（默认 1000 迭代） | 1.07ms | ≤4ms |
| 登录整链路（校验口令 + 签发 token） | 0.74ms | ≤6ms |
| 写操作鉴权（验签 + 校验口令） | 0.83ms | ≤6ms |
| `signToken` / `verifyToken` | 0.08ms / 0.13ms | ≤1ms |
| `issueCaptcha` / `verifyCaptcha` | 0.12ms / 0.09ms | ≤1ms |
| 截图 base64 解码 300KB / 1MB | 1.71ms / 4.42ms | ≤4ms / ≤12ms |

为压到这条线做的取舍：

- **密码哈希从 10 万次迭代降到 1000 次**（10 万次约 113ms，必爆）。强度改用**服务端 pepper** 补：`derived = PBKDF2(key = pepper, salt = 随机 16 字节 ‖ 口令)` —— pepper 当 HMAC 密钥、口令放进 salt；库被拖走但 pepper 不泄露时，攻击者连一次猜测都无法求值。存库格式不变：`pbkdf2$<迭代>$<盐>$<哈希>`。
- **调迭代数**：线上设 `PWD_ITERATIONS`（默认 `1000`，免费版建议 ≤`3000`，本机 3000 次约 4.3ms）；付费计划可调高。脚本侧则用第三个参数，见「首次部署」第 2 条。
- **JWT 的 HMAC 密钥与 PBKDF2 密钥都在 isolate 内缓存**，省掉每次请求的 `importKey`。
- **截图解码优先用运行时原生的 `Uint8Array.fromBase64`**（本机 300KB：3.0ms → 1.7ms），没有原生实现时才回落到分块 `atob`。
- **bcrypt（41KB 纯 JS，单次约 868ms）改为动态 import 且默认关闭**：`verifyPassword` 遇到 `$2a$/$2b$/$2y$` 哈希直接判失败，几乎不耗 CPU。需要兼容旧账号时设 `PWD_ALLOW_BCRYPT=1`（**只在付费计划下用**，免费版一定超限），开启后登录成功仍会透明升级为新格式。
- **旧 bcrypt 账号在免费版下的处理路径**：这些账号无法登录 → 用管理员账号在后台「重置密码」给它们发临时密码 `123456`（重置后自动变成新格式），或临时开 `PWD_ALLOW_BCRYPT=1` 在付费计划下让本人登录一次完成透明升级，再关掉。

### 本地验证

无 wrangler 也能验证：测试脚本在 `.dumate/tmp/` 下，`node` 直接运行。

- `.dumate/tmp/e2e-sqlite.mjs` —— **端到端主链路**（`node --experimental-sqlite`）：用真实 SQLite 执行 `db/schema.sql`，再直调全部 handler，跑通注册→登录→下单→核单→接单→完成→评价→改密→封禁，54 项断言。
- 单接口：`test-bcrypt.mjs`（6）、`test-password.mjs`（37）、`test-auth-cache.mjs`（31）、`test-readonly.mjs`（19）、`test-auth-api.mjs`（48）、`test-write-api.mjs`（32）、`test-booster-api.mjs`（35）、`test-admin-api.mjs`（157）。
- `.dumate/tmp/test-cpu-budget.mjs` —— **CPU 预算断言**（16 项）：关键路径逐个计时并在超预算时失败，同时断言没有任何文件静态导入 bcrypt。
- 全部脚本当前合计 **435 项断言，0 失败**。