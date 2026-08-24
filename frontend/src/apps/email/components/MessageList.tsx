import { Badge, Checkbox, Empty, List, Space, Tag, Typography } from "antd";
import { PaperClipOutlined, StarFilled, StarOutlined } from "@ant-design/icons";
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
      locale={{ emptyText: <Empty description="收件箱为空" /> }}
      renderItem={(m) => {
        const isSelected = m.id === selectedId;
        const isChecked = sel.has(m.id);
        return (
          <List.Item
            onClick={() => onSelect(m.id)}
            style={{
              cursor: "pointer",
              padding: "10px 16px",
              background: isSelected ? "rgba(22,119,255,0.08)" : "transparent",
              borderBottom: "1px solid #f0f0f0",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {selectable && (
              <Checkbox
                checked={isChecked}
                onClick={(e) => e.stopPropagation()}
                onChange={() => onToggleSelect?.(m.id)}
              />
            )}
            <List.Item.Meta
              style={{ flex: 1, minWidth: 0 }}
              avatar={
                <Badge dot={!m.is_read}>
                  <Tag color={m.is_read ? "default" : "processing"} style={{ marginInlineEnd: 0 }}>
                    {m.from_address[0]?.toUpperCase() ?? "?"}
                  </Tag>
                </Badge>
              }
              title={
                <Space style={{ width: "100%", justifyContent: "space-between" }}>
                  <Space size={4}>
                    {!m.is_read && <Text strong>{m.from_name || m.from_address}</Text>}
                    {m.is_read && (
                      <Text type="secondary">{m.from_name || m.from_address}</Text>
                    )}
                    {m.has_attachments && <PaperClipOutlined style={{ color: "#999" }} />}
                  </Space>
                  <Space size={4}>
                    {m.is_starred && (
                      <StarFilled style={{ color: "#fadb14", fontSize: 12 }} />
                    )}
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(m.received_at).format("MM-DD HH:mm")}
                    </Text>
                  </Space>
                </Space>
              }
              description={
                <Space direction="vertical" size={0} style={{ width: "100%" }}>
                  <Text strong={!m.is_read} style={{ fontSize: 13 }} ellipsis>
                    {m.subject || "(无主题)"}
                  </Text>
                  <Text
                    type="secondary"
                    style={{ fontSize: 12 }}
                    ellipsis
                    dangerouslySetInnerHTML={
                      m.preview && m.preview.includes("<mark>")
                        ? { __html: m.preview }
                        : undefined
                    }
                  >
                    {!m.preview || m.preview.includes("<mark>") ? " " : (m.preview as any)}
                  </Text>
                </Space>
              }
            />
          </List.Item>
        );
      }}
    />
  );
}