// frontend/src/apps/ai/components/MessageBubble.tsx
import { motion } from "framer-motion";
import { Bot, User } from "lucide-react";

interface Props {
  role: "user" | "assistant" | "system";
  content: string;
  streaming?: boolean;
}

export function MessageBubble({ role, content, streaming }: Props) {
  if (role === "system") {
    return (
      <div style={{ textAlign: "center", padding: "8px 0", fontSize: 12, color: "var(--ant-color-text-tertiary, #86868b)" }}>
        {content}
      </div>
    );
  }
  const isUser = role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        display: "flex",
        gap: 10,
        flexDirection: isUser ? "row-reverse" : "row",
        alignItems: "flex-start",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: isUser
            ? "linear-gradient(135deg, #007AFF, #5856D6)"
            : "linear-gradient(135deg, #34C759, #30D158)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {isUser ? <User size={16} color="#fff" strokeWidth={2} /> : <Bot size={16} color="#fff" strokeWidth={2} />}
      </div>
      <div
        className={isUser ? "glass-tinted" : "glass"}
        style={{
          padding: "10px 14px",
          borderRadius: 16,
          maxWidth: "70%",
          fontSize: 14,
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {content}
        {streaming && <TypingDots />}
      </div>
    </motion.div>
  );
}

function TypingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 3, marginLeft: 4 }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
          style={{ display: "inline-block", width: 4, height: 4, borderRadius: "50%", background: "currentColor" }}
        />
      ))}
    </span>
  );
}
