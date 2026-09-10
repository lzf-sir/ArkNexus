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
