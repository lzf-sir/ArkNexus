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
        style={{ borderRadius: 10 }}
      />
    );
  }

  const expires = dayjs(mailbox.expires_at);
  const now = dayjs();
  const daysLeft = Math.max(0, expires.diff(now, "day"));
  const expiringSoon = daysLeft <= 3;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 14px",
        background: "#f5f5f7",
        borderRadius: 10,
        border: "1px solid rgba(0,0,0,0.04)",
      }}
    >
      <Space size="middle">
        <Text strong style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>
          {mailbox.display_name || mailbox.address}
        </Text>
        <Tooltip title="复制地址">
          <Button
            size="small"
            type="text"
            icon={<CopyOutlined />}
            onClick={() => copy(mailbox.address)}
            style={{ borderRadius: 6, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}
          />
        </Tooltip>
        <Text style={{ fontSize: 12, color: "#86868b" }}>
          收信域名：{mailbox.address.split("@")[1]}
        </Text>
        <Tag
          color={expiringSoon ? "orange" : "green"}
          style={{ borderRadius: 980, margin: 0, padding: "2px 10px", fontSize: 12 }}
        >
          {daysLeft} 天后过期（{expires.format("YYYY-MM-DD")}）
        </Tag>
      </Space>
      <Space size={6}>
        <Tooltip title={autoRefresh ? "暂停自动刷新" : "开启自动刷新（每 15s）"}>
          <Button
            size="small"
            icon={<SyncOutlined spin={autoRefresh} />}
            onClick={onToggleAutoRefresh}
            type={autoRefresh ? "primary" : "default"}
            style={{ borderRadius: 8 }}
          >
            {autoRefresh ? "自动刷新中" : "自动刷新"}
          </Button>
        </Tooltip>
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={onRefresh}
          loading={isRefreshing}
          style={{ borderRadius: 8 }}
        >
          立即刷新
        </Button>
        <Button
          size="small"
          type="primary"
          icon={<FileTextOutlined />}
          onClick={onDraft}
          style={{ borderRadius: 8 }}
        >
          新建草稿
        </Button>
      </Space>
    </div>
  );
}
