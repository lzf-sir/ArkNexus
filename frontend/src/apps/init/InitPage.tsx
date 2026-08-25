import {
  Alert,
  App,
  Button,
  Form,
  Input,
  Radio,
  Result,
  Space,
  Steps,
  Typography,
} from "antd";
import { Database, Server, Globe, UserPlus, CheckCircle2, Rocket } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  InitState,
  fetchStatus,
  postAdmin,
  postDatabase,
  postDomain,
  postFinish,
  postRedis,
} from "./api/client";

const { Title, Paragraph, Text } = Typography;

interface DbForm {
  driver: "sqlite" | "postgresql";
  sqlitePath: string;
  pgHost: string;
  pgPort: number;
  pgUser: string;
  pgPassword: string;
  pgDb: string;
}

interface RedisForm {
  enabled: boolean;
  url: string;
}

interface DomainForm {
  domain: string;
}

interface AdminForm {
  email: string;
  password: string;
  display_name?: string;
}

const stepIcons = [
  <Database size={20} strokeWidth={1.8} />,
  <Server size={20} strokeWidth={1.8} />,
  <Globe size={20} strokeWidth={1.8} />,
  <UserPlus size={20} strokeWidth={1.8} />,
  <CheckCircle2 size={20} strokeWidth={1.8} />,
];

export function InitPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<InitState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [dbForm] = Form.useForm<DbForm>();
  const [redisForm] = Form.useForm<RedisForm>();
  const [domainForm] = Form.useForm<DomainForm>();
  const [adminForm] = Form.useForm<AdminForm>();

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
          background: "linear-gradient(135deg, #f5f5f7 0%, #e8e8ed 50%, #f0f2f5 100%)",
        }}
      >
        <Space direction="vertical" align="center" size="large">
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "linear-gradient(135deg, #0071e3 0%, #42a1ec 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 16px rgba(0,113,227,0.30)",
            }}
          >
            <Rocket size={26} color="#fff" strokeWidth={2} />
          </div>
          <Title level={3} style={{ marginBottom: 0, letterSpacing: "-0.02em" }}>
            ArkNexus 初始化
          </Title>
          <Text style={{ color: "#86868b" }}>正在连接...</Text>
        </Space>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f5f5f7 0%, #e8e8ed 50%, #f0f2f5 100%)",
        padding: "40px 16px",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
      }}
    >
      <div
        className="apple-fade-in"
        style={{
          maxWidth: 720,
          width: "100%",
          background: "rgba(255,255,255,0.80)",
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
          borderRadius: 24,
          boxShadow: "0 14px 40px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.04)",
          border: "1px solid rgba(255,255,255,0.6)",
          padding: "40px 40px 32px",
        }}
      >
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div>
            <Title
              level={3}
              style={{
                marginBottom: 6,
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Rocket size={24} color="#0071e3" strokeWidth={2} /> 首次启动初始化
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 0, color: "#86868b" }}>
              ArkNexus 需要完成以下配置才能使用。所有数据都存储在本地，
              <strong style={{ color: "#1d1d1f" }}>无需单独部署</strong>
              数据库或 Redis 服务。
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
              onSubmit={async (vals) => {
                setSubmitting(true);
                try {
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
              submitting={submitting}
              saved={dbResult}
            />
          )}

          {step === 1 && (
            <RedisStep
              form={redisForm}
              onSubmit={async (vals) => {
                setSubmitting(true);
                try {
                  const res = await postRedis(vals.enabled ? vals.url : "");
                  setRedisResult({ url: vals.enabled ? vals.url : "", skipped: !!res.skipped });
                  setStep(2);
                } catch (err) {
                  message.error((err as Error).message);
                } finally {
                  setSubmitting(false);
                }
              }}
              submitting={submitting}
              onBack={() => setStep(0)}
              saved={redisResult}
            />
          )}

          {step === 2 && (
            <DomainStep
              form={domainForm}
              onSubmit={async (vals) => {
                setSubmitting(true);
                try {
                  const res = await postDomain(vals.domain);
                  setDomainResult(res.domain ?? vals.domain);
                  setStep(3);
                } catch (err) {
                  message.error((err as Error).message);
                } finally {
                  setSubmitting(false);
                }
              }}
              submitting={submitting}
              onBack={() => setStep(1)}
              saved={domainResult}
            />
          )}

          {step === 3 && (
            <AdminStep
              form={adminForm}
              onSubmit={async (vals) => {
                setSubmitting(true);
                try {
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
              submitting={submitting}
              onBack={() => setStep(2)}
            />
          )}

          {step === 4 && (
            <Result
              status="success"
              title="初始化完成"
              subTitle={
                <Space direction="vertical" size={4} style={{ marginTop: 8 }}>
                  <Text>
                    管理员账号 <Text code>{adminResult?.email}</Text> 已创建。
                  </Text>
                  <Text type="secondary" style={{ fontSize: 13, color: "#86868b" }}>
                    数据库：{dbResult?.driver} · 域名：{domainResult}
                    {redisResult?.skipped
                      ? " · Redis：跳过"
                      : redisResult?.url
                      ? ` · Redis：${redisResult.url}`
                      : ""}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 13, color: "#86868b" }}>
                    接下来你可以用该账号登录。
                  </Text>
                </Space>
              }
              extra={[
                <Button
                  type="primary"
                  key="login"
                  size="large"
                  style={{ borderRadius: 980, height: 44, paddingInline: 32 }}
                  onClick={() => navigate("/login", { replace: true })}
                >
                  前往登录
                </Button>,
              ]}
            />
          )}
        </Space>
      </div>
    </div>
  );
}

