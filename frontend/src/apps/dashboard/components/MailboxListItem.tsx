// frontend/src/apps/dashboard/components/MailboxListItem.tsx
import { Badge, Tag } from "antd";
import dayjs from "dayjs";
import { motion } from "framer-motion";

interface Props {
  id: string;
  address: string;
  displayName?: string | null;
  messageCount: number;
  unreadCount: number;
  createdAt: string;
  expiresAt: string;
  delay?: number;
}

export function MailboxListItem({ address, displayName, messageCount, unreadCount, createdAt, expiresAt, delay = 0 }: Props) {
  const daysLeft = Math.max(0, dayjs(expiresAt).diff(dayjs(), "day"));
  const initial = (displayName?.[0] ?? address[0] ?? "?").toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={{ backgroundColor: "rgba(0,0,0,0.04)" }}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 12px",
        borderRadius: 12,
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "linear-gradient(135deg, #0096FF, #9650FF)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initial}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{displayName || address.split("@")[0]}</div>
          <div style={{ fontSize: 12, color: "var(--ant-color-text-tertiary, #86868b)", marginTop: 1 }}>
            {address} · 创建于 {dayjs(createdAt).format("MM-DD HH:mm")}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {unreadCount > 0 && <Badge count={unreadCount} style={{ backgroundColor: "#007AFF", fontSize: 11 }} />}
        <Tag style={{ borderRadius: 6, margin: 0, fontSize: 12 }}>{messageCount} 封</Tag>
        <Tag color={daysLeft <= 3 ? "orange" : "blue"} style={{ margin: 0, borderRadius: 6, fontSize: 12 }}>
          {daysLeft} 天后过期
        </Tag>
      </div>
    </motion.div>
  );
}