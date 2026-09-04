# ArkNexus 部署到 Cloudflare

本文档描述如何把 ArkNexus 部署到 **Cloudflare Pages**（前端）+ **Cloudflare Tunnel**（后端）。

## 架构总览

```
                  Cloudflare 边缘
            ┌────────────────────────────┐
            │  Pages (前端 SPA)            │
            │  arknexus.example.com         │
            └────────────────────────────┘

            ┌────────────────────────────┐
            │  Tunnel (cloudflared)        │
            │   api.example.com → gateway  │
            │   smtp.example.com:1025      │
            └────────────────────────────┘
                          │ outbound-only
                          ▼
            ┌────────────────────────────┐
            │  Linux VPS (任意供应商)      │
            │  docker compose up           │
            │  ┌────────┐ ┌────────────┐ │
            │  │gateway │ │email-service│ │
            │  │:8080   │ │:8000+:1025  │ │
            │  └────────┘ └────────────┘ │
            │  ┌────────┐ ┌────────────┐ │
            │  │ai-svc  │ │config-svc  │ │
            │  │:8001   │ │:8081       │ │
            │  └────────┘ └────────────┘ │
            └────────────────────────────┘
```

> **为什么不是 Cloudflare Workers？** ArkNexus 是 Python/FastAPI。Workers 只支持 JavaScript / WASM / Rust，跑不了 `aiosmtpd`、SQLAlchemy 同步/异步混用等。把后端留在 Docker 里、通过 Tunnel 反向代理到边缘，是最低成本、最高可控的方案。

---

## 0. 先决条件

| 工具 | 用途 |
|---|---|
| **Cloudflare 账号** + 一个域名（example.com） | 全栈都在你的域下 |
| **Node.js 20+** | 跑 Vite 构建 |
| **Linux VPS**（任意云，最低 1 GB RAM 即可） | 跑 4 个 Python 服务 + cloudflared |
| 域名 DNS 已迁到 Cloudflare（橙色云朵） | 才能用 Tunnel + Pages |
| `wrangler` CLI（`npm i -g wrangler`） | 部署前端 |
| `cloudflared`（VPS 上） | 建立 Tunnel |

---

## 1. 一键部署前端（Cloudflare Pages）

### 方式 A：通过 Git 集成（推荐）

1. Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. 选 `ArkNexus` 仓库，配置：
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
3. **Environment variables**（Advanced）：
   ```
   VITE_API_BASE_URL = https://api.example.com/api/v1
   ```
4. **Save and Deploy**。每次 `git push main` 自动部署。

### 方式 B：CLI 直接部署

```bash
# 在 frontend/ 目录下
npm install
VITE_API_BASE_URL=https://api.example.com/api/v1 npm run build
npx wrangler login                       # 浏览器授权一次
npx wrangler pages deploy dist --project-name arknexus
```

脚本封装版：

```bash
CLOUDFLARE_PAGES_PROJECT=arknexus \
VITE_API_BASE_URL=https://api.example.com/api/v1 \
    ./scripts/deploy-pages.sh
```

### 自定义域名

Dashboard → Pages → `arknexus` → **Custom domains** → 添加 `arknexus.example.com`，Cloudflare 自动签发证书。

---

## 2. 部署后端到 VPS

### 2.1 准备 VPS（首次，Ubuntu 22.04+）

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 登录 cloudflared
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
    | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" \
    | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install -y cloudflared
```

### 2.2 创建 Tunnel

```bash
cloudflared tunnel login                       # 浏览器授权你的域名
cloudflared tunnel create arknexus            # 打印 UUID
# 把 JSON 凭据放到 deploy/cloudflared/<UUID>.json

# 绑定 DNS
cloudflared tunnel route dns arknexus api.example.com
cloudflared tunnel route dns arknexus smtp.example.com  # 仅在 Dashboard 里手动加也可

# 输出 token（docker-compose 需要）
cloudflared tunnel token arknexus
```

### 2.3 配置 secrets

```bash
cd ArkNexus
cp deploy/.env.production.example deploy/.env.production
# 编辑 deploy/.env.production，把所有 CHANGE_ME 替换成真值
openssl rand -base64 48   # 给 JWT_SECRET / OAUTH_STATE_SECRET
```

### 2.4 推送 + 启动

```bash
REMOTE_HOST=ubuntu@your-vps.example.com \
REMOTE_DIR=/opt/arknexus \
    ./scripts/deploy-backend.sh
```

`deploy-backend.sh` 会：
1. `rsync` 源码到 VPS
2. 远端 `docker compose build` + `up -d`
3. 等待 20 秒健康检查

---

## 3. 配置 OAuth 回调

OAuth 提供商需要在控制台里把回调地址改成：

| Provider | Callback URL |
|---|---|
| GitHub | `https://api.example.com/api/v1/auth/oauth/github/callback` |
| Google | `https://api.example.com/api/v1/auth/oauth/google/callback` |
| Microsoft | `https://api.example.com/api/v1/auth/oauth/microsoft/callback` |

`deploy/.env.production` 里把 `OAUTH_REDIRECT_BASE=https://api.example.com` 与之对齐。

