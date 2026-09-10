import { App, Steps, Typography, Space } from "antd";
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
