import { Badge, Checkbox, Empty, List, Space, Tag, Typography } from "antd";
import { Paperclip, Star, StarOff } from "lucide-react";
import dayjs from "dayjs";
import type { MessageSummary } from "../api/client";

const { Text } = Typography;

interface Props {
  messages: MessageSummary[] | undefined;
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

export function MessageList({
  messages,
  selectedId,
  onSelect,
  loading,
  selectable = false,
  selectedIds,
  onToggleSelect,
}: Props) {
  const sel = selectedIds ?? new Set<string>();
  return (
    <List
      loading={loading}
      dataSource={messages ?? []}
      locale={{ emptyText: <Empty description="收件箱为空" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      renderItem={(m) => {
        const isSelected = m.id === selectedId;
        const isChecked = sel.has(m.id);
        return (
          <div
            onClick={() => onSelect(m.id)}
            style={{
              cursor: "pointer",
              padding: "12px 16px",
              background: isSelected ? "rgba(0,113,227,0.06)" : "transparent",
              borderBottom: "1px solid rgba(0,0,0,0.04)",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              transition: "background 0.15s cubic-bezier(0.25, 0.1, 0.25, 1)",
            }}
            onMouseEnter={(e) => {
              if (!isSelected) e.currentTarget.style.background = "rgba(0,0,0,0.02)";
            }}
            onMouseLeave={(e) => {
              if (!isSelected) e.currentTarget.style.background = "transparent";
            }}
          >
            {selectable && (
              <Checkbox
                checked={isChecked}
                onClick={(e) => e.stopPropagation()}
                onChange={() => onToggleSelect?.(m.id)}
                style={{ marginTop: 4 }}
              />
            )}

            {/* Avatar circle */}
            <div style={{ position: "relative", flexShrink: 0, marginTop: 2 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: m.is_read
                    ? "#f5f5f7"
                    : "linear-gradient(135deg, #0071e3 0%, #42a1ec 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: m.is_read ? "#86868b" : "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {m.from_address[0]?.toUpperCase() ?? "?"}
              </div>
              {!m.is_read && (
                <div
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#0071e3",
                    border: "2px solid #fff",
                  }}
                />
              )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                <Space size={4} style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                  {!m.is_read ? (
                    <Text strong style={{ fontSize: 13, color: "#1d1d1f" }}>
                      {m.from_name || m.from_address}
                    </Text>
                  ) : (
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {m.from_name || m.from_address}
                    </Text>
                  )}
                  {m.has_attachments && (
                    <Paperclip size={13} strokeWidth={1.8} style={{ color: "#86868b", flexShrink: 0 }} />
                  )}
                </Space>
                <Space size={6} style={{ flexShrink: 0 }}>
                  {m.is_starred && (
                    <Star size={12} strokeWidth={2} fill="#fadb14" color="#fadb14" />
                  )}
                  <Text type="secondary" style={{ fontSize: 12, color: "#86868b" }}>
                    {dayjs(m.received_at).format("MM-DD HH:mm")}
                  </Text>
                </Space>
              </div>
              <Text
                strong={!m.is_read}
                style={{
                  fontSize: 13,
                  fontWeight: m.is_read ? 400 : 500,
                  color: m.is_read ? "#86868b" : "#1d1d1f",
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {m.subject || "(无主题)"}
              </Text>
              <Text
                type="secondary"
                style={{ fontSize: 12, color: "#86868b", display: "block", marginTop: 2 }}
                dangerouslySetInnerHTML={
                  m.preview && m.preview.includes("<mark>")
                    ? { __html: m.preview }
                    : undefined
                }
              >
                {!m.preview || m.preview.includes("<mark>") ? " " : (m.preview as any)}
              </Text>
            </div>
          </div>
        );
      }}
    />
  );
}
