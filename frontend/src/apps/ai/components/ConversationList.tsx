// frontend/src/apps/ai/components/ConversationList.tsx
import { Button, Input, Typography } from "antd";
import { Plus, Search, Pin, PinOff, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import dayjs from "dayjs";
import type { ConversationSummary } from "../api/client";

const { Text } = Typography;

interface Props {
  conversations: ConversationSummary[];
  selectedId: string | null;
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onPin: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
}

export function ConversationList({
  conversations,
  selectedId,
  loading,
  searchQuery,
  onSearchChange,
  onSelect,
  onNew,
  onPin,
  onDelete,
}: Props) {
  const sorted = [...conversations].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return (
    <div className="glass" style={{ width: 260, padding: 12, borderRadius: 16, display: "flex", flexDirection: "column", gap: 12, flexShrink: 0 }}>
      <Button type="primary" icon={<Plus size={15} strokeWidth={2} />} block onClick={onNew} style={{ borderRadius: 999 }}>
        新建会话
      </Button>
      <Input
        prefix={<Search size={14} strokeWidth={1.8} />}
        placeholder="搜索会话…"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        allowClear
        size="middle"
      />
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, paddingRight: 4 }}>
        {loading ? (
          <Text type="secondary" style={{ padding: 16, textAlign: "center" }}>加载中...</Text>
        ) : sorted.length === 0 ? (
          <Text type="secondary" style={{ padding: 16, textAlign: "center" }}>暂无会话</Text>
        ) : (
          sorted.map((c, idx) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.03 }}
            >
              <ConversationItem
                conv={c}
                active={c.id === selectedId}
                onSelect={() => onSelect(c.id)}
                onPin={() => onPin(c.id, !c.is_pinned)}
                onDelete={() => onDelete(c.id)}
              />
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

function ConversationItem({
  conv,
  active,
  onSelect,
  onPin,
  onDelete,
}: {
  conv: ConversationSummary;
  active: boolean;
  onSelect: () => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      whileHover={{ x: 2 }}
      onClick={onSelect}
      className={active ? "glass-tinted" : ""}
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        background: active ? undefined : "transparent",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {conv.is_pinned && <Pin size={12} strokeWidth={2} />}
        <span style={{ fontWeight: 600, fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {conv.title || "新会话"}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onPin(); }}
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, color: "inherit", display: "flex" }}
          aria-label={conv.is_pinned ? "取消置顶" : "置顶"}
        >
          {conv.is_pinned ? <PinOff size={12} /> : <Pin size={12} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, color: "inherit", display: "flex" }}
          aria-label="删除"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <span style={{ fontSize: 11, color: "var(--ant-color-text-tertiary, #86868b)" }}>
        {dayjs(conv.updated_at).format("MM-DD HH:mm")}
      </span>
    </motion.div>
  );
}
