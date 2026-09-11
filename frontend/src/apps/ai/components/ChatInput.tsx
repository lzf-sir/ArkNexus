// frontend/src/apps/ai/components/ChatInput.tsx
import { Button, Input } from "antd";
import { Send, Square } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop?: () => void;
  disabled?: boolean;
  streaming?: boolean;
  placeholder?: string;
}

export function ChatInput({ value, onChange, onSend, onStop, disabled, streaming, placeholder }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = Math.min(ref.current.scrollHeight, 160) + "px";
    }
  }, [value]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSend();
    }
  };

  return (
    <div className="glass" style={{ padding: 10, borderRadius: 16, display: "flex", gap: 8, alignItems: "flex-end" }}>
      <Input.TextArea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder || "输入消息，回车发送，Shift+回车换行"}
        autoSize={{ minRows: 1, maxRows: 6 }}
        disabled={disabled}
        style={{ resize: "none", border: "none", boxShadow: "none", background: "transparent" }}
      />
      {streaming ? (
        <Button danger icon={<Square size={14} />} onClick={onStop} style={{ borderRadius: 999 }}>停止</Button>
      ) : (
        <motion.div whileTap={{ scale: 0.94 }}>
          <Button
            type="primary"
            icon={<Send size={14} />}
            onClick={onSend}
            disabled={disabled || !value.trim()}
            style={{ borderRadius: 999 }}
          >
            发送
          </Button>
        </motion.div>
      )}
    </div>
  );
}
