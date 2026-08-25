import { App, Button, Divider, Form, Input, Space, Tabs, Typography } from "antd";
import { ExternalLink, Mail } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { listOAuthProviders, startOAuthLogin } from "../api/oauth";

const { Title, Paragraph } = Typography;

interface FormValues {
  email: string;
  password: string;
  display_name?: string;
}

const OAUTH_META: Record<
  string,
  { icon: React.ReactNode; label: string; color: string }
> = {
  github: { icon: <GithubIcon size={18} />, label: "GitHub", color: "#24292f" },
  google: { icon: <Mail size={18} strokeWidth={1.8} />, label: "Google", color: "#4285f4" },
};

export function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const providersQuery = useQuery({
    queryKey: ["oauth-providers"],
    queryFn: listOAuthProviders,
    staleTime: 5 * 60 * 1000,
  });

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

  const configured = providersQuery.data?.configured ?? [];

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #f5f5f7 0%, #e8e8ed 50%, #f0f2f5 100%)",
        padding: 16,
        position: "relative",
      }}
    >
      {/* Decorative gradient orbs */}
      <div
        style={{
          position: "absolute",
          top: "-120px",
          right: "-120px",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(0,113,227,0.10) 0%, transparent 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-120px",
          left: "-120px",
          width: 350,
          height: 350,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(52,199,89,0.08) 0%, transparent 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />

      {/* Login card with frosted glass effect */}
      <div
        className="apple-scale-in"
        style={{
          width: 420,
          maxWidth: "100%",
          background: "rgba(255,255,255,0.80)",
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
          borderRadius: 24,
          boxShadow:
            "0 14px 40px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.04)",
          border: "1px solid rgba(255,255,255,0.6)",
          padding: "40px 36px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          {/* Brand */}
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 56,
                height: 56,
                margin: "0 auto 16px",
                borderRadius: 14,
                background: "linear-gradient(135deg, #0071e3 0%, #42a1ec 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 16px rgba(0,113,227,0.30)",
              }}
            >
              <Link2 />
            </div>
            <Title
              level={3}
              style={{
                marginBottom: 4,
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              ArkNexus
            </Title>
            <Paragraph
              type="secondary"
              style={{ marginBottom: 0, fontSize: 14, color: "#86868b" }}
            >
              {mode === "login"
                ? "登录以管理你的临时邮箱"
                : "创建账号开始使用"}
            </Paragraph>
          </div>

          {/* OAuth buttons */}
          {configured.length > 0 && (
            <>
              <Space direction="vertical" size="small" style={{ width: "100%" }}>
                {configured.map((name) => {
                  const meta = OAUTH_META[name] ?? {
                    icon: null,
                    label: name,
                    color: "#86868b",
                  };
                  return (
                    <Button
                      key={name}
                      block
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
                      onClick={() => startOAuthLogin(name, "/")}
                    >
                      {meta.icon}
                      使用 {meta.label} 登录
                    </Button>
                  );
                })}
              </Space>
              <Divider plain style={{ margin: 0, color: "#86868b", fontSize: 13 }}>
                或
              </Divider>
            </>
          )}

          {/* Login / Register tabs */}
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

          {/* Form */}
          <Form<FormValues>
            layout="vertical"
            onFinish={onFinish}
            initialValues={{ email: "", password: "" }}
            requiredMark={false}
          >
            <Form.Item
              name="email"
              label={<span style={{ fontWeight: 500, color: "#1d1d1f" }}>邮箱</span>}
              rules={[
                { required: true, message: "请输入邮箱" },
                { type: "email", message: "邮箱格式不正确" },
              ]}
            >
              <Input
                autoComplete="email"
                placeholder="you@example.com"
                style={{ height: 44, borderRadius: 10, fontSize: 15 }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<span style={{ fontWeight: 500, color: "#1d1d1f" }}>密码</span>}
              rules={[
                { required: true, message: "请输入密码" },
                { min: 8, message: "密码至少 8 位" },
              ]}
            >
              <Input.Password
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder={mode === "login" ? "" : "至少 8 位"}
                style={{ height: 44, borderRadius: 10, fontSize: 15 }}
              />
            </Form.Item>

            {mode === "register" && (
              <Form.Item
                name="display_name"
                label={<span style={{ fontWeight: 500, color: "#1d1d1f" }}>昵称（可选）</span>}
              >
                <Input placeholder="昵称" style={{ height: 44, borderRadius: 10 }} />
              </Form.Item>
            )}

            {errorMsg && (
              <div
                role="alert"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 14px",
                  marginBottom: 4,
                  borderRadius: 10,
                  background: "rgba(255, 59, 48, 0.08)",
                  border: "1px solid rgba(255, 59, 48, 0.25)",
                  color: "#d70015",
                  fontSize: 13,
                  fontWeight: 500,
                  animation: "apple-fade-in 0.3s cubic-bezier(0.25, 0.1, 0.25, 1) both",
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
              </div>
            )}

            <Button
              block
              type="primary"
              htmlType="submit"
              loading={submitting}
              style={{ height: 48, borderRadius: 980, fontSize: 16, fontWeight: 600, marginTop: errorMsg ? 12 : 4 }}
            >
              {mode === "login" ? "登录" : "注册"}
            </Button>
          </Form>

          <Paragraph
            type="secondary"
            style={{ textAlign: "center", margin: 0, fontSize: 12, color: "#86868b" }}
          >
            匿名也能用，但登录后才能管理"自己的"临时邮箱。
          </Paragraph>
        </Space>
      </div>
    </div>
  );
}

function Link2() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
      <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function GithubIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
