import { ReactNode } from "react";
import { motion } from "framer-motion";
import { Typography } from "antd";

const { Title, Paragraph } = Typography;

interface Props {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}

export function StepWrapper({ icon, title, description, children }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ color: "var(--ant-color-primary, #007AFF)" }}>{icon}</span>
        <Title level={5} style={{ margin: 0, fontWeight: 600, letterSpacing: "-0.01em" }}>
          {title}
        </Title>
      </div>
      {description && (
        <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 16 }}>
          {description}
        </Paragraph>
      )}
      {children}
    </motion.div>
  );
}
