# 悦翔电竞（静态前端 + Cloudflare Pages Functions）

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `frontend/` | 静态站点：页面、样式、脚本、图片、静态数据。部署时的**输出目录** |
| `functions/` | Cloudflare Pages Functions，位于仓库根，按文件路径自动生成接口路由 |
| `一键部署.bat`、`deploy/` | **一键部署脚本**（本地用，**已被 `.gitignore` 排除，不会上传**）。第 1 步生成密钥、建表 SQL、管理员 INSERT；第 2 步把改动提交并推送到 GitHub |
| `legacy-backend/` | 旧的 Python 后端，仅供本地对照，与 `functions/` **互不引用**，**已被 `.gitignore` 排除，不会上传** |
| `付款记录/`、`举报记录/` | 本地业务记录（含用户信息与截图），**不会上传** |
| `.dumate/` | 本地工作区临时目录，**不会上传** |

## 一键部署（推荐）

仓库根目录的 **「一键部署.bat」** 是给不熟悉命令行的使用者准备的，双击即可：

1. **第 1 步（准备）**：自动生成 `JWT_SECRET`、`PWD_PEPPER`（写在桌面 `悦翔电竞-配置信息.txt`，下次运行沿用旧值），把建表 SQL 写到桌面 `悦翔电竞-D1建表.sql` 并复制到剪贴板，问你要一个管理员用户名/密码后生成管理员 `INSERT` 并复制到剪贴板；同时自动打开 Cloudflare 的对应页面。你只要照着窗口里的提示往网页里粘。
2. **第 2 步（上传）**：列出这次所有改动（新增/修改/删除各多少个），回车确认后 `git add -A` → `commit` → `push origin master`。删除的文件会黄字提示；推送失败时给出常见原因，并且只有你输入 `1`、再输入大写 `YES` 才会强制覆盖。

脚本不依赖 Node.js：密钥与密码哈希用 Windows 自带的 PowerShell 生成（PBKDF2-SHA256，格式与 `functions/_lib/password.js` 完全一致，已交叉验证）。仓库地址与分支写死在 `deploy/upload.ps1`（`https://github.com/Linyutian742/yuexiangBE.git` 的 `master`）。

> 旧的「一键上传Github.bat」（一步强制推送）仍保留，但推荐改用「一键部署.bat」。

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
| `SHOTS` | KV 命名空间 | 付款截图等图片（**首选**：创建 KV 命名空间不需要绑卡） |
| `BUCKET` | R2 存储桶（可选） | 付款截图等图片；与 `SHOTS` 同时绑定时以 `SHOTS` 为准 |
| `PWD_PEPPER` | 密钥（加密保存，建议单独设） | 密码哈希的 pepper（见下文）。**不设就回落用 `JWT_SECRET`** |
| `PWD_ITERATIONS` | 文本变量（可选） | PBKDF2 迭代数，默认 `1000`；免费版建议 ≤`3000`，付费计划可调高 |
| `PWD_ALLOW_BCRYPT` | 文本变量（可选） | 填 `1` 才允许校验历史 bcrypt 哈希（免费版不要开，见下文） |

### 图片存储绑定：KV（首选）或 R2（可选）

`POST /api/order/submit` 把付款截图解出原始字节写进对象存储，**按绑定到的对象自动识别**（KV 命名空间有 `getWithMetadata`、R2 桶没有），两种情况都能跑：

- **KV 命名空间绑定 `SHOTS`（首选）**：控制台 →「存储和数据库 / Storage & Databases」→「KV」→ 创建命名空间；回到 Pages 项目 →「设置 → 变量和绑定」→ 添加 →「KV 命名空间」→ 变量名称填 **`SHOTS`**。**创建与绑定都不需要绑卡**；免费额度为每天 1 000 次写、10 万次读、1 GB 存储，单值上限 25 MB —— 截图（建议 ≤300 KB）远在其内。
- **R2 存储桶绑定 `BUCKET`（可选）**：变量名称填 **`BUCKET`** 即可沿用旧配置。R2 开通需要绑卡，绑不上就不绑，不影响下单。两种同时绑定时以 `SHOTS` 为准。

写入的 key 沿用旧后端的目录形态 `付款记录/<用户名>/<时间戳>/付款截图.<扩展名>`；类型信息在 KV 里放 `metadata.contentType`、在 R2 里放 `httpMetadata.contentType`。

> **截图目前是只写**：`screenshot_key` 只是 D1 里的一行记录，KV 与 R2 都没有读回接口。要在管理后台直接看图，需要另外加一个读取接口。

## 请求走向

`frontend/_routes.json` 只把 `/api/*` 交给 Functions 执行，其余请求全部走不限量免费的静态分发。

## 迁移进度

**旧 Python 后端的全部接口已搬到 `functions/`**（迁移本身前端零改动；后续按需求把验证码收敛到只在登录页使用，改了 `frontend/` 下 4 个页面，见下文「验证码的使用范围」）。旧的 `legacy-backend/` 只留作对照，部署时不会上传，两边互不引用。

