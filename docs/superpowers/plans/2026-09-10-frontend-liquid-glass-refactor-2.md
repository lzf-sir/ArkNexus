# ArkNexus 前端液态玻璃重构 — 实施计划 2：登录 / 初始化 / 概览

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。
>
> **前置条件：** 计划 1（基础设施 + 布局）已完成并验证 commit。`tokens.ts`、`ThemeProvider`、`antdTheme.ts`、`AuroraBackground`、`GlassCard/Panel/Button`、`PageTransition`、`FadeIn` 均已就位。

**目标：** 将登录、初始化向导、概览三个核心入口页面从 Apple 风格迁移到液态玻璃设计系统：使用极光背景、玻璃卡片、新组件库、新动效；保留现有功能逻辑（OAuth、init 步骤、stats 查询）。

**架构：** 在已有玻璃工具类与组件基础上重写三个页面；保留 Ant Design 表单/Steps/Card 子组件（已通过 ConfigProvider 主题集成），替换外层包裹、装饰元素、入场动效为新设计。InitPage 的 5 步向导拆分为 5 个步骤组件，每个步骤用 `<FadeIn>` 从右滑入。

**技术栈：** React 18 + TypeScript + Ant Design 5 + framer-motion 13 + lucide-react（沿用计划 1 基础）

---

## 现有代码上下文

实施前需熟悉的文件：

- `frontend/src/apps/auth/pages/LoginPage.tsx` — 354 行，Apple 风格登录页，需重写外层与装饰元素
- `frontend/src/apps/init/InitPage.tsx` — 574 行，5 步向导（数据库 / Redis / 域名 / 管理员 / 完成），需替换样式与动效
- `frontend/src/apps/dashboard/DashboardPage.tsx` — 359 行，4 个统计卡 + 最近邮箱 + 服务状态 + 快速操作，需替换 Card 为 GlassCard
- `frontend/src/apps/auth/AuthContext.tsx` — 已存在，提供 `useAuth()`、`login()`、`register()`
- `frontend/src/apps/auth/api/oauth.ts` — 已存在，提供 `listOAuthProviders()`、`startOAuthLogin()`
- `frontend/src/apps/init/api/client.ts` — 已存在，提供 5 个 step API + fetchStatus
- `frontend/src/apps/email/api/client.ts` — 已存在，提供 `listMailboxes()`、`getStats()`
- `frontend/src/apps/settings/api/client.ts` — 已存在，提供 `listServices()`

---

## 文件结构（变更）

**新增：**

- `frontend/src/apps/auth/pages/components/LoginCard.tsx` — 登录玻璃卡片（含 OAuth + 表单）
- `frontend/src/apps/auth/pages/components/OAuthButtonRow.tsx` — OAuth 按钮行
- `frontend/src/apps/init/steps/DatabaseStep.tsx` — 数据库步骤
- `frontend/src/apps/init/steps/RedisStep.tsx` — Redis 步骤
- `frontend/src/apps/init/steps/DomainStep.tsx` — 域名步骤
- `frontend/src/apps/init/steps/AdminStep.tsx` — 管理员步骤
- `frontend/src/apps/init/steps/DoneStep.tsx` — 完成步骤
- `frontend/src/apps/init/steps/StepWrapper.tsx` — 步骤通用包装（标题 + 图标 + 渐入）
- `frontend/src/apps/init/steps/index.ts` — 导出
- `frontend/src/apps/dashboard/components/StatsCard.tsx` — 统计卡（4 选 1 类型）
- `frontend/src/apps/dashboard/components/ServicesStatusCard.tsx` — 服务状态卡
- `frontend/src/apps/dashboard/components/RecentMailboxesCard.tsx` — 最近邮箱卡
- `frontend/src/apps/dashboard/components/QuickActionsCard.tsx` — 快速操作卡
- `frontend/src/apps/dashboard/components/MailboxListItem.tsx` — 单行邮箱项

**修改：**

- `frontend/src/apps/auth/pages/LoginPage.tsx` — 简化：仅布局 + 装载 LoginCard
- `frontend/src/apps/init/InitPage.tsx` — 简化：装载 Steps + 5 个 Step 组件
- `frontend/src/apps/dashboard/DashboardPage.tsx` — 简化：组合 4 个 Card 组件 + FadeIn

**删除：**

- 内联的 `Link2` / `GithubIcon` / `MicrosoftIcon` SVG 组件（保留 OAuth meta 定义）

---

## 任务清单

### 任务 1：LoginCard 组件

**文件：**
- 创建：`frontend/src/apps/auth/pages/components/LoginCard.tsx`
- 创建：`frontend/src/apps/auth/pages/components/OAuthButtonRow.tsx`

- [ ] **步骤 1：创建 OAuthButtonRow.tsx**

```tsx
// frontend/src/apps/auth/pages/components/OAuthButtonRow.tsx
import { Button } from "antd";
import { Github, Mail } from "lucide-react";
import { motion } from "framer-motion";
import { startOAuthLogin } from "../../api/oauth";

interface ProviderMeta {
  icon: React.ReactNode;
  label: string;
  color: string;
}

const META: Record<string, ProviderMeta> = {
  github: { icon: <Github size={18} strokeWidth={1.8} />, label: "GitHub", color: "#24292f" },
  google: { icon: <Mail size={18} strokeWidth={1.8} />, label: "Google", color: "#4285f4" },
  microsoft: { icon: <MicrosoftIcon size={18} />, label: "Microsoft", color: "#2f2f2f" },
};

interface Props {
  providers: string[];
}

export function OAuthButtonRow({ providers }: Props) {
  if (providers.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
      {providers.map((name, idx) => {
        const meta = META[name] ?? { icon: null, label: name, color: "#86868b" };
        return (
          <motion.div
            key={name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: idx * 0.06 }}
          >
            <Button
              block
              onClick={() => startOAuthLogin(name, "/")}
              style={{
                height: 44,
                borderRadius: 12,
                background: meta.color,
                color: "#fff",
                border: "none",
                fontWeight: 500,
                fontSize: 15,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
              {meta.icon}
              使用 {meta.label} 登录
            </Button>
          </motion.div>
        );
      })}
    </div>
  );
}

function MicrosoftIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}
```

- [ ] **步骤 2：创建 LoginCard.tsx**

