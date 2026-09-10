import { Alert, Button, Form, Input, Space } from "antd";
import { Globe } from "lucide-react";
import { FormInstance } from "antd";
import { StepWrapper } from "./StepWrapper";

export interface DomainForm {
  domain: string;
}

interface Props {
  form: FormInstance<DomainForm>;
  submitting: boolean;
  saved: string | null;
  onSubmit: (vals: DomainForm) => void | Promise<void>;
  onBack: () => void;
}

export function DomainStep({ form, submitting, saved, onSubmit, onBack }: Props) {
  return (
    <StepWrapper
      icon={<Globe size={18} strokeWidth={1.8} />}
      title="配置接收域名"
      description={<>只有该域名下的地址会被 SMTP 服务接收。本地开发保持默认 <code>arknexus.local</code>。</>}
    >
      <Form<DomainForm> form={form} layout="vertical" onFinish={onSubmit} requiredMark={false}>
        <Form.Item name="domain" label="接收域名" rules={[{ required: true, message: "请输入域名" }]}>
          <Input placeholder="example.com" size="large" />
        </Form.Item>
        {saved && (
          <Alert type="success" showIcon message={`已保存：${saved}`} style={{ marginBottom: 16, borderRadius: 10 }} />
        )}
        <Space>
          <Button onClick={onBack} size="large" style={{ borderRadius: 999, paddingInline: 24 }}>上一步</Button>
          <Button type="primary" htmlType="submit" loading={submitting} size="large" style={{ borderRadius: 999, paddingInline: 24 }}>
            下一步
          </Button>
        </Space>
      </Form>
    </StepWrapper>
  );
}
