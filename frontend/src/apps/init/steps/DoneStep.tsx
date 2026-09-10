import { Button, Result, Space, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const { Text } = Typography;

interface Props {
  adminEmail: string;
  dbDriver?: string;
  domain?: string | null;
  redisSkipped?: boolean;
  redisUrl?: string;
}

export function DoneStep({ adminEmail, dbDriver, domain, redisSkipped, redisUrl }: Props) {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <Result
        status="success"
        title="初始化完成"
        subTitle={
          <Space direction="vertical" size={4} style={{ marginTop: 8 }}>
            <Text>
              管理员账号 <Text code>{adminEmail}</Text> 已创建。
            </Text>
            <Text type="secondary" style={{ fontSize: 13 }}>
              数据库：{dbDriver} · 域名：{domain}
              {redisSkipped ? " · Redis：跳过" : redisUrl ? ` · Redis：${redisUrl}` : ""}
            </Text>
            <Text type="secondary" style={{ fontSize: 13 }}>
              接下来你可以用该账号登录。
            </Text>
          </Space>
        }
        extra={[
          <Button
            key="login"
            type="primary"
            size="large"
            style={{ borderRadius: 999, height: 44, paddingInline: 32 }}
            onClick={() => navigate("/login", { replace: true })}
          >
            前往登录
          </Button>,
        ]}
      />
    </motion.div>
  );
}