| 已迁移接口 | 说明 |
| --- | --- |
| `GET /api/captcha` | 验证码出题（7 种题型，无状态：答案签名进 session_id，TTL 300 秒） |
| `GET /api/products`、`/api/boosters`、`/api/boosters_info` | 公开只读，走 `caches.default` 边缘缓存 60 秒 |
| `POST /api/register`、`/api/login`、`/api/change_password`、`GET /api/profile` | 登录态用无状态 HS256 JWT |
| `POST /api/order/submit`、`GET /api/order/review` | 下单（截图转发到对象存储：KV 优先、R2 兼容）与评价 |
| `GET /api/booster/{orders,reviews}`、`POST /api/booster/{accept,complete,cancel}` | 打手工作台，订单状态机 `pending → verified → accepted → completed` |
| `GET /api/admin/{users,orders,reports,boosters_info,reviews}`、`POST /api/admin/user/*`（8 个）、`product/*`、`order/*`、`report/*`、`booster/*` | 管理后台全部动作，操作日志写 D1 表 `admin_log` |
| `GET /api/admin/shot?key=付款记录/…` | 管理员专用：读取付款截图原始字节（只认 `付款记录/` 前缀，KV / R2 都能读，响应带 `Cache-Control: private, no-store`） |

**不迁移的接口**：`/api/captcha/verify`、`/api/check_admin`、`/api/check_booster`、`/api/ping` —— 前端从未调用（`frontend/js/captcha.js` 里的 `verify()` 是死代码），留着也不会被触发。

### 验证码的使用范围

- **只有登录要验证码**：`POST /api/login` 必须带 `captcha_session` / `captcha_answer`，校验不过就回 `验证失败`。
- **其余接口一律不要求**：`POST /api/register`、`/api/change_password`、`/api/order/submit`、`/api/report/submit` 都不再校验验证码。它们仍然**接受**这两个字段但直接忽略，所以老客户端带着旧字段请求不会报错。
- 前端只有 `frontend/login.html` 加载 `frontend/js/captcha.js`；`order.html`、`report.html`、`profile.html` 的验证码区块、采集与提交逻辑均已删除，登录页的注册表单也不再显示验证码。

### 首次部署要做的三件事

> 最省事的做法：双击仓库根目录的 **「一键部署.bat」**，下面这三件事它都会替你生成好，你只要把生成的内容粘进 Cloudflare 网页。

1. **建表**（共 7 张表：`users`、`reports`、`orders`、`products`、`booster_info`、`reviews`、`admin_log`）——D1 控制台 → Console 里粘贴执行一次。语句由脚本生成到桌面 `悦翔电竞-D1建表.sql`（共 14 条，一行一条；如果控制台要求一次一条，就粘一行执行一次）。
2. **种一个管理员**：D1 里默认没有任何管理员账号（旧账号只存在于 `legacy-backend/accounts.json`，且都是 bcrypt 哈希）。脚本会生成一句 `INSERT INTO users ...`（PBKDF2 哈希，`op_level=3`），在同一个 D1 Console 里执行即可。
3. **配置环境变量**：`JWT_SECRET`（必填，缺失时验证码、登录等接口返回 500 `服务未配置`）、`DB`、`MAINTENANCE`；再绑定图片存储 `SHOTS`（KV，首选）或 `BUCKET`（R2，可选）；建议再加 `PWD_PEPPER`。

> **`PWD_PEPPER` 必须与生成种子哈希时用的一致且保持稳定**。它没配时回落 `JWT_SECRET` —— 所以**轮换 `JWT_SECRET` 会让所有密码失效**（用户只能靠管理员重置密码）。想以后能安全换 JWT 密钥，就现在单独设一个 `PWD_PEPPER`。

### 已知差异与限制（部署前请知悉）

- **双数据源**：`admin.html` 的商品读 D1（`/api/products`），而 `products.html` 读静态文件 `frontend/data/products.json`。Workers 运行时没有文件系统，无法把后台新增的商品写回静态 JSON —— 后台加了商品，前台页面不会自动出现，需手动同步这个文件。
- **CPU 开销已按免费版 10ms 上限压过一轮**：关键路径实测表、以及为了压进这条线做的取舍（低迭代 PBKDF2 + pepper、bcrypt 默认关闭、原生 base64 解码），见下文「免费版 CPU 预算与取舍」一节。
- **封禁语义**：旧后端封禁时会清空 token 使登录态立即失效；新实现是「token 仍可验签，各接口读到 `status='no'` 后拒绝」。目前查了 `status` 的是 `order/submit`、`profile`（都返回 403 `账号已封禁`，`profile.html` 依赖这个文案）与打手/管理员接口（返回 403 `无权限`）；**`order/review`、`change_password`、`report/submit` 只验签名不查封禁状态**，被封禁用户仍可评价/改密/举报（`report/submit` 为了保持「零 D1 读」的设计有意为之）。
- **边缘缓存只对匿名访客生效**：`frontend/js/common.js` 会给出 `/api/` 开头的请求自动带 `Authorization` 头，带 token 的请求一律绕过缓存直读 D1，这是设计如此（避免管理员看到脏数据）。
- **截图在前端先压再发**：`order.html` 选图后用 canvas 压到长边 ≤1280px、JPEG q0.7（仍超 300KB 就再降到 1024/800、q0.5），后端只做「解出字节 → 丢进对象存储」（KV 优先、R2 兼容），不二次压缩、不改格式；一个都没绑时订单照常提交，只是 `screenshot_key` 为空。
  - **请求体越大 CPU 越贵**（JSON 解析 + base64 解码都是按体积走的）：压缩后一般 80~220KB，下单整条链路约 4~5ms；不压缩的手机原图 1~3MB 会同时踩爆 10ms CPU 与 KV 1GB 存储（见下节）。
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

