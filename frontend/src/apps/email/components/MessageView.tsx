import {
  Button,
  Descriptions,
  Drawer,
  Empty,
  Skeleton,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import {
  DownloadOutlined,
  PaperClipOutlined,
  StarFilled,
  StarOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMessage, updateMessage } from "../api/client";
import type { MessageDetail } from "../api/client";

const { Title, Paragraph, Text } = Typography;

interface Props {
  messageId: string | null;
  open: boolean;
  onClose: () => void;
}

export function MessageView({ messageId, open, onClose }: Props) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<MessageDetail>({
    queryKey: ["message", messageId],
    queryFn: () => getMessage(messageId!),
    enabled: !!messageId && open,
  });

  const toggleStar = async () => {
    if (!data) return;
    await updateMessage(data.id, { is_starred: !data.is_starred });
    queryClient.invalidateQueries({ queryKey: ["message", data.id] });
  };

  const downloadUrl = (msgId: string, attId: string) =>
    `/api/v1/messages/${msgId}/attachments/${attId}`;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={720}
      destroyOnClose
      title={
        data ? (
          <Space>
            <Title level={5} style={{ margin: 0 }}>
              {data.subject || "(无主题)"}
            </Title>
            <Button
              size="small"
              type="text"
              icon={data.is_starred ? <StarFilled style={{ color: "#fadb14" }} /> : <StarOutlined />}
              onClick={toggleStar}
            />
          </Space>
        ) : (
          "邮件"
        )
      }
    >
      {isLoading && <Spin />}
      {!isLoading && !data && <Empty description="选择左侧邮件查看详情" />}
      {data && (
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="发件人">
              {data.from_name ? `${data.from_name} <${data.from_address}>` : data.from_address}
            </Descriptions.Item>
            <Descriptions.Item label="收件人">
              <Space size={4} wrap>
                {data.to_addresses.map((a) => (
                  <Tag key={a}>{a}</Tag>
                ))}
              </Space>
            </Descriptions.Item>
            {data.cc_addresses.length > 0 && (
              <Descriptions.Item label="抄送">
                <Space size={4} wrap>
                  {data.cc_addresses.map((a) => (
                    <Tag key={a}>{a}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="时间">
              {dayjs(data.received_at).format("YYYY-MM-DD HH:mm:ss")}
            </Descriptions.Item>
            <Descriptions.Item label="大小">
              {formatSize(data.size_bytes)}
            </Descriptions.Item>
          </Descriptions>

          {data.attachments.length > 0 && (
            <div>
              <Text strong>
                <PaperClipOutlined /> 附件 ({data.attachments.length})
              </Text>
              <Space direction="vertical" size={4} style={{ width: "100%", marginTop: 8 }}>
                {data.attachments.map((a) => (
                  <a
                    key={a.id}
                    href={downloadUrl(data.id, a.id)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: "block" }}
                  >
                    <PaperClipOutlined /> {a.filename}{" "}
                    <Text type="secondary">({a.content_type}, {formatSize(a.size_bytes)})</Text>
                    <DownloadOutlined style={{ marginInlineStart: 8 }} />
                  </a>
                ))}
              </Space>
            </div>
          )}

          <div
            className="email-html"
            style={{
              background: "#fafafa",
              padding: 16,
              borderRadius: 6,
              border: "1px solid #f0f0f0",
              maxHeight: "60vh",
              overflow: "auto",
            }}
          >
            {data.body_html ? (
              <div dangerouslySetInnerHTML={{ __html: data.body_html }} />
            ) : data.body_text ? (
              <Paragraph style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                {data.body_text}
              </Paragraph>
            ) : (
              <Skeleton active />
            )}
          </div>
        </Space>
      )}
    </Drawer>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}