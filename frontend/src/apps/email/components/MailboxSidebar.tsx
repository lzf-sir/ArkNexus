import { Badge, Button, List, Popconfirm, Space, Tag, Tooltip, Typography } from "antd";
import {
  DeleteOutlined,
  MailOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useQueryClient } from "@tanstack/react-query";
import { App } from "antd";
import type { Mailbox } from "../api/client";
import { deleteMailbox } from "../api/client";

const { Text } = Typography;

interface Props {
  mailboxes: Mailbox[] | undefined;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export function MailboxSidebar({
  mailboxes,
  selectedId,
  onSelect,
  onCreate,
  onRefresh,
  isLoading,
}: Props) {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const handleDelete = async (id: string, address: string) => {
    try {
      await deleteMailbox(id);
      message.success(`已删除 ${address}`);
      queryClient.invalidateQueries({ queryKey: ["mailboxes"] });
      if (selectedId === id) {
        onSelect("");
      }
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  return (
    <Space direction="vertical" size="small" style={{ width: "100%" }}>
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <Text strong>邮箱</Text>
        <Space>
          <Tooltip title="刷新">
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={onRefresh}
              loading={isLoading}
            />
          </Tooltip>
          <Tooltip title="新建临时邮箱">
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              onClick={onCreate}
            />
          </Tooltip>
        </Space>
      </Space>

      <List
        size="small"
        loading={isLoading}
        dataSource={mailboxes ?? []}
        locale={{ emptyText: "暂无邮箱，点击右上角 + 创建" }}
        renderItem={(mb) => {
          const isSelected = mb.id === selectedId;
          const daysLeft = Math.max(
            0,
            dayjs(mb.expires_at).diff(dayjs(), "day")
          );
          return (
            <List.Item
              onClick={() => onSelect(mb.id)}
              style={{
                cursor: "pointer",
                padding: "10px 12px",
                borderRadius: 6,
                background: isSelected ? "rgba(22,119,255,0.08)" : "transparent",
                border: isSelected
                  ? "1px solid rgba(22,119,255,0.35)"
                  : "1px solid transparent",
                marginBottom: 4,
              }}
            >
              <List.Item.Meta
                avatar={
                  <Badge count={mb.unread_count} size="small" offset={[0, 4]}>
                    <MailOutlined style={{ fontSize: 18 }} />
                  </Badge>
                }
                title={
                  <Space size={4} style={{ width: "100%", justifyContent: "space-between" }}>
                    <Text
                      strong={isSelected}
                      style={{ maxWidth: 180 }}
                      ellipsis
                      title={mb.address}
                    >
                      {mb.display_name || mb.address.split("@")[0]}
                    </Text>
                    <Popconfirm
                      title="删除该邮箱？"
                      description="该邮箱下的所有邮件、附件会被一并清理。"
                      okText="删除"
                      cancelText="取消"
                      onConfirm={(e) => {
                        e?.stopPropagation();
                        handleDelete(mb.id, mb.address);
                      }}
                      onCancel={(e) => e?.stopPropagation()}
                    >
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Popconfirm>
                  </Space>
                }
                description={
                  <Space direction="vertical" size={0} style={{ width: "100%" }}>
                    <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                      {mb.address}
                    </Text>
                    <Tag color={daysLeft <= 3 ? "orange" : "blue"} style={{ marginInlineEnd: 0 }}>
                      剩 {daysLeft} 天
                    </Tag>
                  </Space>
                }
              />
            </List.Item>
          );
        }}
      />
    </Space>
  );
}

