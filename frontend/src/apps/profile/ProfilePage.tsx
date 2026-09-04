import {
  App,
  Avatar,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Popconfirm,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { User, Shield, KeyRound, Link2, Unlink, Mail } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  fetchMe,
  listOAuthAccounts,
  unlinkOAuthAccount,
  type OAuthAccountInfo,
} from "@/lib/api";
import { useAuth } from "../auth/AuthContext";
import { startOAuthLogin } from "../auth/api/oauth";

const { Title, Paragraph, Text } = Typography;

export function ProfilePage() {
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const { message: toast } = App.useApp();

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const profileMutation = useMutation({
    mutationFn: async (displayName: string | null) => {
      const r = await fetch("/api/v1/auth/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("arknexus.auth.token")}`,
        },
        body: JSON.stringify({ display_name: displayName }),
      });
      if (!r.ok) throw new Error((await r.json()).detail || "保存失败");
      return r.json();
    },
    onSuccess: () => {
      toast.success("已更新个人资料");
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const passwordMutation = useMutation({
    mutationFn: async (vars: { current: string; next: string }) => {
      const r = await fetch("/api/v1/auth/me/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("arknexus.auth.token")}`,
        },
        body: JSON.stringify({
          current_password: vars.current,
          new_password: vars.next,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).detail || "修改失败");
      return r.json();
    },
    onSuccess: () => {
      toast.success("密码已修改，请重新登录");
      setTimeout(() => logout(), 800);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const oauthAccountsQuery = useQuery({
    queryKey: ["oauth-accounts"],
    queryFn: listOAuthAccounts,
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const unlinkMutation = useMutation({
    mutationFn: (id: string) => unlinkOAuthAccount(id),
    onSuccess: () => {
      toast.success("已解绑");
      queryClient.invalidateQueries({ queryKey: ["oauth-accounts"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const PROVIDER_META: Record<
    string,
    { icon: React.ReactNode; label: string; color: string }
  > = {
    github: { icon: <GithubIcon size={14} />, label: "GitHub", color: "#24292f" },
    google: { icon: <Mail size={14} strokeWidth={1.8} />, label: "Google", color: "#4285f4" },
  };

  const linkedProviders = new Set(
    (oauthAccountsQuery.data ?? []).map((a) => a.provider)
  );
  const availableToLink = Object.keys(PROVIDER_META).filter(
    (p) => !linkedProviders.has(p)
  );

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }} className="apple-fade-in">
      {/* Page header */}
      <div>
        <Title level={3} style={{ marginBottom: 4, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>
          个人资料
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0, color: "#86868b", fontSize: 15 }}>
          管理账号信息与安全设置。
        </Paragraph>
      </div>

      {/* Account cards */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* Account info card */}
        <Card className="apple-card" style={{ flex: 1, minWidth: 360, borderRadius: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 24 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                background: "linear-gradient(135deg, #0071e3 0%, #42a1ec 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 16px rgba(0,113,227,0.20)",
                flexShrink: 0,
              }}
            >
              <User size={28} color="#fff" strokeWidth={2} />
            </div>
            <div>
              <Text style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", display: "block", marginBottom: 2 }}>
                {meQuery.data?.display_name || meQuery.data?.email || "..."}
              </Text>
              <Text style={{ color: "#86868b", fontSize: 14 }}>
                {meQuery.data?.email}
              </Text>
              {meQuery.data?.is_admin && (
                <div style={{ marginTop: 6 }}>
                  <Tag color="gold" style={{ borderRadius: 980, padding: "2px 10px" }}>管理员</Tag>
                </div>
              )}
            </div>
          </div>

          <Descriptions
            column={1}
            size="small"
            bordered
            style={{ background: "#f5f5f7", borderRadius: 12 }}
            items={[
              { key: "id", label: "用户 ID", children: <code>{meQuery.data?.id ?? "—"}</code> },
              {
                key: "created",
                label: "注册时间",
                children: meQuery.data?.created_at
                  ? dayjs(meQuery.data.created_at).format("YYYY-MM-DD HH:mm")
                  : "—",
              },
              {
                key: "last",
                label: "上次登录",
                children: meQuery.data?.last_login_at
                  ? dayjs(meQuery.data.last_login_at).format("YYYY-MM-DD HH:mm")
                  : "—",
              },
            ]}
          />
        </Card>

        {/* Edit display name card */}
        <Card
          className="apple-card"
          style={{ flex: 1, minWidth: 360, borderRadius: 16 }}
          title={
            <span style={{ fontWeight: 600, fontSize: 16, letterSpacing: "-0.01em" }}>修改昵称</span>
          }
        >
          <Form
            layout="vertical"
            initialValues={{ display_name: meQuery.data?.display_name ?? "" }}
            onFinish={(vals) => profileMutation.mutate(vals.display_name ?? null)}
            requiredMark={false}
          >
            <Form.Item
              name="display_name"
              label={<span style={{ fontWeight: 500, color: "#1d1d1f" }}>显示名</span>}
              extra={<span style={{ fontSize: 12, color: "#86868b" }}>留空则使用邮箱前缀</span>}
            >
              <Input maxLength={120} placeholder="昵称" style={{ height: 40 }} />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={profileMutation.isPending}
              style={{ borderRadius: 980, height: 40, paddingInline: 24 }}
            >
              保存
            </Button>
          </Form>
        </Card>
      </div>

      {/* Password change card */}
      <Card
        className="apple-card"
        style={{ borderRadius: 16 }}
        title={
          <span style={{ fontWeight: 600, fontSize: 16, letterSpacing: "-0.01em" }}>修改密码</span>
        }
      >
        <Form
          layout="vertical"
          style={{ maxWidth: 480 }}
          onFinish={(vals) =>
            passwordMutation.mutate({
              current: vals.current_password,
              next: vals.new_password,
            })
          }
          requiredMark={false}
        >
          <Form.Item
            name="current_password"
            label={<span style={{ fontWeight: 500, color: "#1d1d1f" }}>当前密码</span>}
            rules={[{ required: true, message: "请输入当前密码" }]}
          >
            <Input.Password autoComplete="current-password" style={{ height: 40 }} />
          </Form.Item>
          <Form.Item
            name="new_password"
            label={<span style={{ fontWeight: 500, color: "#1d1d1f" }}>新密码</span>}
            rules={[
              { required: true, message: "请输入新密码" },
              { min: 8, message: "密码至少 8 位" },
            ]}
          >
            <Input.Password autoComplete="new-password" style={{ height: 40 }} />
          </Form.Item>
          <Form.Item
            name="confirm"
            label={<span style={{ fontWeight: 500, color: "#1d1d1f" }}>确认新密码</span>}
            dependencies={["new_password"]}
            rules={[
              { required: true, message: "请再次输入新密码" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("new_password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("两次输入不一致"));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" style={{ height: 40 }} />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={passwordMutation.isPending}
            style={{ borderRadius: 980, height: 40, paddingInline: 24 }}
          >
            修改密码
          </Button>
        </Form>
      </Card>

      {/* OAuth account linkage */}
      <Card
        className="apple-card"
        style={{ borderRadius: 16 }}
        title={
          <Space align="center">
            <Link2 size={16} strokeWidth={1.8} style={{ color: "#0071e3" }} />
            <span style={{ fontWeight: 600, fontSize: 16, letterSpacing: "-0.01em" }}>
              第三方账号
            </span>
          </Space>
        }
      >
        <p style={{ color: "#86868b", fontSize: 14, marginTop: 0, marginBottom: 16 }}>
          链接第三方账号后可一键登录。解绑后下次仍可用对应账号重新链接。
        </p>

        {oauthAccountsQuery.data && oauthAccountsQuery.data.length > 0 && (
          <Space direction="vertical" size={10} style={{ width: "100%", marginBottom: 16 }}>
            {oauthAccountsQuery.data.map((a: OAuthAccountInfo) => {
              const meta = PROVIDER_META[a.provider] ?? {
                icon: <Link2 size={14} strokeWidth={1.8} />,
                label: a.provider,
                color: "#86868b",
              };
              return (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.06)",
                    background: "#fff",
                  }}
                >
                  <Space size={12}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        background: meta.color,
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {meta.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "#1d1d1f" }}>
                        {meta.label}
                      </div>
                      <div style={{ fontSize: 12, color: "#86868b", marginTop: 2 }}>
                        {a.provider_email || a.provider_display_name || a.provider_user_id}
                        {a.last_used_at && (
                          <> · 上次使用 {dayjs(a.last_used_at).format("YYYY-MM-DD")}</>
                        )}
                      </div>
                    </div>
                  </Space>
                  <Popconfirm
                    title="解绑该第三方账号？"
                    description="解绑后将无法使用该账号直接登录。"
                    okText="解绑"
                    cancelText="取消"
                    onConfirm={() => unlinkMutation.mutate(a.id)}
                  >
                    <Tooltip title="解绑">
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<Unlink size={14} strokeWidth={1.8} />}
                        loading={unlinkMutation.isPending && unlinkMutation.variables === a.id}
                        style={{ display: "flex", alignItems: "center", gap: 4 }}
                      >
                        解绑
                      </Button>
                    </Tooltip>
                  </Popconfirm>
                </div>
              );
            })}
          </Space>
        )}

        {oauthAccountsQuery.data && oauthAccountsQuery.data.length === 0 && (
          <Empty description="尚未链接任何第三方账号" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}

        {availableToLink.length > 0 && (
          <Space wrap size={8}>
            <span style={{ fontSize: 13, color: "#86868b" }}>链接：</span>
            {availableToLink.map((p) => {
              const meta = PROVIDER_META[p];
              return (
                <Button
                  key={p}
                  size="small"
                  icon={meta.icon}
                  onClick={() => startOAuthLogin(p, "/profile")}
                  style={{
                    borderRadius: 8,
                    borderColor: meta.color,
                    color: meta.color,
                  }}
                >
                  {meta.label}
                </Button>
              );
            })}
          </Space>
        )}
      </Card>
    </Space>
  );
}

function GithubIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