### 免费版额度预算（请求 / D1 / KV / 构建）

对照 Cloudflare 官方限额（Pages / Workers / D1 / KV 四个 Limits 页，2026-10 版）逐项算过，**只有一项会先撞**，其余余量都在千倍量级：

| 额度 | 免费版上限 | 本站用量 | 结论 |
| --- | --- | --- | --- |
| 静态资源请求 / 带宽 | 无限 | `frontend/` 24 个文件、约 0.45MB | 不设限 |
| 站点文件数 / 单文件 | 20,000 个 / 25MiB | 24 个，最大 158KB | 不设限 |
| Functions（`/api/*`）请求 | 100,000 / 天 | 一次页面浏览 0~3 次 | 余量千倍 |
| 单请求 CPU | 10ms | 登录约 1.7ms（PBKDF2 1000 次） | 够用 |
| D1 行读 / 行写 | 500 万 / 天、10 万 / 天 | 单次操作 1~3 行 | 够用 |
| D1 存储 | 5GB（单库 500MB） | 订单/用户表几 MB | 够用 |
| KV 读 / 写 | 100,000 读 / 天、**1,000 写 / 天** | 每日新增截图 ≈ 当日订单数 | 够用（≤1000 单/天） |
| **KV 存储** | **1GB / 账号** | 原图 1~3MB/张 → **几百张就满** | **会撞，已降标准** |
| Pages 构建 | 500 次 / 月、同时 1 个 | = push 次数 | 够用，别一天连点十几次 |

注意：**只有 `/api/*` 走 Functions 计请求**，静态页/图片/JS/CSS 既不计请求也不计带宽。

唯一会撞的 KV 存储已做两处「降标准」：

- **截图在浏览器里压缩**（`frontend/order.html`）：长边 ≤1280px、JPEG q0.7，仍超 300KB 再降到 1024/800 与 q0.5，压缩后一般 80~220KB，单张缩掉 90% 以上。
- **KV 里的截图保留 30 天后自动删除**（`functions/api/order/submit.js` 的 `SHOT_TTL_SECONDS`）：写入带 `expirationTtl`，稳态占用 = 30 天 × 日新增量，长期不会涨满 1GB。**代价是 30 天前的订单截图失效**；要更久就调大该常量，或改走 R2（免费 10GB，但需绑卡）。
- 附带：KV 写失败不再被静默吞掉，下单接口返回 `shot_failed: true`，下单页提示「截图没存上，请私聊发给客服」。

**付款截图现在能在后台直接看**：`GET /api/admin/shot?key=<截图地址>` —— 管理员专用（`op_level >= 3`），只认 `付款记录/` 前缀、拒绝 `..` 与反斜杠，KV 与 R2 都能读，返回原始字节且带 `Cache-Control: private, no-store`。`admin.html` 订单表新增「付款截图」列，有图的订单点「查看」即弹窗显示（前端用带 `Authorization` 头的 XHR 取回 blob 再显示，token 不进 URL）；没图显示「无」，超过 30 天或已被清理则提示「截图不存在或已过期（截图只保留 30 天）」。

### 本地验证

无 wrangler 也能验证：测试脚本在 `.dumate/tmp/` 下，`node` 直接运行。

- `.dumate/tmp/e2e-sqlite.mjs` —— **端到端主链路**（`node --experimental-sqlite`）：用真实 SQLite 执行建表 SQL（与 `deploy/prep.ps1` 内嵌的一致，7 表 + 7 索引），再直调全部 handler，跑通注册→登录→下单→核单→接单→完成→评价→改密→封禁，54 项断言。
- 单接口：`test-bcrypt.mjs`（6）、`test-password.mjs`（37）、`test-auth-cache.mjs`（31）、`test-readonly.mjs`（19）、`test-auth-api.mjs`（48）、`test-write-api.mjs`（38）、`test-booster-api.mjs`（35）、`test-admin-api.mjs`（157）。
- `.dumate/tmp/test-cpu-budget.mjs` —— **CPU 预算断言**（16 项）：关键路径逐个计时并在超预算时失败，同时断言没有任何文件静态导入 bcrypt。
- 全部脚本当前合计 **441 项断言，0 失败**。