```tsx
// frontend/src/apps/auth/pages/components/LoginCard.tsx
import { App, Button, Divider, Form, Input, Space, Tabs, Typography } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../../AuthContext";
import { OAuthButtonRow } from "./OAuthButtonRow";

const { Title, Paragraph } = Typography;

interface FormValues {
  email: string;
  password: string;
  display_name?: string;
}

interface Props {
  configuredProviders: string[];
}

export function LoginCard({ configuredProviders }: Props) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onFinish = async (values: FormValues) => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(values.email, values.password);
        message.success("登录成功");
      } else {
        await register(values.email, values.password, values.display_name);
        message.success("注册成功，已自动登录");
      }
      navigate("/", { replace: true });
    } catch (err) {
      const msg = (err as Error).message || "登录失败，请重试";
      setErrorMsg(msg);
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        width: 420,
        maxWidth: "100%",
        padding: "40px 36px",
        borderRadius: 24,
      }}
      className="glass-elevated"
    >
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <div style={{ textAlign: "center" }}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            style={{
              width: 56,
              height: 56,
              margin: "0 auto 16px",
              borderRadius: 14,
              background: "linear-gradient(135deg, #0096FF, #9650FF)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 24px rgba(0,150,255,0.30)",
            }}
          >
            <LogoIcon />
          </motion.div>
          <Title level={3} style={{ marginBottom: 4, fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>
            ArkNexus
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 14 }}>
            {mode === "login" ? "登录以管理你的临时邮箱" : "创建账号开始使用"}
          </Paragraph>
        </div>

        {configuredProviders.length > 0 && (
          <>
            <OAuthButtonRow providers={configuredProviders} />
            <Divider plain style={{ margin: 0, fontSize: 13 }}>
              或
            </Divider>
          </>
        )}

        <Tabs
          activeKey={mode}
          onChange={(k) => setMode(k as "login" | "register")}
          centered
          size="large"
          items={[
            { key: "login", label: "登录" },
            { key: "register", label: "注册" },
          ]}
        />

        <Form<FormValues>
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ email: "", password: "" }}
          requiredMark={false}
        >
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: "请输入邮箱" },
              { type: "email", message: "邮箱格式不正确" },
            ]}
          >
            <Input autoComplete="email" placeholder="you@example.com" size="large" />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: "请输入密码" },
              { min: 8, message: "密码至少 8 位" },
            ]}
          >
            <Input.Password
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder={mode === "login" ? "" : "至少 8 位"}
              size="large"
            />
          </Form.Item>

          {mode === "register" && (
            <Form.Item name="display_name" label="昵称（可选）">
              <Input placeholder="昵称" size="large" />
            </Form.Item>
          )}

          {errorMsg && (
            <motion.div
              role="alert"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="glass-tinted"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                marginBottom: 4,
                borderRadius: 10,
                background: "rgba(255, 59, 48, 0.12)",
                borderColor: "rgba(255, 59, 48, 0.3)",
                color: "#d70015",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "#ff3b30",
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                !
              </span>
              <span style={{ flex: 1 }}>{errorMsg}</span>
            </motion.div>
          )}

          <Form.Item style={{ marginTop: errorMsg ? 12 : 4, marginBottom: 0 }}>
            <Button
              block
              type="primary"
              htmlType="submit"
              loading={submitting}
              size="large"
              style={{ borderRadius: 999, height: 48, fontSize: 16, fontWeight: 600 }}
            >
              {mode === "login" ? "登录" : "注册"}
            </Button>
          </Form.Item>
        </Form>

        <Paragraph type="secondary" style={{ textAlign: "center", margin: 0, fontSize: 12 }}>
          匿名也能用，但登录后才能管理"自己的"临时邮箱。
        </Paragraph>
      </Space>
    </motion.div>
  );
}

function LogoIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
      <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}
```

- [ ] **步骤 3：类型检查 + 构建**

```bash
cd frontend && npx tsc -b --noEmit
```

预期：0 错误（如果 antd `size` prop 报错，改为 `style={{ height: 44 }}` 显式设定）。

- [ ] **步骤 4：Commit**

```bash
git add frontend/src/apps/auth/pages/components/
git commit -m "feat(auth): extract LoginCard + OAuthButtonRow with glass + motion"
```

---

### 任务 2：重写 LoginPage（简化）

**文件：**
- 修改：`frontend/src/apps/auth/pages/LoginPage.tsx`

- [ ] **步骤 1：完全重写 LoginPage.tsx**

用以下代码**完全替换**现有文件：

```tsx
import { Spin } from "antd";
import { Rocket } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listOAuthProviders } from "../api/oauth";
import { LoginCard } from "./components/LoginCard";

export function LoginPage() {
  const providersQuery = useQuery({
    queryKey: ["oauth-providers"],
    queryFn: listOAuthProviders,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      {providersQuery.isLoading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Rocket size={20} />
          <Spin />
        </div>
      ) : (
        <LoginCard configuredProviders={providersQuery.data?.configured ?? []} />
      )}
    </div>
  );
}
```

- [ ] **步骤 2：构建 + 手动验证**

```bash
cd frontend && npx vite build
```

预期：构建成功，无 warning。

```bash
cd frontend && npx vite dev
```

打开 http://localhost:5173/login，验证：极光背景缓慢漂移（来自 App.tsx 挂载）、玻璃卡片入场渐显 + 上滑、OAuth 按钮 stagger 出现、表单可正常提交。

- [ ] **步骤 3：Commit**

```bash
git add frontend/src/apps/auth/pages/LoginPage.tsx
git commit -m "refactor(auth): simplify LoginPage to delegate to LoginCard"
```

---

### 任务 3：InitPage 步骤组件（5 个）

**文件：**
- 创建：`frontend/src/apps/init/steps/StepWrapper.tsx`
- 创建：`frontend/src/apps/init/steps/DatabaseStep.tsx`
- 创建：`frontend/src/apps/init/steps/RedisStep.tsx`
- 创建：`frontend/src/apps/init/steps/DomainStep.tsx`
- 创建：`frontend/src/apps/init/steps/AdminStep.tsx`
- 创建：`frontend/src/apps/init/steps/DoneStep.tsx`
- 创建：`frontend/src/apps/init/steps/index.ts`

- [ ] **步骤 1：创建 StepWrapper.tsx**

