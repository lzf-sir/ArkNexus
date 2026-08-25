import {
  App,
  Avatar,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Space,
  Tag,
  Typography,
} from "antd";
import { User, Shield, KeyRound } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { fetchMe, login } from "@/lib/api";
import { useAuth } from "../auth/AuthContext";

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
    </Space>
  );
}