function deriveSqlitePath(url: string): string {
  if (!url) return "./data/email_service.db";
  if (url.startsWith("sqlite+aiosqlite:///")) {
    return url.replace("sqlite+aiosqlite:///", "./");
  }
  if (url.startsWith("sqlite:///")) return url.replace("sqlite:///", "./");
  return "./data/email_service.db";
}

function StepWrapper({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="apple-fade-in">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ color: "#0071e3" }}>{icon}</span>
        <Title level={5} style={{ margin: 0, fontWeight: 600, letterSpacing: "-0.01em" }}>
          {title}
        </Title>
      </div>
      {children}
    </div>
  );
}

function DatabaseStep({
  form,
  onSubmit,
  submitting,
  saved,
}: {
  form: ReturnType<typeof Form.useForm<DbForm>>[0];
  onSubmit: (vals: DbForm) => void | Promise<void>;
  submitting: boolean;
  saved: { url: string; driver: string } | null;
}) {
  return (
    <StepWrapper icon={<Database size={18} strokeWidth={1.8} />} title="配置数据库">
      <Paragraph type="secondary" style={{ color: "#86868b", fontSize: 13 }}>
        嵌入式 SQLite 适合单机/本地使用。PostgreSQL 适合多实例或长期部署。
      </Paragraph>
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
                extra={<span style={{ fontSize: 12, color: "#86868b" }}>相对路径即可，例如 ./data/email_service.db</span>}
                rules={[{ required: true, message: "请输入路径" }]}
              >
                <Input placeholder="./data/email_service.db" style={{ height: 40 }} />
              </Form.Item>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Form.Item name="pgHost" label="Host" rules={[{ required: true }]} style={{ minWidth: 160, flex: 1 }}>
                  <Input placeholder="127.0.0.1" style={{ height: 40 }} />
                </Form.Item>
                <Form.Item name="pgPort" label="Port" rules={[{ required: true }]} style={{ minWidth: 110 }}>
                  <Input type="number" placeholder="5432" style={{ height: 40 }} />
                </Form.Item>
                <Form.Item name="pgUser" label="User" rules={[{ required: true }]} style={{ minWidth: 140, flex: 1 }}>
                  <Input placeholder="arknexus" style={{ height: 40 }} />
                </Form.Item>
                <Form.Item name="pgPassword" label="Password" style={{ minWidth: 140, flex: 1 }}>
                  <Input.Password placeholder="可选" style={{ height: 40 }} />
                </Form.Item>
                <Form.Item name="pgDb" label="Database" rules={[{ required: true }]} style={{ minWidth: 140, flex: 1 }}>
                  <Input placeholder="arknexus" style={{ height: 40 }} />
                </Form.Item>
              </div>
            )
          }
        </Form.Item>
        {saved && (
          <Alert
            type="success"
            showIcon
            message={`已保存：${saved.driver} · ${saved.url}`}
            style={{ marginBottom: 16, borderRadius: 10 }}
          />
        )}
        <Button type="primary" htmlType="submit" loading={submitting} style={{ height: 40, borderRadius: 980, paddingInline: 24 }}>
          下一步
        </Button>
      </Form>
    </StepWrapper>
  );
}

