// frontend/src/apps/profile/components/SecurityCard.tsx
import { Button, Form, Input, Popconfirm, Space, Typography } from "antd";
import { KeyRound, LogOut } from "lucide-react";
import { InfoCard } from "./InfoCard";

const { Text } = Typography;

interface Props {
  onChangePassword: (oldPwd: string, newPwd: string) => Promise<void>;
  onLogoutAll: () => void;
}

export function SecurityCard({ onChangePassword, onLogoutAll }: Props) {
  const [form] = Form.useForm();
  return (
    <InfoCard title="安全" description="修改密码或登出所有设备">
      <Form
        form={form}
        layout="vertical"
        onFinish={async (v) => {
          await onChangePassword(v.old_password, v.new_password);
          form.resetFields();
        }}
      >
        <Form.Item name="old_password" label="当前密码" rules={[{ required: true, message: "请输入当前密码" }]}>
          <Input.Password autoComplete="current-password" size="large" />
        </Form.Item>
        <Form.Item
          name="new_password"
          label="新密码"
          rules={[
            { required: true, message: "请输入新密码" },
            { min: 8, message: "密码至少 8 位" },
          ]}
        >
          <Input.Password autoComplete="new-password" size="large" />
        </Form.Item>
        <Form.Item
          name="confirm"
          label="确认新密码"
          dependencies={["new_password"]}
          rules={[
            { required: true, message: "请确认新密码" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("new_password") === value) return Promise.resolve();
                return Promise.reject(new Error("两次输入不一致"));
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" size="large" />
        </Form.Item>
        <Space>
          <Button type="primary" icon={<KeyRound size={14} />} htmlType="submit" style={{ borderRadius: 999 }}>
            修改密码
          </Button>
          <Popconfirm
            title="登出所有设备？"
            description="你将需要在其他设备上重新登录。"
            okText="确认登出"
            cancelText="取消"
            onConfirm={onLogoutAll}
          >
            <Button danger icon={<LogOut size={14} />} style={{ borderRadius: 999 }}>
              登出所有设备
            </Button>
          </Popconfirm>
        </Space>
      </Form>
    </InfoCard>
  );
}
