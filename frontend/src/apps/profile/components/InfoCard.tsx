// frontend/src/apps/profile/components/InfoCard.tsx
import { Button, Descriptions, Form, Input, Space, Typography } from "antd";
import { Save } from "lucide-react";
import { motion } from "framer-motion";
import { ReactNode, useState } from "react";

const { Title } = Typography;

interface Props {
  title: string;
  description?: string;
  extra?: ReactNode;
  children: ReactNode;
}

export function InfoCard({ title, description, extra, children }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass"
      style={{ padding: 24, borderRadius: 18 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <Title level={5} style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
            {title}
          </Title>
          {description && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {description}
            </Typography.Text>
          )}
        </div>
        {extra}
      </div>
      {children}
    </motion.div>
  );
}

export function ProfileInfoForm({
  displayName,
  email,
  onSave,
  loading,
}: {
  displayName: string;
  email: string;
  onSave: (displayName: string) => Promise<void>;
  loading?: boolean;
}) {
  const [form] = Form.useForm();
  const [dirty, setDirty] = useState(false);
  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ display_name: displayName }}
      onValuesChange={() => setDirty(true)}
    >
      <Descriptions column={1} size="small" styles={{ label: { width: 100, color: "var(--ant-color-text-tertiary, #86868b)" } }}>
        <Descriptions.Item label="邮箱">{email}</Descriptions.Item>
      </Descriptions>
      <Form.Item
        name="display_name"
        label="显示名"
        style={{ marginTop: 12, marginBottom: 0 }}
      >
        <Input placeholder="昵称" maxLength={32} size="large" />
      </Form.Item>
      <Space style={{ marginTop: 16 }}>
        <Button
          type="primary"
          icon={<Save size={14} />}
          loading={loading}
          disabled={!dirty}
          onClick={async () => {
            const v = await form.validateFields();
            await onSave(v.display_name);
            setDirty(false);
          }}
          style={{ borderRadius: 999 }}
        >
          保存
        </Button>
      </Space>
    </Form>
  );
}