function RedisStep({
  form,
  onSubmit,
  submitting,
  onBack,
  saved,
}: {
  form: ReturnType<typeof Form.useForm<RedisForm>>[0];
  onSubmit: (vals: RedisForm) => void | Promise<void>;
  submitting: boolean;
  onBack: () => void;
  saved: { url: string; skipped: boolean } | null;
}) {
  return (
    <StepWrapper icon={<Server size={18} strokeWidth={1.8} />} title="配置 Redis（可选）">
      <Paragraph type="secondary" style={{ color: "#86868b", fontSize: 13 }}>
        当前版本暂未启用 Redis。可留空跳过；若未来需要缓存/限流再启用。
      </Paragraph>
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
                <Input placeholder="redis://127.0.0.1:6379/0" style={{ height: 40 }} />
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
          <Button onClick={onBack} style={{ height: 40, borderRadius: 980, paddingInline: 24 }}>上一步</Button>
          <Button type="primary" htmlType="submit" loading={submitting} style={{ height: 40, borderRadius: 980, paddingInline: 24 }}>
            下一步
          </Button>
        </Space>
      </Form>
    </StepWrapper>
  );
}

function DomainStep({
  form,
  onSubmit,
  submitting,
  onBack,
  saved,
}: {
  form: ReturnType<typeof Form.useForm<DomainForm>>[0];
  onSubmit: (vals: DomainForm) => void | Promise<void>;
  submitting: boolean;
  onBack: () => void;
  saved: string | null;
}) {
  return (
    <StepWrapper icon={<Globe size={18} strokeWidth={1.8} />} title="配置接收域名">
      <Paragraph type="secondary" style={{ color: "#86868b", fontSize: 13 }}>
        只有该域名下的地址会被 SMTP 服务接收。本地开发保持默认 <code>arknexus.local</code>。
      </Paragraph>
      <Form<DomainForm> form={form} layout="vertical" onFinish={onSubmit} requiredMark={false}>
        <Form.Item
          name="domain"
          label="接收域名"
          rules={[{ required: true, message: "请输入域名" }]}
        >
          <Input placeholder="example.com" style={{ height: 40 }} />
        </Form.Item>
        {saved && (
          <Alert type="success" showIcon message={`已保存：${saved}`} style={{ marginBottom: 16, borderRadius: 10 }} />
        )}
        <Space>
          <Button onClick={onBack} style={{ height: 40, borderRadius: 980, paddingInline: 24 }}>上一步</Button>
          <Button type="primary" htmlType="submit" loading={submitting} style={{ height: 40, borderRadius: 980, paddingInline: 24 }}>
            下一步
          </Button>
        </Space>
      </Form>
    </StepWrapper>
  );
}

function AdminStep({
  form,
  onSubmit,
  submitting,
  onBack,
}: {
  form: ReturnType<typeof Form.useForm<AdminForm>>[0];
  onSubmit: (vals: AdminForm) => void | Promise<void>;
  submitting: boolean;
  onBack: () => void;
}) {
  return (
    <StepWrapper icon={<UserPlus size={18} strokeWidth={1.8} />} title="创建管理员账号">
      <Paragraph type="secondary" style={{ color: "#86868b", fontSize: 13 }}>
        该账号拥有所有权限。密码至少 8 位。
      </Paragraph>
      <Form<AdminForm> form={form} layout="vertical" onFinish={onSubmit} requiredMark={false}>
        <Form.Item
          name="email"
          label="邮箱"
          rules={[
            { required: true, message: "请输入邮箱" },
            { type: "email", message: "邮箱格式不正确" },
          ]}
        >
          <Input autoComplete="email" placeholder="admin@example.com" style={{ height: 40 }} />
        </Form.Item>
        <Form.Item name="display_name" label="显示名（可选）">
          <Input placeholder="Admin" style={{ height: 40 }} />
        </Form.Item>
        <Form.Item
          name="password"
          label="密码"
          rules={[
            { required: true, message: "请输入密码" },
            { min: 8, message: "密码至少 8 位" },
          ]}
        >
          <Input.Password autoComplete="new-password" placeholder="至少 8 位" style={{ height: 40 }} />
        </Form.Item>
        <Space>
          <Button onClick={onBack} style={{ height: 40, borderRadius: 980, paddingInline: 24 }}>上一步</Button>
          <Button type="primary" htmlType="submit" loading={submitting} style={{ height: 40, borderRadius: 980, paddingInline: 24 }}>
            创建并完成
          </Button>
        </Space>
      </Form>
    </StepWrapper>
  );
}
