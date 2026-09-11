// frontend/src/apps/dashboard/components/StatsCard.tsx
import { Skeleton } from "antd";
import { motion } from "framer-motion";
import { ReactNode } from "react";
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  value: number | string;
  suffix?: ReactNode;
  loading?: boolean;
  danger?: boolean;
  footer?: ReactNode;
  delay?: number;
}

export function StatsCard({ icon: Icon, title, value, suffix, loading, danger, footer, delay = 0 }: Props) {
  const style: CSSProperties = {
    padding: 20,
    borderRadius: 18,
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="glass"
      style={style}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ant-color-text-tertiary, #86868b)", fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
        <Icon size={15} strokeWidth={1.8} />
        {title}
      </div>
      {loading ? (
        <Skeleton.Input active size="large" style={{ width: 80 }} />
      ) : (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", color: danger ? "#ff3b30" : "var(--ant-color-text, #1d1d1f)" }}>
            {value}
          </span>
          {suffix}
        </div>
      )}
      {footer && (
        <div style={{ fontSize: 12, color: "var(--ant-color-text-tertiary, #86868b)", marginTop: 4 }}>
          {footer}
        </div>
      )}
    </motion.div>
  );
}