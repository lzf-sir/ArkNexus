// frontend/src/apps/dashboard/components/RecentMailboxesCard.tsx
import { Empty, Typography } from "antd";
import { Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { GlassCard } from "../../../components/glass/GlassCard";
import { MailboxListItem } from "./MailboxListItem";
import type { Mailbox } from "../../email/api/client";

const { Text } = Typography;

interface Props {
  mailboxes: Mailbox[];
}

export function RecentMailboxesCard({ mailboxes }: Props) {
  const recent = [...mailboxes]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <GlassCard padding={20} radius={18} style={{ height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <Text strong style={{ fontSize: 16, letterSpacing: "-0.01em" }}>
          最近创建的邮箱
        </Text>
        <Link to="/email">
          <motion.span whileHover={{ x: 2 }} style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ant-color-primary, #007AFF)", fontSize: 13 }}>
            全部 <Pencil size={13} strokeWidth={2} />
          </motion.span>
        </Link>
      </div>
      {recent.length === 0 ? (
        <Empty description="还没有邮箱" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: "40px 0" }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {recent.map((m, idx) => (
            <MailboxListItem
              key={m.id}
              id={m.id}
              address={m.address}
              displayName={m.display_name}
              messageCount={m.message_count}
              unreadCount={m.unread_count}
              createdAt={m.created_at}
              expiresAt={m.expires_at}
              delay={idx * 0.05}
            />
          ))}
        </div>
      )}
    </GlassCard>
  );
}