import { App, Button, Card, Divider, Form, Input, Space, Tabs, Typography } from "antd";
import { GithubOutlined, GoogleOutlined } from "@ant-design/icons";
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

const OAUTH_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  github: { icon: <GithubOutlined />, label: "GitHub", color: "#24292f" },
  google: { icon: <GoogleOutlined />, label: "Google", color: "#4285f4" },
};

export function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [submitting, setSubmitting] = useState(false);

  const providersQuery = useQuery({
    queryKey: ["oauth-providers"],
    queryFn: listOAuthProviders,
    staleTime: 5 * 60 * 1000,
  });

  const onFinish = async (values: FormValues) => {
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
      message.error((err as Error).message);
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
        background: "#f0f2f5",
        padding: 16,
      }}
    >
      <Card style={{ width: 420 }}>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div>
            <Title level={3} style={{ marginBottom: 4 }}>
              ArkNexus
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {mode === "login"
                ? "登录以管理你的临时邮箱"
                : "创建账号开始使用"}
            </Paragraph>
          </div>

          {configured.length > 0 && (
            <>
              <Space direction="vertical" size="small" style={{ width: "100%" }}>
                {configured.map((name) => {
                  const meta = OAUTH_META[name] ?? { icon: null, label: name, color: "#888" };
                  return (
                    <Button
                      key={name}
                      block
                      icon={meta.icon as any}
                      style={{ background: meta.color, color: "#fff", borderColor: meta.color }}
                      onClick={() => startOAuthLogin(name, "/")}
                    >
                      使用 {meta.label} 登录
                    </Button>
                  );
                })}
              </Space>
              <Divider plain style={{ margin: 0, color: "#999" }}>
                或
              </Divider>
            </>
          )}

          <Tabs
            activeKey={mode}
            onChange={(k) => setMode(k as "login" | "register")}
            items={[
              { key: "login", label: "登录" },
              { key: "register", label: "注册" },
            ]}
          />

          <Form<FormValues>
            layout="vertical"
            onFinish={onFinish}
            initialValues={{ email: "", password: "" }}
          >
            <Form.Item
              name="email"
              label="邮箱"
              rules={[
                { required: true, message: "请输入邮箱" },
                { type: "email", message: "邮箱格式不正确" },
              ]}
            >
              <Input autoComplete="email" placeholder="you@example.com" />
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
              />
            </Form.Item>

            {mode === "register" && (
              <Form.Item name="display_name" label="昵称（可选）">
                <Input placeholder="昵称" />
              </Form.Item>
            )}

            <Button
              block
              type="primary"
              htmlType="submit"
              loading={submitting}
            >
              {mode === "login" ? "登录" : "注册"}
            </Button>
          </Form>

          <Paragraph type="secondary" style={{ textAlign: "center", margin: 0, fontSize: 12 }}>
            匿名也能用，但登录后才能管理"自己的"临时邮箱。
          </Paragraph>
        </Space>
      </Card>
    </div>
  );
}
