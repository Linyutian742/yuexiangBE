# 悦翔电竞（静态前端 + Cloudflare Pages Functions）

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `frontend/` | 静态站点：页面、样式、脚本、图片、静态数据。部署时的**输出目录** |
| `functions/` | Cloudflare Pages Functions，位于仓库根，按文件路径自动生成接口路由 |
| `db/schema.sql` | D1 建表脚本，部署前在 Cloudflare 控制台执行一次 |
| `backend/` | 旧的 Python 后端，仅供本地测试，**已被 `.gitignore` 排除，不会上传** |
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
| 框架预设（Framework preset） | None |
| 构建命令（Build command） | 留空 |
| 构建输出目录（Build output directory） | `frontend` |
| 根目录（Root directory） | 仓库根 |

`functions/` 不需要构建，Pages 会自动识别并打包。

## 绑定与环境变量（控制台配置）

| 名称 | 类型 | 用途 |
| --- | --- | --- |
| `DB` | D1 数据库 | 用户、订单、举报数据 |
| `JWT_SECRET` | 密钥（加密保存） | 登录态 JWT 的签名与校验 |
| `MAINTENANCE` | 文本变量 | 填 `1` 表示维护中，下单接口会拒绝 |
| `BUCKET` | R2 存储桶 | 付款截图等图片（图片上传功能接入后再绑定） |

## 请求走向

`frontend/_routes.json` 只把 `/api/*` 交给 Functions 执行，其余请求全部走不限量免费的静态分发。

## 迁移进度

已搬到 `functions/` 的接口：`/api/report/submit`、`/api/order/submit`。

其余 `/api/*`（`products`、`boosters`、`boosters_info`、`profile`、`login`、`register`、`captcha`、`admin/*`、`booster/*`、`order/review` 等）仍在旧的 `backend/` 中，尚未搬迁；在搬迁完成前，线上这些功能会返回 404。