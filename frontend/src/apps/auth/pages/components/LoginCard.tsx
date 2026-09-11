import { App, Divider, Form, Input, Space, Tabs, Typography } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../../AuthContext";
import { OAuthButtonRow } from "./OAuthButtonRow";
import { GlassButton } from "@/components/glass/GlassButton";

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
            <GlassButton
              block
              variant="primary"
              type="submit"
              loading={submitting}
              style={{ height: 48, fontSize: 16 }}
            >
              {mode === "login" ? "登录" : "注册"}
            </GlassButton>
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
