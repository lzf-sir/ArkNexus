// frontend/src/apps/profile/components/ProfileHeader.tsx
import { Tag, Typography } from "antd";
import { motion } from "framer-motion";
import { Shield } from "lucide-react";

const { Text } = Typography;

interface Props {
  displayName: string;
  email: string;
  role: string;
  isAdmin?: boolean;
}

export function ProfileHeader({ displayName, email, role, isAdmin }: Props) {
  const initial = (displayName || email)[0]?.toUpperCase() ?? "?";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-elevated"
      style={{
        padding: 32,
        borderRadius: 24,
        display: "flex",
        alignItems: "center",
        gap: 24,
      }}
    >
      <motion.div
        whileHover={{ scale: 1.05, rotate: 4 }}
        transition={{ duration: 0.3 }}
        style={{
          width: 88,
          height: 88,
          borderRadius: 24,
          background: "linear-gradient(135deg, #0096FF, #9650FF)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 36,
          fontWeight: 700,
          flexShrink: 0,
          boxShadow: "0 12px 32px rgba(0,150,255,0.30)",
        }}
      >
        {initial}
      </motion.div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Text style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>
            {displayName || email}
          </Text>
          {isAdmin && (
            <Tag icon={<Shield size={11} />} color="blue" style={{ borderRadius: 999, fontSize: 11 }}>
              管理员
            </Tag>
          )}
          <Tag style={{ borderRadius: 999, fontSize: 11 }}>{role || "user"}</Tag>
        </div>
        <Text type="secondary">{email}</Text>
      </div>
    </motion.div>
  );
}