---

## 4. SMTP 接收邮件 ⚠️

Cloudflare 边缘**不直接处理入站 SMTP**（25/465/587 端口被刻意屏蔽以防滥用）。生产部署的两种推荐方案：

### 方案 A：用第三方中继转发（最简单）

- 注册 [Mailgun](https://mailgun.com) / [Postmark](https://postmarkapp.com) / [Amazon SES](https://aws.amazon.com/ses/)
- 把 `smtp.example.com`（即你的 Tunnel 入口）的 1025 端口配为该服务的 **inbound relay**
- 在 ArkNexus 把 `EMAIL_DOMAIN` 设为该服务商绑定的域名（如 `mg.example.com`）

### 方案 B：前置 Postfix（完全自托管）

在 VPS 上跑一个 Postfix，把所有入站邮件转发到 127.0.0.1:1025：

```bash
sudo apt install -y postfix
# /etc/postfix/main.cf
virtual_transport = arknexus_pipe
# /etc/postfix/master.cf
arknexus_pipe unix - n n - - pipe
    flags=FR user=app argv=/usr/local/bin/forward-to-arknexus.sh
```

MX 记录指向 VPS 公网 IP；Postfix → cloudflared tunnel → :1025。

---

## 5. 自定义域名 + HTTPS

全部由 Cloudflare 自动处理：

- **Pages**：Dashboard → Custom domains → `arknexus.example.com` → 自动签发边缘证书
- **Tunnel**：Dashboard → Zero Trust → Networks → Tunnels → `arknexus` → **Public hostname** 添加：
  - `api.example.com` → service `http://gateway:8080`
  - `smtp.example.com` → service `tcp://localhost:1025`（需在路由里勾 TCP）

TLS 终止在 Cloudflare 边缘，后端始终是 HTTP。

---

## 6. 监控 + 维护

### 健康检查

```bash
curl -fsS https://api.example.com/health
curl -fsS https://api.example.com/api/v1/system/stats
```

### 日志

```bash
ssh ubuntu@your-vps "docker compose -f /opt/arknexus/deploy/docker-compose.production.yml \
    --env-file /opt/arknexus/deploy/.env.production logs -f --tail=200"
```

### 备份

```bash
# 数据库 + 附件卷
ssh ubuntu@your-vps "tar czf /tmp/arknexus-snapshot.tgz \
    /var/lib/docker/volumes/arknexus_email-data \
    /var/lib/docker/volumes/arknexus_config-data \
    /var/lib/docker/volumes/arknexus_ai-data"
scp ubuntu@your-vps:/tmp/arknexus-snapshot.tgz ./backups/
```

### 滚动更新

```bash
# 修改代码 → git commit → 推送到 main → 触发 GitHub Actions 或手动：
./scripts/deploy-backend.sh
./scripts/deploy-pages.sh    # 若前端有改动
```

---

## 7. 成本预估

| 项 | 月费（USD） |
|---|---|
| Cloudflare Pages（免费层） | $0 |
| Cloudflare Tunnel（无限 tunnel） | $0 |
| VPS（Hetzner CAX11 / DigitalOcean Basic Droplet） | $4–6 |
| Cloudflare 域名（.com） | ~$10/年 |
| **合计** | **~$5/月** |

不付费即可获得：全球 CDN、自动 HTTPS、零信任 DDoS 防护、Daily Analytics、Workers Free 10 万次/天（如未来想迁移某服务到 Workers）。

---

## 8. 故障排查

| 症状 | 排查 |
|---|---|
| 前端打开白屏 | 浏览器 Console 看 `import.meta.env.VITE_API_BASE_URL` 是否替换正确；重新 `npm run build` |
| API 返回 401 | JWT_SECRET 在 4 个服务间必须一致（gateway / email-service / ai-service / config-service 共享） |
| 邮件不进收件箱 | 检查 `docker logs email-service` 看 SMTP handler 日志；用 `dig MX example.com` 确认 MX 指向中继 |
| Tunnel 离线 | `cloudflared tunnel info arknexus` 查看状态；重启 `docker compose restart cloudflared` |
| 后端 OOM | 检查 `docker stats`；考虑升级 VPS 或拆分 ai-service 到独立节点 |

---

## 9. 进阶（未来）

- **D1 迁移**：SQLite → Cloudflare D1（Workers 原生 SQL）。需要把 SQLAlchemy 同步/异步混合代码全部改成 SQLAlchemy Core + aiosqlite 的 D1 兼容模式。**不建议**——D1 是 Workers-only，目前 ArkNexus 还得跑 Python 后端。
- **R2 迁移**：附件 → R2。只需把 `services/email_parser.py` 里的 `_write_bytes` 改成上传到 R2（用 `boto3` 或 Cloudflare 的 S3 兼容 SDK），URL 改成 `https://attachments.example.com/...`。
- **Workers AI 接入**：把 `backend/shared/llm_catalog.py` 里的某个 provider 改成 Cloudflare Workers AI（无 API key、按字符计费），前端无需改动。
- **Cloudflare R2 + 缓存**：邮件 body 用 R2 存静态文件，前面挂 CDN 缓存。
