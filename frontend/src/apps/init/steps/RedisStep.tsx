import { Alert, Button, Form, Input, Radio, Space } from "antd";
import { Server } from "lucide-react";
import { FormInstance } from "antd";
import { StepWrapper } from "./StepWrapper";

export interface RedisForm {
  enabled: boolean;
  url: string;
}

interface Props {
  form: FormInstance<RedisForm>;
  submitting: boolean;
  saved: { url: string; skipped: boolean } | null;
  onSubmit: (vals: RedisForm) => void | Promise<void>;
  onBack: () => void;
}

export function RedisStep({ form, submitting, saved, onSubmit, onBack }: Props) {
  return (
    <StepWrapper
      icon={<Server size={18} strokeWidth={1.8} />}
      title="配置 Redis（可选）"
      description="当前版本暂未启用 Redis。可留空跳过；若未来需要缓存/限流再启用。"
    >
      <Form<RedisForm> form={form} layout="vertical" onFinish={onSubmit} requiredMark={false}>
        <Form.Item name="enabled" label="是否启用 Redis">
          <Radio.Group buttonStyle="solid">
            <Radio.Button value={false}>跳过</Radio.Button>
            <Radio.Button value={true}>启用</Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item
          noStyle
          shouldUpdate={(prev, cur) => prev.enabled !== cur.enabled}
        >
          {({ getFieldValue }) =>
            getFieldValue("enabled") ? (
              <Form.Item
                name="url"
                label="Redis URL"
                rules={[{ required: true, message: "请输入 Redis URL" }]}
              >
                <Input placeholder="redis://127.0.0.1:6379/0" size="large" />
              </Form.Item>
            ) : null
          }
        </Form.Item>
        {saved && (
          <Alert
            type={saved.skipped ? "info" : "success"}
            showIcon
            message={saved.skipped ? "已跳过 Redis 配置" : `已保存：${saved.url}`}
            style={{ marginBottom: 16, borderRadius: 10 }}
          />
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
