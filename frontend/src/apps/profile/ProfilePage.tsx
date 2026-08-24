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
import { UserOutlined } from "@ant-design/icons";
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
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          个人资料
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          管理账号信息与安全设置。
        </Paragraph>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Card title="账号" style={{ flex: 1, minWidth: 360 }}>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Space size="middle">
              <Avatar
                size={64}
                icon={<UserOutlined />}
                style={{ backgroundColor: "#1677ff" }}
              />
              <Space direction="vertical" size={0}>
                <Text strong style={{ fontSize: 18 }}>
                  {meQuery.data?.display_name || meQuery.data?.email || "..."}
                </Text>
                <Text type="secondary">{meQuery.data?.email}</Text>
                {meQuery.data?.is_admin && <Tag color="gold">管理员</Tag>}
              </Space>
            </Space>

            <Descriptions
              column={1}
              size="small"
              bordered
              items={[
                { key: "id", label: "用户 ID", children: meQuery.data?.id ?? "—" },
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
          </Space>
        </Card>

        <Card title="修改昵称" style={{ flex: 1, minWidth: 360 }}>
          <Form
            layout="vertical"
            initialValues={{ display_name: meQuery.data?.display_name ?? "" }}
            onFinish={(vals) => profileMutation.mutate(vals.display_name ?? null)}
          >
            <Form.Item
              name="display_name"
              label="显示名"
              extra="留空则使用邮箱前缀"
            >
              <Input maxLength={120} placeholder="昵称" />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={profileMutation.isPending}
            >
              保存
            </Button>
          </Form>
        </Card>
      </div>

      <Card title="修改密码">
        <Form
          layout="vertical"
          style={{ maxWidth: 480 }}
          onFinish={(vals) =>
            passwordMutation.mutate({
              current: vals.current_password,
              next: vals.new_password,
            })
          }
        >
          <Form.Item
            name="current_password"
            label="当前密码"
            rules={[{ required: true, message: "请输入当前密码" }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[
              { required: true, message: "请输入新密码" },
              { min: 8, message: "密码至少 8 位" },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="确认新密码"
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
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={passwordMutation.isPending}
          >
            修改密码
          </Button>
        </Form>
      </Card>
    </Space>
  );
}