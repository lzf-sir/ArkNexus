import { Alert, Button, Space, Tag, Tooltip, Typography } from "antd";
import {
  CopyOutlined,
  FileTextOutlined,
  ReloadOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { App } from "antd";
import dayjs from "dayjs";
import type { Mailbox } from "../api/client";

const { Text } = Typography;

interface Props {
  mailbox: Mailbox | null | undefined;
  onDraft: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
}

export function TopBar({
  mailbox,
  onDraft,
  onRefresh,
  isRefreshing,
  autoRefresh,
  onToggleAutoRefresh,
}: Props) {
  const { message } = App.useApp();

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => message.success("已复制到剪贴板"),
      () => message.error("复制失败")
    );
  };

  if (!mailbox) {
    return (
      <Alert
        type="info"
        showIcon
        message="左侧没有邮箱。请点击右上角 + 创建一个新的临时邮箱。"
      />
    );
  }

  const expires = dayjs(mailbox.expires_at);
  const now = dayjs();
  const daysLeft = Math.max(0, expires.diff(now, "day"));
  const expiringSoon = daysLeft <= 3;

  return (
    <Space
      style={{
        width: "100%",
        justifyContent: "space-between",
        padding: "8px 16px",
        background: "#fafafa",
        borderRadius: 6,
        border: "1px solid #f0f0f0",
      }}
    >
      <Space size="middle">
        <Text strong>{mailbox.display_name || mailbox.address}</Text>
        <Tooltip title="复制地址">
          <Button
            size="small"
            icon={<CopyOutlined />}
            onClick={() => copy(mailbox.address)}
          />
        </Tooltip>
        <Text type="secondary" style={{ fontSize: 12 }}>
          收信域名：{mailbox.address.split("@")[1]}
        </Text>
        <Tag color={expiringSoon ? "orange" : "green"}>
          {daysLeft} 天后过期（{expires.format("YYYY-MM-DD")}）
        </Tag>
      </Space>
      <Space>
        <Tooltip title={autoRefresh ? "暂停自动刷新" : "开启自动刷新（每 15s）"}>
          <Button
            size="small"
            icon={<SyncOutlined spin={autoRefresh} />}
            onClick={onToggleAutoRefresh}
            type={autoRefresh ? "primary" : "default"}
          >
            {autoRefresh ? "自动刷新中" : "自动刷新"}
          </Button>
        </Tooltip>
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={onRefresh}
          loading={isRefreshing}
        >
          立即刷新
        </Button>
        <Button
          size="small"
          type="primary"
          icon={<FileTextOutlined />}
          onClick={onDraft}
        >
          新建草稿
        </Button>
      </Space>
    </Space>
  );
}

