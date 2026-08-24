# OAuth 登录（GitHub / Google）

ArkNexus email-service 现在支持 GitHub 与 Google OAuth 登录。设计上保持"轻依赖、可插拔"：要新增 provider（如 GitLab / Gitee），只需在 `app/services/oauth.py` 实现一个 `OAuthProvider` 子类，无需改业务层。

## 1. 流程

```
+------------+      1. /auth/oauth/{provider}/start         +-------------+
|  Browser   | -----------------------------------------> | email-service |
|            | <-------- 302 to provider consent ----     |              |
|            |                                              +-------------+
|            |      2. user grants access                  (GitHub / Google)
|            |                                              ...
|            |      3. provider 302s back to /callback     +-------------+
|            | -----------------------------------------> | email-service |
|            |                                              |  - exchange code
|            |                                              |  - find/create user
|            |                                              |  - issue JWT
|            | <----- HTML via localStorage redirect ----- |              |
+------------+                                              +-------------+
```

`/auth/oauth/{provider}/callback` 默认返回一段 HTML 注入脚本，把 token 与 user 写入 `localStorage` 然后 `replace("/")`。前端无需 popup 或 fetch 调用。

## 2. 配置

`.env`（或 email-service 的 `.env`）里加上：

```ini
OAUTH_REDIRECT_BASE=http://127.0.0.1:8080
OAUTH_STATE_SECRET=change-me-oauth-state

OAUTH_GITHUB_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
OAUTH_GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx

OAUTH_GOOGLE_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
OAUTH_GOOGLE_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
```

- **GitHub** OAuth App 在 https://github.com/settings/developers 创建，callback URL 写成：`<OAUTH_REDIRECT_BASE>/api/v1/auth/oauth/github/callback`
- **Google** OAuth client 在 https://console.cloud.google.com/apis/credentials，新增 "OAuth client ID" → "Web application"，同样的 redirect URI。

填好之后只要重启 email-service 即可生效。`/api/v1/auth/oauth/providers` 端点会返回当前已配置的 provider。

## 3. 端点

| 路径 | 说明 |
|------|------|
| `GET /api/v1/auth/oauth/providers` | 列出已配置的 provider（无需鉴权） |
| `GET /api/v1/auth/oauth/{provider}/start` | 302 重定向到 provider 授权页 |
| `GET /api/v1/auth/oauth/{provider}/callback` | 处理回调，颁发 JWT |

## 4. 链接策略

首次 OAuth 登录：

1. 如果 `(provider, provider_user_id)` 已经在 `oauth_accounts` 表中存在 → 直接登录该用户。
2. 否则按 `provider_email` 匹配已有用户：
   - 命中 → 把 OAuth 账号挂到该用户下（邮箱自动验证 `is_verified=True`）。
   - 未命中 → 创建新用户（密码设为随机值，用户只能通过 OAuth 登录；如果想重置密码，可以另开路由）。

后续 OAuth 登录只会更新 `access_token` / `refresh_token` / `expires_at`。

## 5. 与 gateway 协作

gateway 的 `public_path_prefixes` 现在多了一行 `/api/v1/auth/oauth`，所以 OAuth 回调无需 JWT。同时 `oauth_redirect_base` 默认指向 `http://127.0.0.1:8080`。如果是直接访问 email-service（绕过 gateway），改成 `http://127.0.0.1:8000`。

## 6. 后续可铺的方向

- provider 配置走 config-service（不必重启每个 email-service 实例）
- 把 OAuth 拿到的 `refresh_token` 用于自动同步联系人/头像
- 支持同一用户解绑 / 重新绑定 OAuth 账号（profile 页面）