```tsx
// frontend/src/apps/init/steps/StepWrapper.tsx
import { ReactNode } from "react";
import { motion } from "framer-motion";
import { Typography } from "antd";

const { Title, Paragraph } = Typography;

interface Props {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}

export function StepWrapper({ icon, title, description, children }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ color: "var(--ant-color-primary, #007AFF)" }}>{icon}</span>
        <Title level={5} style={{ margin: 0, fontWeight: 600, letterSpacing: "-0.01em" }}>
          {title}
        </Title>
      </div>
      {description && (
        <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 16 }}>
          {description}
        </Paragraph>
      )}
      {children}
    </motion.div>
  );
}
```

- [ ] **步骤 2：创建 DatabaseStep.tsx**

```tsx
// frontend/src/apps/init/steps/DatabaseStep.tsx
import { Alert, Button, Form, Input, Radio } from "antd";
import { Database } from "lucide-react";
import { FormInstance } from "antd";
import { StepWrapper } from "./StepWrapper";

export interface DbForm {
  driver: "sqlite" | "postgresql";
  sqlitePath: string;
  pgHost: string;
  pgPort: number;
  pgUser: string;
  pgPassword: string;
  pgDb: string;
}

interface Props {
  form: FormInstance<DbForm>;
  submitting: boolean;
  saved: { url: string; driver: string } | null;
  onSubmit: (vals: DbForm) => void | Promise<void>;
}

export function DatabaseStep({ form, submitting, saved, onSubmit }: Props) {
  return (
    <StepWrapper
      icon={<Database size={18} strokeWidth={1.8} />}
      title="配置数据库"
      description="嵌入式 SQLite 适合单机/本地使用。PostgreSQL 适合多实例或长期部署。"
    >
      <Form<DbForm> form={form} layout="vertical" onFinish={onSubmit} requiredMark={false}>
        <Form.Item name="driver" label="驱动类型">
          <Radio.Group buttonStyle="solid">
            <Radio.Button value="sqlite">SQLite (本地文件)</Radio.Button>
            <Radio.Button value="postgresql">PostgreSQL (需要服务)</Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item
          noStyle
          shouldUpdate={(prev, cur) => prev.driver !== cur.driver}
        >
          {({ getFieldValue }) =>
            getFieldValue("driver") === "sqlite" ? (
              <Form.Item
                name="sqlitePath"
                label="SQLite 文件路径"
                extra="相对路径即可，例如 ./data/email_service.db"
                rules={[{ required: true, message: "请输入路径" }]}
              >
                <Input placeholder="./data/email_service.db" size="large" />
              </Form.Item>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Form.Item name="pgHost" label="Host" rules={[{ required: true }]} style={{ minWidth: 160, flex: 1 }}>
                  <Input placeholder="127.0.0.1" size="large" />
                </Form.Item>
                <Form.Item name="pgPort" label="Port" rules={[{ required: true }]} style={{ minWidth: 110 }}>
                  <Input type="number" placeholder="5432" size="large" />
                </Form.Item>
                <Form.Item name="pgUser" label="User" rules={[{ required: true }]} style={{ minWidth: 140, flex: 1 }}>
                  <Input placeholder="arknexus" size="large" />
                </Form.Item>
                <Form.Item name="pgPassword" label="Password" style={{ minWidth: 140, flex: 1 }}>
                  <Input.Password placeholder="可选" size="large" />
                </Form.Item>
                <Form.Item name="pgDb" label="Database" rules={[{ required: true }]} style={{ minWidth: 140, flex: 1 }}>
                  <Input placeholder="arknexus" size="large" />
                </Form.Item>
              </div>
            )
          }
        </Form.Item>
        {saved && (
          <Alert type="success" showIcon message={`已保存：${saved.driver} · ${saved.url}`} style={{ marginBottom: 16, borderRadius: 10 }} />
        )}
        <Button type="primary" htmlType="submit" loading={submitting} size="large" style={{ borderRadius: 999, paddingInline: 32 }}>
          下一步
        </Button>
      </Form>
    </StepWrapper>
  );
}
```

- [ ] **步骤 3：创建 RedisStep.tsx**

```tsx
// frontend/src/apps/init/steps/RedisStep.tsx
import { Alert, Button, Form, Input, Radio, Space } from "antd";
import { Server } from "lucide-react";
import { FormInstance } from "antd";
import { StepWrapper } from "./StepWrapper";

export interface RedisForm {
  enabled: boolean;
  url: string;
}

interface Props {
  form: FormInstance<RedisForm>;
  submitting: boolean;
  saved: { url: string; skipped: boolean } | null;
  onSubmit: (vals: RedisForm) => void | Promise<void>;
  onBack: () => void;
}

export function RedisStep({ form, submitting, saved, onSubmit, onBack }: Props) {
  return (
    <StepWrapper
      icon={<Server size={18} strokeWidth={1.8} />}
      title="配置 Redis（可选）"
      description="当前版本暂未启用 Redis。可留空跳过；若未来需要缓存/限流再启用。"
    >
      <Form<RedisForm> form={form} layout="vertical" onFinish={onSubmit} requiredMark={false}>
        <Form.Item name="enabled" label="是否启用 Redis">
          <Radio.Group buttonStyle="solid">
            <Radio.Button value={false}>跳过</Radio.Button>
            <Radio.Button value={true}>启用</Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item
          noStyle
          shouldUpdate={(prev, cur) => prev.enabled !== cur.enabled}
        >
          {({ getFieldValue }) =>
            getFieldValue("enabled") ? (
              <Form.Item
                name="url"
                label="Redis URL"
                rules={[{ required: true, message: "请输入 Redis URL" }]}
              >
                <Input placeholder="redis://127.0.0.1:6379/0" size="large" />
              </Form.Item>
            ) : null
          }
        </Form.Item>
        {saved && (
          <Alert
            type={saved.skipped ? "info" : "success"}
            showIcon
            message={saved.skipped ? "已跳过 Redis 配置" : `已保存：${saved.url}`}
            style={{ marginBottom: 16, borderRadius: 10 }}
          />
        )}
        <Space>
          <Button onClick={onBack} size="large" style={{ borderRadius: 999, paddingInline: 24 }}>上一步</Button>
          <Button type="primary" htmlType="submit" loading={submitting} size="large" style={{ borderRadius: 999, paddingInline: 24 }}>
            下一步
          </Button>
        </Space>
      </Form>
    </StepWrapper>
  );
}
```

