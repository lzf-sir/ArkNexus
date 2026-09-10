// frontend/src/apps/dashboard/components/QuickActionsCard.tsx
import { Button, App, Typography } from "antd";
import { Plus, Pencil, Bot, Settings as SettingsIcon, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { GlassCard } from "../../../components/glass/GlassCard";

const { Text } = Typography;

interface Props {
  onRefresh: () => void;
}

export function QuickActionsCard({ onRefresh }: Props) {
  const { message } = App.useApp();
  return (
    <GlassCard padding={20} radius={18}>
      <Text strong style={{ fontSize: 16, letterSpacing: "-0.01em", display: "block", marginBottom: 16 }}>
        快速操作
      </Text>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <ActionLink to="/email" icon={<Plus size={15} strokeWidth={2} />} primary>
          新建临时邮箱
        </ActionLink>
        <ActionButton
          icon={<Pencil size={15} strokeWidth={2} />}
          onClick={() => message.info("请进入「临时邮箱 → 左侧邮箱 → 写邮件」创建草稿")}
        >
          写邮件
        </ActionButton>
        <ActionLink to="/ai/chat" icon={<Bot size={15} strokeWidth={2} />}>
          AI 会话
        </ActionLink>
        <ActionLink to="/settings" icon={<SettingsIcon size={15} strokeWidth={2} />}>
          系统设置
        </ActionLink>
        <ActionButton icon={<RefreshCw size={15} strokeWidth={2} />} onClick={onRefresh}>
          刷新
        </ActionButton>
      </div>
    </GlassCard>
  );
}

function ActionLink({ to, icon, children, primary }: { to: string; icon: React.ReactNode; children: React.ReactNode; primary?: boolean }) {
  return (
    <Link to={to}>
      <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }} style={{ display: "inline-block" }}>
        <Button type={primary ? "primary" : "default"} icon={icon} style={{ borderRadius: 999 }}>
          {children}
        </Button>
      </motion.div>
    </Link>
  );
}

function ActionButton({ icon, onClick, children }: { icon: React.ReactNode; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }} style={{ display: "inline-block" }}>
      <Button icon={icon} onClick={onClick} style={{ borderRadius: 999 }}>
        {children}
      </Button>
    </motion.div>
  );
}