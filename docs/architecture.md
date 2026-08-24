# ArkNexus 架构说明

## 1. 总览

ArkNexus 采用 **BFF + 微服务** 思路：

```
┌──────────────────┐         ┌─────────────────────────────────────────────┐
│  Browser / PWA   │  HTTPS  │  Vite Dev Server (前端)  /  Nginx (生产)     │
│  React + Antd    │ ──────► │  ├─ /api/v1/email/*  → email-service        │
└──────────────────┘         │  └─ /api/v1/.../*    → 未来其他服务           │
                             └─────────────────────────────────────────────┘
                                              │
                                              ▼
                  ┌───────────────────────────────────────────────────┐
                  │       email-service (FastAPI 单进程)               │
                  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
                  │  │ REST API    │  │ SMTP 接收   │  │ 后台调度     │ │
                  │  │ (FastAPI)   │  │ (aiosmtpd)  │  │ (APSched.)  │ │
                  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
                  │         └────────┬───────┘                │       │
                  │                  ▼                        ▼       │
                  │           ┌─────────────────┐   ┌─────────────────┐│
                  │           │  SQLite/PG      │   │ 附件文件系统     ││
                  │           └─────────────────┘   └─────────────────┘│
                  └───────────────────────────────────────────────────┘
```

## 2. email-service 设计

### 2.1 关键能力

| 能力 | 实现 |
|---|---|
| 随机生成邮箱地址 | `services/email_generator.py` 形词随机组合 + 数字后缀 |
| 接收邮件 | `smtp/server.py`（aiosmtpd Handler）监听 1025 端口 |
| 解析邮件 | `email` 标准库 + 自定义 multipart 处理，存入数据库 + 附件落盘 |
| 发送邮件 | `services/smtp_sender.py` 通过 SMTP 中继（开发环境可关闭或使用 MailHog） |
| 多邮箱切换 | 前端左侧栏一次性展示所有已创建邮箱，与 Gmail 切换账号一致 |
| 30 天保留 | `tasks/scheduler.py` 每小时扫描 + 删除过期邮箱/邮件/附件 |

### 2.2 数据模型

```
mailboxes              messages                  attachments
─────────              ────────                  ───────────
id (UUID PK)           id (UUID PK)              id (UUID PK)
address (unique)       mailbox_id (FK)           message_id (FK)
display_name           message_id (RFC822)       filename
created_at             from_address              content_type
expires_at             from_name                 size_bytes
last_accessed_at       subject                   storage_path
                       body_text                 content_id
                       body_html
                       raw_content
                       received_at
                       is_read
                       has_attachments
                       size_bytes
                       spam_score
```

### 2.3 API（v1）

| Method | Path | 说明 |
|---|---|---|
| `POST` | `/api/v1/mailboxes` | 创建一个新的随机邮箱（返回地址 + 30 天到期时间） |
| `GET` | `/api/v1/mailboxes` | 列出所有未过期的邮箱 |
| `GET` | `/api/v1/mailboxes/{id}` | 获取邮箱详情 |
| `PATCH` | `/api/v1/mailboxes/{id}` | 更新显示名 / 重置到期时间 |
| `DELETE` | `/api/v1/mailboxes/{id}` | 删除邮箱（含邮件与附件） |
| `GET` | `/api/v1/mailboxes/{id}/messages` | 列出该邮箱的邮件 |
| `GET` | `/api/v1/messages/{id}` | 读取单封邮件 |
| `PATCH` | `/api/v1/messages/{id}` | 标记已读 / 星标 |
| `DELETE` | `/api/v1/messages/{id}` | 删除邮件 |
| `GET` | `/api/v1/messages/{id}/attachments/{att_id}` | 下载附件 |
| `POST` | `/api/v1/mailboxes/{id}/send` | 从该邮箱发信 |
| `GET` | `/api/v1/system/stats` | 服务运行状态 / 统计信息 |

### 2.4 SMTP 接收

- 在 `aiosmtpd` 中注册一个 `MessageStorageHandler`：
  - `handle_RCPT`：校验收件人域名 == `EMAIL_DOMAIN`，若对应邮箱已存在则接受，否则**直接丢弃**（不创建未声明邮箱）。
  - `handle_DATA`：解析完整 RFC822 内容，写库 + 落盘附件。
- 这是为了避免无限堆积垃圾邮件；只有当用户主动创建邮箱后，对应地址才会真正"激活"接收。

### 2.5 SMTP 发送

- 通过 `aiosmtplib` 调用外部 SMTP 中继：
  - `SMTP_RELAY_HOST/PORT/USER/PASS` 从 `.env` 读取。
  - 未配置时退回为 `console` 后端（仅打印日志），便于开发联调。

### 2.6 数据保留

- `APScheduler` 启动一个 **IntervalTrigger(hours=1)** 任务：
  1. 删除 `mailboxes.expires_at < now()` 的邮箱；
  2. 删除 `messages.received_at < now() - 30d` 的邮件；
  3. 物理清理孤儿附件文件。
- 提供 `POST /api/v1/system/cleanup` 手动触发，便于测试。

## 3. 前端设计

- **入口**：`/`（Dashboard，列出所有已接入的小工具）。
- **临时邮箱**：`/email`，布局参考 Gmail：
  - 左栏：邮箱列表（创建、切换、删除、剩余天数）。
  - 中栏：选中邮箱下的邮件列表。
  - 右栏：邮件内容（HTML 渲染 + 附件下载 + 回复 / 转发）。
  - 顶栏：手动刷新 / 自动刷新间隔（默认 15s）。

## 4. 后续规划

- `gateway`：统一路由、限流、跨服务鉴权。
- `auth-service`：JWT 颁发 / 刷新，把"匿名临时邮箱"升级到"登录用户隔离的临时邮箱"。
- 其余工具型服务按需独立添加。