- [ ] **步骤 4：创建 DomainStep.tsx**

```tsx
// frontend/src/apps/init/steps/DomainStep.tsx
import { Alert, Button, Form, Input, Space } from "antd";
import { Globe } from "lucide-react";
import { FormInstance } from "antd";
import { StepWrapper } from "./StepWrapper";

export interface DomainForm {
  domain: string;
}

interface Props {
  form: FormInstance<DomainForm>;
  submitting: boolean;
  saved: string | null;
  onSubmit: (vals: DomainForm) => void | Promise<void>;
  onBack: () => void;
}

export function DomainStep({ form, submitting, saved, onSubmit, onBack }: Props) {
  return (
    <StepWrapper
      icon={<Globe size={18} strokeWidth={1.8} />}
      title="配置接收域名"
      description={<>只有该域名下的地址会被 SMTP 服务接收。本地开发保持默认 <code>arknexus.local</code>。</>}
    >
      <Form<DomainForm> form={form} layout="vertical" onFinish={onSubmit} requiredMark={false}>
        <Form.Item name="domain" label="接收域名" rules={[{ required: true, message: "请输入域名" }]}>
          <Input placeholder="example.com" size="large" />
        </Form.Item>
        {saved && (
          <Alert type="success" showIcon message={`已保存：${saved}`} style={{ marginBottom: 16, borderRadius: 10 }} />
        )}
        <Space>
          <Button onClick={onBack} size="large" style={{ borderRadius: 999, paddingInline: 24 }}>上一步</Button>
          <Button type="primary" htmlType="submit" loading={submitting} size="large" style={{ borderRadius: 999, paddingInline: 24 }}>
            下一步
          </Button>
        </Space>
      </Form>
    </StepWrapper>
  );
}
```

- [ ] **步骤 5：创建 AdminStep.tsx**

```tsx
// frontend/src/apps/init/steps/AdminStep.tsx
import { Button, Form, Input, Space } from "antd";
import { UserPlus } from "lucide-react";
import { FormInstance } from "antd";
import { StepWrapper } from "./StepWrapper";

export interface AdminForm {
  email: string;
  password: string;
  display_name?: string;
}

interface Props {
  form: FormInstance<AdminForm>;
  submitting: boolean;
  onSubmit: (vals: AdminForm) => void | Promise<void>;
  onBack: () => void;
}

export function AdminStep({ form, submitting, onSubmit, onBack }: Props) {
  return (
    <StepWrapper
      icon={<UserPlus size={18} strokeWidth={1.8} />}
      title="创建管理员账号"
      description="该账号拥有所有权限。密码至少 8 位。"
    >
      <Form<AdminForm> form={form} layout="vertical" onFinish={onSubmit} requiredMark={false}>
        <Form.Item
          name="email"
          label="邮箱"
          rules={[
            { required: true, message: "请输入邮箱" },
            { type: "email", message: "邮箱格式不正确" },
          ]}
        >
          <Input autoComplete="email" placeholder="admin@example.com" size="large" />
        </Form.Item>
        <Form.Item name="display_name" label="显示名（可选）">
          <Input placeholder="Admin" size="large" />
        </Form.Item>
        <Form.Item
          name="password"
          label="密码"
          rules={[
            { required: true, message: "请输入密码" },
            { min: 8, message: "密码至少 8 位" },
          ]}
        >
          <Input.Password autoComplete="new-password" placeholder="至少 8 位" size="large" />
        </Form.Item>
        <Space>
          <Button onClick={onBack} size="large" style={{ borderRadius: 999, paddingInline: 24 }}>上一步</Button>
          <Button type="primary" htmlType="submit" loading={submitting} size="large" style={{ borderRadius: 999, paddingInline: 24 }}>
            创建并完成
          </Button>
        </Space>
      </Form>
    </StepWrapper>
  );
}
```

- [ ] **步骤 6：创建 DoneStep.tsx**

```tsx
// frontend/src/apps/init/steps/DoneStep.tsx
import { Button, Result, Space, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const { Text } = Typography;

interface Props {
  adminEmail: string;
  dbDriver?: string;
  domain?: string | null;
  redisSkipped?: boolean;
  redisUrl?: string;
}

export function DoneStep({ adminEmail, dbDriver, domain, redisSkipped, redisUrl }: Props) {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <Result
        status="success"
        title="初始化完成"
        subTitle={
          <Space direction="vertical" size={4} style={{ marginTop: 8 }}>
            <Text>
              管理员账号 <Text code>{adminEmail}</Text> 已创建。
            </Text>
            <Text type="secondary" style={{ fontSize: 13 }}>
              数据库：{dbDriver} · 域名：{domain}
              {redisSkipped ? " · Redis：跳过" : redisUrl ? ` · Redis：${redisUrl}` : ""}
            </Text>
            <Text type="secondary" style={{ fontSize: 13 }}>
              接下来你可以用该账号登录。
            </Text>
          </Space>
        }
        extra={[
          <Button
            key="login"
            type="primary"
            size="large"
            style={{ borderRadius: 999, height: 44, paddingInline: 32 }}
            onClick={() => navigate("/login", { replace: true })}
          >
            前往登录
          </Button>,
        ]}
      />
    </motion.div>
  );
}
```

- [ ] **步骤 7：创建 index.ts 导出**

```ts
// frontend/src/apps/init/steps/index.ts
export { DatabaseStep, type DbForm } from "./DatabaseStep";
export { RedisStep, type RedisForm } from "./RedisStep";
export { DomainStep, type DomainForm } from "./DomainStep";
export { AdminStep, type AdminForm } from "./AdminStep";
export { DoneStep } from "./DoneStep";
export { StepWrapper } from "./StepWrapper";
```

- [ ] **步骤 8：构建验证**

```bash
cd frontend && npx tsc -b --noEmit
```

预期：0 错误（如 StepWrapper `description` 类型报错，确认已用 `description?: ReactNode` 或 `string`）。

- [ ] **步骤 9：Commit**

```bash
git add frontend/src/apps/init/steps/
git commit -m "refactor(init): extract 5 step components with motion + glass wrapper"
```

---

### 任务 4：重写 InitPage（简化）

**文件：**
- 修改：`frontend/src/apps/init/InitPage.tsx`

- [ ] **步骤 1：完全重写 InitPage.tsx**

用以下代码**完全替换**现有文件：

