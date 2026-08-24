# ArkNexus — 个人超级工作台

> 由 **Python FastAPI + React + Ant Design** 驱动的微服务化个人工作台。
> 已交付：**首次启动初始化流程**、**临时邮箱服务**（仅收件）、**统一配置服务（config-service）**、**API 网关**、**用户体系 + JWT + 管理员**、**Alembic 迁移**、**标签 / 文件夹 / 回收站**、**全文搜索 + 高亮**、**OAuth 登录（GitHub / Google）**、**AI 助手（22 家国内外 / 中转大模型 + 多会话 + 流式输出）**。

## 当前进度

| 服务 | 状态 | 端口 | 说明 |
|---|---|---|---|
| `email-service` | ✅ | API `8000` / SMTP `1025` | 临时邮箱（收件）、自定义文件夹、标签、回收站、PG tsvector 搜索、OAuth 登录 |
| `config-service` | ✅ | `8081` | 服务注册表 + 配置项存储 + 变更审计 + 心跳 + LLM 目录 |
| `ai-service` | ✅ | `8001` | 多模型 AI 对话（22 家国内外 / 中转大模型预置），仅需 API Key；会话持久化、SSE 流式输出 |
| `gateway` | ✅ | `8080` | JWT 边缘校验 + 反向代理 + init/oauth 路径白名单 |
| `auth`（email-service 内） | ✅ | — | 注册 / 登录 / me + bcrypt + HS256 JWT + admin 角色 + OAuth 链接 |
| 前端 | ✅ | `5173`（dev） | Ant Design 5 + React 18 + TS + Vite；包含 `/init` 引导与 OAuth 登录按钮 |

## 首次启动（Init Flow）

> 当系统第一次启动时（数据库里没有 `initialized=true`），会自动进入 **初始化向导**：
> 配置数据库 →（可选 Redis）→ 域名 → 管理员账号 → 完成。
> 完成后才能进入正常登录页。

入口：

```
GET /api/v1/init/status       # 检查系统是否已初始化（公开）
POST /api/v1/init/step/database
POST /api/v1/init/step/redis
POST /api/v1/init/step/domain
POST /api/v1/init/step/admin
POST /api/v1/init/finish
```

向导把每个选择写进 `system_state` 表，最后 `finish` 翻转 `initialized=true`。

如需**重置**（重新走向导）：

```powershell
cd backend\services\email-service
Remove-Item data\email_service.db
python scripts\init_db.py   # alembic upgrade head
python -m app.main
```

## 目录结构

```
ArkNexus/
├── backend/
│   ├── shared/                  # 跨服务共享模块（LLM 服务商目录）
│   └── services/
│       ├── config-service/      # 服务注册 + 配置中心 + 心跳
│       ├── email-service/       # 临时邮箱
│       ├── ai-service/          # 多模型 AI 对话（22 家预置）
│       └── gateway/             # JWT + 反向代理 + SSE 透传
├── frontend/
│   └── src/apps/
│       ├── init/                # /init 引导页 + 步骤状态机
│       ├── auth/                # /login
│       ├── email/               # /email 临时邮箱
│       ├── ai/                  # /ai/chat AI 会话（GPT 风格）
│       ├── settings/            # /settings 系统设置
│       └── dashboard/           # / 概览
├── docs/
│   ├── architecture.md
│   └── smtp-receive.md
└── scripts/
    ├── dev-start.ps1            # 一键拉起全部后端 + 前端
    └── start-ai.ps1             # 只启动 ai-service
```

## 快速开始

```powershell
# 一键启动 3 后端 + 前端（首次会自动进入 /init 向导）
powershell -ExecutionPolicy Bypass -File scripts\dev-start.ps1
```

或手起：

```powershell
# T1 config-service
cd backend\services\config-service
.\.venv\Scripts\Activate.ps1
python scripts\init_db.py
python -m app.main            # :8081

# T2 email-service（启动后访问 :5173 进入 /init 完成配置）
cd backend\services\email-service
copy .env.example .env        # CONFIG_SERVICE_URL 指向 :8081
.\.venv\Scripts\Activate.ps1
python -m app.main            # :8000 + SMTP :1025

# T3 gateway
cd backend\services\gateway
copy .env.example .env
.\.venv\Scripts\Activate.ps1
python -m app.main            # :8080

# T4 frontend
cd frontend
npm install
npm run dev                   # :5173
```

打开 <http://localhost:5173> → 自动跳到 `/init` → 走完 4-5 步 → `/login` 用刚创建的 admin 账号登录。

## 关键设计

- **首次访问路由**：前端 `ProtectedRoute` + `LoginPage` 都先调 `GET /init/status`，未初始化则强制跳到 `/init`；初始化完成后 `/init` 自己跳到 `/login`。
- **gateway init 路径白名单**：`/api/v1/init/*` 在 `PUBLIC_PATH_PREFIXES` 里，无需 JWT。
- **JWS 复用**：email-service / config-service / gateway 共用 `JWT_SECRET`，admin 登录后可直接进入临时邮箱、系统设置等受保护页面。
- **DB & Redis 配置项**：DB 默认 SQLite（嵌入式，零部署）；Redis 可选，留空跳过。当前代码不实际连接 Redis（保留给未来的缓存/限流使用），但 URL 已存到 `system_state`。
- **重启生效**：`database_url` 的修改需要重启服务才能让 SQLAlchemy 重新连。向导会显示当前生效的 URL；如需换库请同时改 `.env` 或清理 `data/*.db`。

## 测试

```powershell
cd backend\services\email-service   ; .\.venv\Scripts\python.exe -m pytest   # 28 passed
cd backend\services\config-service  ; .\.venv\Scripts\python.exe -m pytest   #  7 passed
```

## 路线图

- [ ] docker-compose 部署栈（3 服务 + 可选 PG）
- [ ] 把 wizard 收集的 `database_url` 自动写入 `.env`，init finish 后提示用户重启
- [ ] 真正接入 Redis 用于限流 / 缓存
- [ ] 多管理员 + RBAC
- [ ] 其他工具型微服务（备忘 / 待办 / 文件转换）