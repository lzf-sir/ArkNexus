import {
  Button,
  Descriptions,
  Drawer,
  Empty,
  Modal,
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
  TagsOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App } from "antd";
import {
  getMessage,
  updateMessage,
  listLabels,
  setMessageLabels,
} from "../api/client";
import type { LabelInfo, MessageDetail } from "../api/client";
import { useEffect, useMemo, useState } from "react";

const { Title, Paragraph, Text } = Typography;

interface Props {
  messageId: string | null;
  open: boolean;
  onClose: () => void;
}

export function MessageView({ messageId, open, onClose }: Props) {
  const queryClient = useQueryClient();
  const { message: toast } = App.useApp();
  const { data, isLoading } = useQuery<MessageDetail>({
    queryKey: ["message", messageId],
    queryFn: () => getMessage(messageId!),
    enabled: !!messageId && open,
  });

  // Load labels list (labels themselves are embedded on `data.labels`).
  const labelsQuery = useQuery<LabelInfo[]>({
    queryKey: ["labels"],
    queryFn: listLabels,
    enabled: open,
    staleTime: 60_000,
  });
  const [labelPickerOpen, setLabelPickerOpen] = useState(false);
  const [pickedLabelIds, setPickedLabelIds] = useState<string[]>([]);

  useEffect(() => {
    if (data?.labels) {
      setPickedLabelIds(data.labels.map((l) => (l as any).label_id ?? (l as any).id));
    }
  }, [data]);

  const labelMap = useMemo(() => {
    const m: Record<string, LabelInfo> = {};
    (labelsQuery.data ?? []).forEach((l) => (m[l.id] = l));
    return m;
  }, [labelsQuery.data]);

  const setLabelsM = useMutation({
    mutationFn: (ids: string[]) => setMessageLabels(messageId!, ids),
    onSuccess: () => {
      toast.success("已更新标签");
      queryClient.invalidateQueries({ queryKey: ["message", messageId] });
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      setLabelPickerOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleStar = async () => {
    if (!data) return;
    await updateMessage(data.id, { is_starred: !data.is_starred });
    queryClient.invalidateQueries({ queryKey: ["message", data.id] });
  };

  const downloadUrl = (msgId: string, attId: string) =>
    `/api/v1/messages/${msgId}/attachments/${attId}`;

  // Normalise the inline label shape so we can use one consistent accessor.
  const currentLabels = (data?.labels ?? []).map((l: any) => ({
    label_id: l.label_id ?? l.id,
    name: l.name,
    color: l.color,
  }));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={720}
      destroyOnClose
      title={
        data ? (
          <Space align="center">
            <Title level={5} style={{ margin: 0, fontWeight: 600, letterSpacing: "-0.01em" }}>
              {data.subject || "(无主题)"}
            </Title>
            <Button
              size="small"
              type="text"
              icon={data.is_starred ? <StarFilled style={{ color: "#fadb14" }} /> : <StarOutlined />}
              onClick={toggleStar}
              style={{ borderRadius: 8 }}
            />
          </Space>
        ) : (
          "邮件"
        )
      }
    >
      {isLoading && (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <Spin />
        </div>
      )}
      {!isLoading && !data && (
        <Empty description="选择左侧邮件查看详情" style={{ marginTop: 80 }} />
      )}
      {data && (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          {/* Sender info card */}
          <div
            style={{
              background: "#f5f5f7",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <Descriptions column={1} size="small" bordered={false}>
              <Descriptions.Item label="发件人">
                <span style={{ fontWeight: 500 }}>
                  {data.from_name ? `${data.from_name} <${data.from_address}>` : data.from_address}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="收件人">
                <Space size={4} wrap>
                  {data.to_addresses.map((a) => (
                    <Tag key={a} style={{ borderRadius: 6 }}>
                      {a}
                    </Tag>
                  ))}
                </Space>
              </Descriptions.Item>
              {data.cc_addresses.length > 0 && (
                <Descriptions.Item label="抄送">
                  <Space size={4} wrap>
                    {data.cc_addresses.map((a) => (
                      <Tag key={a} style={{ borderRadius: 6 }}>
                        {a}
                      </Tag>
                    ))}
                  </Space>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="时间">
                <span style={{ color: "#86868b" }}>
                  {dayjs(data.received_at).format("YYYY-MM-DD HH:mm:ss")}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="大小">
                <span style={{ color: "#86868b" }}>{formatSize(data.size_bytes)}</span>
              </Descriptions.Item>
              <Descriptions.Item
                label={
                  <Space size={6}>
                    <TagsOutlined style={{ color: "#86868b" }} />
                    <span>标签</span>
                  </Space>
                }
              >
                <Space size={4} wrap>
                  {currentLabels.length === 0 && (
                    <span style={{ color: "#86868b", fontSize: 12 }}>无</span>
                  )}
                  {currentLabels.map((l) => (
                    <Tag
                      key={l.label_id}
                      color={l.color}
                      style={{ borderRadius: 6, margin: 0 }}
                    >
                      {l.name}
                    </Tag>
                  ))}
                  <Button
                    size="small"
                    type="link"
                    icon={<PlusOutlined />}
                    onClick={() => setLabelPickerOpen(true)}
                    style={{ padding: 0, fontSize: 12, height: "auto" }}
                  >
                    管理标签
                  </Button>
                </Space>
              </Descriptions.Item>
            </Descriptions>
          </div>

          {/* Attachments */}
          {data.attachments.length > 0 && (
            <div>
              <Text strong style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <PaperClipOutlined /> 附件 ({data.attachments.length})
              </Text>
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                {data.attachments.map((a) => (
                  <a
                    key={a.id}
                    href={downloadUrl(data.id, a.id)}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: "#f5f5f7",
                      border: "1px solid rgba(0,0,0,0.04)",
                      transition: "all 0.2s",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#ebebed";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#f5f5f7";
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: "#0071e3",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        flexShrink: 0,
                      }}
                    >
                      <PaperClipOutlined />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 13, color: "#1d1d1f" }}>
                        {a.filename}
                      </div>
                      <div style={{ fontSize: 11, color: "#86868b" }}>
                        {a.content_type} · {formatSize(a.size_bytes)}
                      </div>
                    </div>
                    <DownloadOutlined style={{ color: "#0071e3" }} />
                  </a>
                ))}
              </Space>
            </div>
          )}

          {/* Email body */}
          <div
            className="email-html apple-scroll"
            style={{
              background: "#ffffff",
              padding: 20,
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.06)",
              maxHeight: "60vh",
              overflow: "auto",
            }}
          >
            {data.body_html ? (
              <div dangerouslySetInnerHTML={{ __html: data.body_html }} />
            ) : data.body_text ? (
              <Paragraph style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.7, color: "#1d1d1f" }}>
                {data.body_text}
              </Paragraph>
            ) : (
              <Skeleton active />
            )}
          </div>
        </Space>
      )}

      {/* Label picker modal */}
      <Modal
        open={labelPickerOpen}
        title="管理标签"
        okText="保存"
        cancelText="取消"
        confirmLoading={setLabelsM.isPending}
        onCancel={() => setLabelPickerOpen(false)}
        onOk={() => setLabelsM.mutate(pickedLabelIds)}
      >
        {(labelsQuery.data ?? []).length === 0 ? (
          <Empty description="还没有标签，请到侧边栏创建" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            {(labelsQuery.data ?? []).map((l) => {
              const checked = pickedLabelIds.includes(l.id);
              return (
                <div
                  key={l.id}
                  onClick={() => {
                    setPickedLabelIds((cur) =>
                      cur.includes(l.id) ? cur.filter((x) => x !== l.id) : [...cur, l.id]
                    );
                  }}
                  style={{
                    cursor: "pointer",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: `1px solid ${checked ? "rgba(0,113,227,0.30)" : "rgba(0,0,0,0.06)"}`,
                    background: checked ? "rgba(0,113,227,0.04)" : "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    transition: "all 0.15s",
                  }}
                >
                  <Tag color={l.color} style={{ borderRadius: 6, margin: 0 }}>
                    {l.name}
                  </Tag>
                  <span style={{ fontSize: 12, color: checked ? "#0071e3" : "#86868b" }}>
                    {checked ? "已选" : "未选"}
                  </span>
                </div>
              );
            })}
          </Space>
        )}
      </Modal>
    </Drawer>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