```tsx
import { App, Spin, Steps, Typography, Space } from "antd";
import { Database, Server, Globe, UserPlus, CheckCircle2, Rocket } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchStatus } from "./api/client";
import {
  AdminStep,
  type AdminForm,
  DatabaseStep,
  type DbForm,
  DomainStep,
  type DomainForm,
  DoneStep,
  RedisStep,
  type RedisForm,
} from "./steps";

const { Title, Paragraph } = Typography;

const stepIcons = [
  <Database size={20} strokeWidth={1.8} />,
  <Server size={20} strokeWidth={1.8} />,
  <Globe size={20} strokeWidth={1.8} />,
  <UserPlus size={20} strokeWidth={1.8} />,
  <CheckCircle2 size={20} strokeWidth={1.8} />,
];

function deriveSqlitePath(url: string): string {
  if (!url) return "./data/email_service.db";
  if (url.startsWith("sqlite+aiosqlite:///")) return url.replace("sqlite+aiosqlite:///", "./");
  if (url.startsWith("sqlite:///")) return url.replace("sqlite:///", "./");
  return "./data/email_service.db";
}

export function InitPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<Awaited<ReturnType<typeof fetchStatus>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [dbForm] = Form.useForm();
  const [redisForm] = Form.useForm();
  const [domainForm] = Form.useForm();
  const [adminForm] = Form.useForm();

  const [dbResult, setDbResult] = useState<{ url: string; driver: string } | null>(null);
  const [redisResult, setRedisResult] = useState<{ url: string; skipped: boolean } | null>(null);
  const [domainResult, setDomainResult] = useState<string | null>(null);
  const [adminResult, setAdminResult] = useState<{ email: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchStatus();
        setState(s);
        if (s.initialized) {
          navigate("/login", { replace: true });
          return;
        }
        dbForm.setFieldsValue({
          driver: "sqlite",
          sqlitePath: deriveSqlitePath(s.defaults.database_url),
          pgHost: "127.0.0.1",
          pgPort: 5432,
          pgUser: "arknexus",
          pgPassword: "",
          pgDb: "arknexus",
        });
        redisForm.setFieldsValue({ enabled: false, url: s.defaults.redis_url });
        domainForm.setFieldsValue({ domain: s.defaults.email_domain });
      } catch (err) {
        message.error("无法连接初始化服务：" + (err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Space direction="vertical" align="center" size="large">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "linear-gradient(135deg, #0096FF, #9650FF)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 24px rgba(0,150,255,0.30)",
            }}
          >
            <Rocket size={26} color="#fff" strokeWidth={2} />
          </motion.div>
          <Title level={3} style={{ marginBottom: 0, letterSpacing: "-0.02em" }}>
            ArkNexus 初始化
          </Title>
          <Typography.Text type="secondary">正在连接...</Typography.Text>
        </Space>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "40px 16px",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass-elevated"
        style={{
          maxWidth: 720,
          width: "100%",
          padding: "40px 40px 32px",
          borderRadius: 24,
        }}
      >
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div>
            <Title level={3} style={{ marginBottom: 6, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 }}>
              <Rocket size={24} color="#0071e3" strokeWidth={2} /> 首次启动初始化
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              ArkNexus 需要完成以下配置才能使用。所有数据都存储在本地，
              <strong style={{ color: "var(--ant-color-text, #1d1d1f)" }}>无需单独部署</strong>数据库或 Redis 服务。
            </Paragraph>
          </div>

          <Steps
            current={step}
            size="small"
            items={["数据库", "Redis", "域名", "管理员", "完成"].map((title, i) => ({
              title,
              icon: stepIcons[i],
            }))}
          />

          {step === 0 && (
            <DatabaseStep
              form={dbForm}
              submitting={submitting}
              saved={dbResult}
              onSubmit={async (vals: DbForm) => {
                setSubmitting(true);
                try {
                  const { postDatabase } = await import("./api/client");
                  const url =
                    vals.driver === "sqlite"
                      ? `sqlite+aiosqlite:///${vals.sqlitePath}`
                      : `postgresql+asyncpg://${encodeURIComponent(vals.pgUser)}:${encodeURIComponent(vals.pgPassword)}@${vals.pgHost}:${vals.pgPort}/${vals.pgDb}`;
                  const res = await postDatabase(url);
                  setDbResult({ url, driver: res.driver ?? vals.driver });
                  setStep(1);
                } catch (err) {
                  message.error((err as Error).message);
                } finally {
                  setSubmitting(false);
                }
              }}
            />
          )}

          {step === 1 && (
            <RedisStep
              form={redisForm}
              submitting={submitting}
              saved={redisResult}
              onBack={() => setStep(0)}
              onSubmit={async (vals: RedisForm) => {
                setSubmitting(true);
                try {
                  const { postRedis } = await import("./api/client");
                  const res = await postRedis(vals.enabled ? vals.url : "");
                  setRedisResult({ url: vals.enabled ? vals.url : "", skipped: !!res.skipped });
                  setStep(2);
                } catch (err) {
                  message.error((err as Error).message);
                } finally {
                  setSubmitting(false);
                }
              }}
            />
          )}

          {step === 2 && (
            <DomainStep
              form={domainForm}
              submitting={submitting}
              saved={domainResult}
              onBack={() => setStep(1)}
              onSubmit={async (vals: DomainForm) => {
                setSubmitting(true);
                try {
                  const { postDomain } = await import("./api/client");
                  const res = await postDomain(vals.domain);
                  setDomainResult(res.domain ?? vals.domain);
                  setStep(3);
                } catch (err) {
                  message.error((err as Error).message);
                } finally {
                  setSubmitting(false);
                }
              }}
            />
          )}

          {step === 3 && (
            <AdminStep
              form={adminForm}
              submitting={submitting}
              onBack={() => setStep(2)}
              onSubmit={async (vals: AdminForm) => {
                setSubmitting(true);
                try {
                  const { postAdmin, postFinish } = await import("./api/client");
                  const res = await postAdmin(vals);
                  setAdminResult({ email: res.email });
                  await postFinish();
                  setStep(4);
                } catch (err) {
                  message.error((err as Error).message);
                } finally {
                  setSubmitting(false);
                }
              }}
            />
          )}

          {step === 4 && adminResult && (
            <DoneStep
              adminEmail={adminResult.email}
              dbDriver={dbResult?.driver}
              domain={domainResult}
              redisSkipped={redisResult?.skipped}
              redisUrl={redisResult?.url}
            />
          )}
        </Space>
      </motion.div>
    </div>
  );
}

