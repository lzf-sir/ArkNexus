// frontend/src/apps/ai/components/ChatPanel.tsx
import { Empty } from "antd";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";

export interface ChatItem {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

interface Props {
  messages: ChatItem[];
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onStop?: () => void;
  disabled?: boolean;
  streaming?: boolean;
  emptyHint?: string;
}

export function ChatPanel({ messages, input, onInputChange, onSend, onStop, disabled, streaming, emptyHint }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="glass" style={{ flex: 1, padding: 16, borderRadius: 16, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
        {messages.length === 0 ? (
          <Empty description={emptyHint || "开始一段新的对话"} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 60 }} />
        ) : (
          <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}>
            {messages.map((m) => (
              <MessageBubble key={m.id} role={m.role} content={m.content} streaming={streaming && m === messages[messages.length - 1] && m.role === "assistant"} />
            ))}
          </motion.div>
        )}
      </div>
      <div style={{ marginTop: 12 }}>
        <ChatInput
          value={input}
          onChange={onInputChange}
          onSend={onSend}
          onStop={onStop}
          disabled={disabled}
          streaming={streaming}
        />
      </div>
    </div>
  );
}
