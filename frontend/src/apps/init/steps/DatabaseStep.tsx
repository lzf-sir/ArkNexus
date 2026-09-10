import { Alert, Button, Form, Input, Radio } from "antd";
import { Database } from "lucide-react";
import { FormInstance } from "antd";
import { StepWrapper } from "./StepWrapper";

export interface DbForm {
  driver: "sqlite" | "postgresql";
  sqlitePath: string;
  pgHost: string;
  pgPort: number;
  pgUser: string;
  pgPassword: string;
  pgDb: string;
}

interface Props {
  form: FormInstance<DbForm>;
  submitting: boolean;
  saved: { url: string; driver: string } | null;
  onSubmit: (vals: DbForm) => void | Promise<void>;
}

export function DatabaseStep({ form, submitting, saved, onSubmit }: Props) {
  return (
    <StepWrapper
      icon={<Database size={18} strokeWidth={1.8} />}
      title="配置数据库"
      description="嵌入式 SQLite 适合单机/本地使用。PostgreSQL 适合多实例或长期部署。"
    >
      <Form<DbForm> form={form} layout="vertical" onFinish={onSubmit} requiredMark={false}>
        <Form.Item name="driver" label="驱动类型">
          <Radio.Group buttonStyle="solid">
            <Radio.Button value="sqlite">SQLite (本地文件)</Radio.Button>
            <Radio.Button value="postgresql">PostgreSQL (需要服务)</Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item
          noStyle
          shouldUpdate={(prev, cur) => prev.driver !== cur.driver}
        >
          {({ getFieldValue }) =>
            getFieldValue("driver") === "sqlite" ? (
              <Form.Item
                name="sqlitePath"
                label="SQLite 文件路径"
                extra="相对路径即可，例如 ./data/email_service.db"
                rules={[{ required: true, message: "请输入路径" }]}
              >
                <Input placeholder="./data/email_service.db" size="large" />
              </Form.Item>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Form.Item name="pgHost" label="Host" rules={[{ required: true }]} style={{ minWidth: 160, flex: 1 }}>
                  <Input placeholder="127.0.0.1" size="large" />
                </Form.Item>
                <Form.Item name="pgPort" label="Port" rules={[{ required: true }]} style={{ minWidth: 110 }}>
                  <Input type="number" placeholder="5432" size="large" />
                </Form.Item>
                <Form.Item name="pgUser" label="User" rules={[{ required: true }]} style={{ minWidth: 140, flex: 1 }}>
                  <Input placeholder="arknexus" size="large" />
                </Form.Item>
                <Form.Item name="pgPassword" label="Password" style={{ minWidth: 140, flex: 1 }}>
                  <Input.Password placeholder="可选" size="large" />
                </Form.Item>
                <Form.Item name="pgDb" label="Database" rules={[{ required: true }]} style={{ minWidth: 140, flex: 1 }}>
                  <Input placeholder="arknexus" size="large" />
                </Form.Item>
              </div>
            )
          }
        </Form.Item>
        {saved && (
          <Alert type="success" showIcon message={`已保存：${saved.driver} · ${saved.url}`} style={{ marginBottom: 16, borderRadius: 10 }} />
        )}
        <Button type="primary" htmlType="submit" loading={submitting} size="large" style={{ borderRadius: 999, paddingInline: 32 }}>
          下一步
        </Button>
      </Form>
    </StepWrapper>
  );
}