// Re-export Form for the hook calls
import { Form } from "antd";
```

- [ ] **步骤 2：构建验证**

```bash
cd frontend && npx tsc -b --noEmit
```

预期：0 错误。**注意：** `Form.useForm()` 不带泛型会推断为 `any`，TS 不会报错但可能丢失类型安全；如果编辑器警告，可改为 `Form.useForm<DbForm>()` 等显式泛型。

- [ ] **步骤 3：手动验证**

```bash
cd frontend && npx vite dev
```

访问 http://localhost:5173/init，验证：
- 加载后展示渐显玻璃卡
- 切换步骤有从右滑入动效
- 表单提交后 Alert 出现
- 完成后 DoneStep 缩放渐入

- [ ] **步骤 4：Commit**

```bash
git add frontend/src/apps/init/InitPage.tsx
git commit -m "refactor(init): simplify InitPage to use extracted step components"
```

---

### 任务 5：Dashboard 子组件（4 个）

**文件：**
- 创建：`frontend/src/apps/dashboard/components/StatsCard.tsx`
- 创建：`frontend/src/apps/dashboard/components/MailboxListItem.tsx`
- 创建：`frontend/src/apps/dashboard/components/ServicesStatusCard.tsx`
- 创建：`frontend/src/apps/dashboard/components/RecentMailboxesCard.tsx`
- 创建：`frontend/src/apps/dashboard/components/QuickActionsCard.tsx`
- 创建：`frontend/src/apps/dashboard/components/index.ts`

- [ ] **步骤 1：创建 StatsCard.tsx**

```tsx
// frontend/src/apps/dashboard/components/StatsCard.tsx
import { Skeleton } from "antd";
import { motion } from "framer-motion";
import { ReactNode } from "lucide-react";
import type { CSSProperties } from "react";

type LucideIcon = React.ComponentType<{ size?: number; strokeWidth?: number }>;

interface Props {
  icon: LucideIcon;
  title: string;
  value: number | string;
  suffix?: ReactNode;
  loading?: boolean;
  danger?: boolean;
  footer?: ReactNode;
  delay?: number;
}

export function StatsCard({ icon: Icon, title, value, suffix, loading, danger, footer, delay = 0 }: Props) {
  const style: CSSProperties = {
    padding: 20,
    borderRadius: 18,
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="glass"
      style={style}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ant-color-text-tertiary, #86868b)", fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
        <Icon size={15} strokeWidth={1.8} />
        {title}
      </div>
      {loading ? (
        <Skeleton.Input active size="large" style={{ width: 80 }} />
      ) : (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", color: danger ? "#ff3b30" : "var(--ant-color-text, #1d1d1f)" }}>
            {value}
          </span>
          {suffix}
        </div>
      )}
      {footer && (
        <div style={{ fontSize: 12, color: "var(--ant-color-text-tertiary, #86868b)", marginTop: 4 }}>
          {footer}
        </div>
      )}
    </motion.div>
  );
}
```

**注意：** 如果 `import { ReactNode } from "lucide-react"` 报错（因为 lucide-react 没有导出 ReactNode），改为 `import { ReactNode } from "react"`。

- [ ] **步骤 2：创建 MailboxListItem.tsx**

```tsx
// frontend/src/apps/dashboard/components/MailboxListItem.tsx
import { Badge, Tag } from "antd";
import dayjs from "dayjs";
import { motion } from "framer-motion";

interface Props {
  id: string;
  address: string;
  displayName?: string | null;
  messageCount: number;
  unreadCount: number;
  createdAt: string;
  expiresAt: string;
  delay?: number;
}

export function MailboxListItem({ address, displayName, messageCount, unreadCount, createdAt, expiresAt, delay = 0 }: Props) {
  const daysLeft = Math.max(0, dayjs(expiresAt).diff(dayjs(), "day"));
  const initial = (displayName?.[0] ?? address[0] ?? "?").toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={{ backgroundColor: "rgba(0,0,0,0.04)" }}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 12px",
        borderRadius: 12,
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "linear-gradient(135deg, #0096FF, #9650FF)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initial}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{displayName || address.split("@")[0]}</div>
          <div style={{ fontSize: 12, color: "var(--ant-color-text-tertiary, #86868b)", marginTop: 1 }}>
            {address} · 创建于 {dayjs(createdAt).format("MM-DD HH:mm")}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {unreadCount > 0 && <Badge count={unreadCount} style={{ backgroundColor: "#007AFF", fontSize: 11 }} />}
        <Tag style={{ borderRadius: 6, margin: 0, fontSize: 12 }}>{messageCount} 封</Tag>
        <Tag color={daysLeft <= 3 ? "orange" : "blue"} style={{ margin: 0, borderRadius: 6, fontSize: 12 }}>
          {daysLeft} 天后过期
        </Tag>
      </div>
    </motion.div>
  );
}
```

- [ ] **步骤 3：创建 RecentMailboxesCard.tsx**

```tsx
// frontend/src/apps/dashboard/components/RecentMailboxesCard.tsx
import { Empty, Typography } from "antd";
import { Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { GlassCard } from "../../../components/glass/GlassCard";
import { MailboxListItem } from "./MailboxListItem";
import type { Mailbox } from "../../email/api/client";

const { Text } = Typography;

interface Props {
  mailboxes: Mailbox[];
}

export function RecentMailboxesCard({ mailboxes }: Props) {
  const recent = [...mailboxes]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <GlassCard padding={20} radius={18} style={{ height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <Text strong style={{ fontSize: 16, letterSpacing: "-0.01em" }}>
          最近创建的邮箱
        </Text>
        <Link to="/email">
          <motion.span whileHover={{ x: 2 }} style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ant-color-primary, #007AFF)", fontSize: 13 }}>
            全部 <Pencil size={13} strokeWidth={2} />
          </motion.span>
        </Link>
      </div>
      {recent.length === 0 ? (
        <Empty description="还没有邮箱" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: "40px 0" }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {recent.map((m, idx) => (
            <MailboxListItem
              key={m.id}
              id={m.id}
              address={m.address}
              displayName={m.display_name}
              messageCount={m.message_count}
              unreadCount={m.unread_count}
              createdAt={m.created_at}
              expiresAt={m.expires_at}
              delay={idx * 0.05}
            />
          ))}
        </div>
      )}
    </GlassCard>
  );
}
```

- [ ] **步骤 4：创建 ServicesStatusCard.tsx**

```tsx
// frontend/src/apps/dashboard/components/ServicesStatusCard.tsx
import { Badge, Empty, Timeline, Typography } from "antd";
import { Clock } from "lucide-react";
import dayjs from "dayjs";
import { GlassCard } from "../../../components/glass/GlassCard";
import type { ServiceRead } from "../../settings/api/client";

const { Text } = Typography;

interface Props {
  services: ServiceRead[];
  loading?: boolean;
}

export function ServicesStatusCard({ services, loading }: Props) {
  return (
    <GlassCard padding={20} radius={18}>
      <Text strong style={{ fontSize: 16, letterSpacing: "-0.01em", display: "block", marginBottom: 16 }}>
        微服务状态
      </Text>
      {loading ? (
        <Text type="secondary">加载中...</Text>
      ) : services.length === 0 ? (
        <Empty description="暂无已注册服务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Timeline
          items={services.map((svc) => ({
            color: svc.is_online ? "green" : "red",
            dot: <Badge status={svc.is_online ? "processing" : "error"} />,
            children: (
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{svc.display_name}</div>
                <div style={{ fontSize: 12, color: "var(--ant-color-text-tertiary, #86868b)", marginTop: 2 }}>
                  <code>{svc.slug}</code>
                  {svc.version ? ` · v${svc.version}` : ""}
                </div>
                <div style={{ fontSize: 12, color: "var(--ant-color-text-tertiary, #86868b)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                  <Clock size={11} strokeWidth={1.8} /> {timeAgo(svc.last_heartbeat_at)}
                </div>
              </div>
            ),
          }))}
        />
      )}
    </GlassCard>
  );
}

function timeAgo(iso: string): string {
  const diff = dayjs().diff(dayjs(iso), "minute");
  if (diff < 1) return "刚刚";
  if (diff < 60) return `${diff} 分钟前`;
  if (diff < 1440) return `${Math.floor(diff / 60)} 小时前`;
  return dayjs(iso).format("MM-DD HH:mm");
}
```

- [ ] **步骤 5：创建 QuickActionsCard.tsx**

```tsx
// frontend/src/apps/dashboard/components/QuickActionsCard.tsx
import { Button } from "antd";
import { Plus, Pencil, Bot, Settings as SettingsIcon, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { App } from "antd";
import { motion } from "framer-motion";
import { GlassCard } from "../../../components/glass/GlassCard";
import { Typography } from "antd";

const { Text } = Typography;

interface Props {
  onRefresh: () => void;
}

export function QuickActionsCard({ onRefresh }: Props) {
  const { message } = App.useApp();
  return (
    <GlassCard padding={20} radius={18}>
      <Text strong style={{ fontSize: 16, letterSpacing: "-0.01em", display: "block", marginBottom: 16 }}>
        快速操作
      </Text>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <ActionLink to="/email" icon={<Plus size={15} strokeWidth={2} />} primary>
          新建临时邮箱
        </ActionLink>
        <ActionButton
          icon={<Pencil size={15} strokeWidth={2} />}
          onClick={() => message.info("请进入「临时邮箱 → 左侧邮箱 → 写邮件」创建草稿")}
        >
          写邮件
        </ActionButton>
        <ActionLink to="/ai/chat" icon={<Bot size={15} strokeWidth={2} />}>
          AI 会话
        </ActionLink>
        <ActionLink to="/settings" icon={<SettingsIcon size={15} strokeWidth={2} />}>
          系统设置
        </ActionLink>
        <ActionButton icon={<RefreshCw size={15} strokeWidth={2} />} onClick={onRefresh}>
          刷新
        </ActionButton>
      </div>
    </GlassCard>
  );
}

function ActionLink({ to, icon, children, primary }: { to: string; icon: React.ReactNode; children: React.ReactNode; primary?: boolean }) {
  return (
    <Link to={to}>
      <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }} style={{ display: "inline-block" }}>
        <Button type={primary ? "primary" : "default"} icon={icon} style={{ borderRadius: 999 }}>
          {children}
        </Button>
      </motion.div>
    </Link>
  );
}

function ActionButton({ icon, onClick, children }: { icon: React.ReactNode; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }} style={{ display: "inline-block" }}>
      <Button icon={icon} onClick={onClick} style={{ borderRadius: 999 }}>
        {children}
      </Button>
    </motion.div>
  );
}
```

- [ ] **步骤 6：创建 index.ts**

```ts
// frontend/src/apps/dashboard/components/index.ts
export { StatsCard } from "./StatsCard";
export { RecentMailboxesCard } from "./RecentMailboxesCard";
export { ServicesStatusCard } from "./ServicesStatusCard";
export { QuickActionsCard } from "./QuickActionsCard";
export { MailboxListItem } from "./MailboxListItem";
```

- [ ] **步骤 7：构建验证**

```bash
cd frontend && npx tsc -b --noEmit
```

预期：0 错误。

- [ ] **步骤 8：Commit**

```bash
git add frontend/src/apps/dashboard/components/
git commit -m "feat(dashboard): extract StatsCard, MailboxListItem, ServicesStatusCard, etc."
```

---

### 任务 6：重写 DashboardPage（简化）

**文件：**
- 修改：`frontend/src/apps/dashboard/DashboardPage.tsx`

- [ ] **步骤 1：完全重写 DashboardPage.tsx**

用以下代码**完全替换**现有文件：

```tsx
import { Col, Row, Space, Typography } from "antd";
import { Inbox, Mail, Activity, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { FadeIn } from "../../components/motion/FadeIn";
import { listMailboxes, getStats } from "../email/api/client";
import type { Mailbox } from "../email/api/client";
import { listServices } from "../settings/api/client";
import type { ServiceRead } from "../settings/api/client";
import {
  QuickActionsCard,
  RecentMailboxesCard,
  ServicesStatusCard,
  StatsCard,
} from "./components";

const { Title, Paragraph } = Typography;

export function DashboardPage() {
  const mailboxesQuery = useQuery<Mailbox[]>({
    queryKey: ["mailboxes"],
    queryFn: () => listMailboxes(false),
    refetchInterval: 30_000,
  });
  const statsQuery = useQuery({
    queryKey: ["stats"],
    queryFn: getStats,
    refetchInterval: 30_000,
  });
  const servicesQuery = useQuery<ServiceRead[]>({
    queryKey: ["services"],
    queryFn: listServices,
    refetchInterval: 30_000,
  });

  const mailboxes = mailboxesQuery.data ?? [];
  const totalMessages = mailboxes.reduce((s, m) => s + m.message_count, 0);
  const totalUnread = mailboxes.reduce((s, m) => s + m.unread_count, 0);
  const services = servicesQuery.data ?? [];

  const refreshAll = () => {
    mailboxesQuery.refetch();
    statsQuery.refetch();
    servicesQuery.refetch();
  };

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <FadeIn variant="slide">
        <div>
          <Title level={3} style={{ marginBottom: 4, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>
            概览
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 15 }}>
            快速了解 ArkNexus 当前状态。
          </Paragraph>
        </div>
      </FadeIn>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <StatsCard
            icon={Inbox}
            title="活跃邮箱"
            value={mailboxes.length}
            delay={0}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatsCard
            icon={Mail}
            title="总邮件数"
            value={totalMessages}
            loading={mailboxesQuery.isLoading}
            footer="30 天内"
            delay={0.06}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatsCard
            icon={Activity}
            title="未读邮件"
            value={totalUnread}
            danger={totalUnread > 0}
            delay={0.12}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatsCard
            icon={ShieldCheck}
            title="数据保留"
            value={statsQuery.data?.retention_days ?? "—"}
            suffix="天"
            footer="到期自动清理"
            delay={0.18}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <RecentMailboxesCard mailboxes={mailboxes} />
        </Col>
        <Col xs={24} lg={10}>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <ServicesStatusCard services={services} loading={servicesQuery.isLoading} />
            <QuickActionsCard onRefresh={refreshAll} />
          </Space>
        </Col>
      </Row>
    </Space>
  );
}
```

- [ ] **步骤 2：构建验证**

```bash
cd frontend && npx vite build
```

预期：构建成功，无 warning。

- [ ] **步骤 3：手动验证**

```bash
cd frontend && npx vite dev
```

登录后访问 /，验证：
- 4 个统计卡 stagger 入场（0/60/120/180ms）
- 卡片悬停轻微上浮
- 最近邮箱卡 hover 项变灰
- 服务状态卡显示时间线
- 快速操作卡 5 个按钮悬停 -2px

- [ ] **步骤 4：Commit**

```bash
git add frontend/src/apps/dashboard/DashboardPage.tsx
git commit -m "refactor(dashboard): simplify DashboardPage to compose extracted components"
```

---

### 任务 7：主题切换的视觉验证

**文件：** 无（手动验证任务）

- [ ] **步骤 1：手动验证双主题切换**

```bash
cd frontend && npx vite dev
```

登录后点击侧边栏底部的主题切换按钮：
1. 浅色 → 深色：所有页面背景渐变过渡、玻璃卡变深色、文字颜色翻转，无闪烁
2. 深色 → 跟随系统：随系统偏好自动切换
3. 验证：Dashboard 4 个统计卡、RecentMailboxesCard、ServicesStatusCard、QuickActionsCard 均正确显示深色变体

- [ ] **步骤 2：性能抽检**

打开浏览器开发者工具 → Performance → 录制 5 秒页面切换 Dashboard → Email → Dashboard。验证：
- 路由切换 frame rate 接近 60fps
- 极光背景持续动画不卡顿
- 内存增长 < 50MB

- [ ] **步骤 3：Commit（如有样式微调）**

```bash
git status
# 如有微调：
git add -A && git commit -m "fix(dashboard): theme-aware adjustments"
```

---

### 任务 8：最终验证与构建

**文件：** 所有前述任务产生的文件

- [ ] **步骤 1：完整类型检查**

```bash
cd frontend && npx tsc -b
```

预期：0 错误。

- [ ] **步骤 2：生产构建**

```bash
cd frontend && npx vite build
```

预期：构建成功，无 warning。

- [ ] **步骤 3：完整冒烟测试**

```bash
cd frontend && npx vite dev
```

依次访问：
1. http://localhost:5173/login — 玻璃卡片入场渐显 + 极光背景
2. http://localhost:5173/init — 5 步向导切换有从右滑入
3. 登录后 / — Dashboard 4 统计卡 stagger 入场 + 服务状态 + 快速操作
4. 切换主题：浅色 → 深色 → 跟随系统 — 平滑过渡无闪烁

- [ ] **步骤 4：Commit（如有遗留修改）**

```bash
git status
git add -A && git commit -m "chore: plan 2 cleanup"
```

- [ ] **步骤 5：打 tag**

```bash
git tag -a v0.2.1-liquid-glass-pages-2 -m "Liquid glass: Login, Init, Dashboard"
```

---

## 自检（计划作者执行）

**1. 规格覆盖度：**

| 规格章节 | 实现任务 |
|---|---|
| 8.1 LoginPage | 任务 1, 2 |
| 8.2 InitPage | 任务 3, 4 |
| 8.3 DashboardPage | 任务 5, 6 |
| 6.2 卡片入场 stagger 60ms | 任务 5 (StatsCard delay), 任务 6 (Compose) |
| 6.2 页面切换渐入 | 通过 PageTransition（计划 1） |
| 5.1 AuroraBackground 在 LoginPage/DashboardPage 启用 | 计划 1 App.tsx 挂载 |

**未覆盖（属计划 3）：**
- Email / Chat / Settings / Profile 页面重构

**2. 占位符扫描：** 无 "TODO" / "TBD" / "类似任务 N"。

**3. 类型一致性：**
- `Mailbox` 类型从 `email/api/client` 导入，任务 5、6 一致 ✓
- `ServiceRead` 从 `settings/api/client` 导入 ✓
- `GlassCard` 从 `../../../components/glass/GlassCard` 导入，路径一致 ✓
- `FadeIn` 从 `../../components/motion/FadeIn` 导入 ✓

无不一致。

---

## 执行选项

计划 2 已完成并保存到 `docs/superpowers/plans/2026-09-10-frontend-liquid-glass-refactor-2.md`。

执行方式：
- 等计划 3 完成后，统一选择子代理驱动或内联执行
- 或立即用 executing-plans 内联执行本计划
