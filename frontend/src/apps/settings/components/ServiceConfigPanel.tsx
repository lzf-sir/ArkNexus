import {
  App,
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Skeleton,
  Space,
  Switch,
  Table,
  Tag,
  Timeline,
  Typography,
} from "antd";
import {
  Clock,
  Delete,
  Edit,
  History,
  RefreshCw,
  Server,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import {
  ConfigHistoryEntry,
  ConfigKeyRead,
  ServiceRead,
  deleteService,
  getConfigHistory,
  heartbeatService,
  listServiceConfigs,
  updateConfigValue,
} from "../api/client";

const { Text, Paragraph } = Typography;

export function statusTag(svc: ServiceRead) {
  if (!svc.is_active) return <Tag style={{ borderRadius: 6 }}>停用</Tag>;
  if (svc.is_online)
    return (
      <Tag color="success" style={{ borderRadius: 6 }}>
        <span style={{ fontSize: 10 }}>● </span>在线
      </Tag>
    );
  return <Tag color="error" style={{ borderRadius: 6 }}>离线</Tag>;
}

export function relativeTime(iso: string): string {
  const t = dayjs(iso);
  const diff = dayjs().diff(t, "minute");
  if (diff < 1) return "刚刚";
  if (diff < 60) return `${diff} 分钟前`;
  if (diff < 1440) return `${Math.floor(diff / 60)} 小时前`;
  return t.format("YYYY-MM-DD HH:mm");
}

export function ServiceCard({
  svc,
  selected,
  onSelect,
  onHeartbeat,
  onDelete,
}: {
  svc: ServiceRead;
  selected: boolean;
  onSelect: () => void;
  onHeartbeat: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  return (
    <div
      className="apple-card-flat"
      onClick={onSelect}
      style={{
        cursor: "pointer",
        padding: 14,
        borderRadius: 12,
        borderColor: selected ? "rgba(0,113,227,0.30)" : "rgba(0,0,0,0.06)",
        background: selected ? "rgba(0,113,227,0.04)" : "#ffffff",
        border: `1px solid ${selected ? "rgba(0,113,227,0.20)" : "rgba(0,0,0,0.06)"}`,
        transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)";
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.boxShadow = "none";
        }
      }}
    >
      <Space direction="vertical" size={6} style={{ width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: svc.is_online
                  ? "linear-gradient(135deg, #34c759 0%, #30d158 100%)"
                  : "linear-gradient(135deg, #86868b 0%, #aeaeb2 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Server size={15} color="#fff" strokeWidth={2} />
            </div>
            <Text strong style={{ fontSize: 14, fontWeight: 600 }}>{svc.display_name}</Text>
          </div>
          {statusTag(svc)}
        </div>
        <Text style={{ fontSize: 12, color: "#86868b" }}>
          <code>{svc.slug}</code>
          {svc.version ? ` · v${svc.version}` : ""}
        </Text>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#86868b" }}>
          <Clock size={11} strokeWidth={1.8} /> {relativeTime(svc.last_heartbeat_at)}
        </div>
        <Space size={6} onClick={(e) => e.stopPropagation()} style={{ marginTop: 4 }}>
          <Button size="small" onClick={onHeartbeat} icon={<RefreshCw size={12} strokeWidth={1.8} />} style={{ borderRadius: 8 }}>
            心跳
          </Button>
          <Popconfirm
            title="从注册表中移除该服务？"
            description="仅影响注册表；要彻底下线请去停掉对应服务进程。"
            onConfirm={onDelete}
            okText="移除"
            cancelText="取消"
          >
            <Button size="small" danger icon={<Delete size={12} strokeWidth={1.8} />} style={{ borderRadius: 8 }}>
              移除
            </Button>
          </Popconfirm>
        </Space>
      </Space>
    </div>
  );
}

export function ServiceConfigsPanel({ slug }: { slug: string }) {
  const queryClient = useQueryClient();

  const configsQuery = useQuery({
    queryKey: ["configs", slug],
    queryFn: () => listServiceConfigs(slug),
  });

  const [editingKey, setEditingKey] = useState<ConfigKeyRead | null>(null);
  const [historyKey, setHistoryKey] = useState<ConfigKeyRead | null>(null);

  const grouped = useMemo(() => {
    const map: Record<string, ConfigKeyRead[]> = {};
    (configsQuery.data ?? []).forEach((c) => {
      const g = c.group || "默认";
      map[g] = map[g] ?? [];
      map[g].push(c);
    });
    return map;
  }, [configsQuery.data]);

  return (
    <>
      {configsQuery.isLoading && <Skeleton active />}
      {!configsQuery.isLoading && Object.keys(grouped).length === 0 && (
        <Empty description="该服务尚未发布任何配置项" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}

      {Object.entries(grouped).map(([group, items]) => (
        <div key={group} style={{ marginBottom: 28 }}>
          <Text strong style={{ display: "block", marginBottom: 14, fontSize: 15, letterSpacing: "-0.01em" }}>
            {group}
          </Text>
          <Table<ConfigKeyRead>
            size="small"
            rowKey="id"
            dataSource={items}
            pagination={false}
            columns={[
              {
                title: "Key",
                dataIndex: "key",
                render: (v: string, r) => (
                  <Space direction="vertical" size={0}>
                    <Text strong>
                      <code>{v}</code>
                    </Text>
                    {r.display_name && (
                      <Text type="secondary" style={{ fontSize: 12, color: "#86868b" }}>
                        {r.display_name}
                      </Text>
                    )}
                  </Space>
                ),
              },
              {
                title: "当前值",
                dataIndex: "current_value",
                width: 240,
                render: (v, r) =>
                  v === null || v === "" ? (
                    <Text type="secondary">（未设置）</Text>
                  ) : r.is_secret ? (
                    <Text type="secondary">••••••</Text>
                  ) : (
                    <Text code>{v}</Text>
                  ),
              },
              {
                title: "类型",
                dataIndex: "value_type",
                width: 80,
                render: (v) => <Tag style={{ borderRadius: 6 }}>{v}</Tag>,
              },
              {
                title: "默认值",
                dataIndex: "default_value",
                width: 120,
                render: (v) =>
                  v === null ? <Text type="secondary">—</Text> : <Text code>{v}</Text>,
              },
              {
                title: "状态",
                width: 200,
                render: (_, r) => (
                  <Space size={4}>
                    {r.is_readonly && <Tag color="orange" style={{ borderRadius: 6 }}>只读</Tag>}
                    {r.is_required && <Tag color="red" style={{ borderRadius: 6 }}>必填</Tag>}
                    {r.is_secret && <Tag color="purple" style={{ borderRadius: 6 }}>敏感</Tag>}
                  </Space>
                ),
              },
              {
                title: "说明",
                dataIndex: "description",
                render: (v) =>
                  v ? (
                    <Text type="secondary" style={{ fontSize: 12, color: "#86868b" }}>
                      {v}
                    </Text>
                  ) : (
                    <Text type="secondary">—</Text>
                  ),
              },
              {
                title: "操作",
                width: 140,
                render: (_, r) => (
                  <Space size={4}>
                    <Button
                      size="small"
                      type="link"
                      icon={<Edit size={13} strokeWidth={1.8} />}
                      onClick={() => setEditingKey(r)}
                      style={{ padding: 0 }}
                    >
                      编辑
                    </Button>
                    <Button
                      size="small"
                      type="link"
                      icon={<History size={13} strokeWidth={1.8} />}
                      onClick={() => setHistoryKey(r)}
                      style={{ padding: 0 }}
                    >
                      历史
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
        </div>
      ))}

      <EditConfigDrawer
        key={editingKey?.id ?? "none"}
        slug={slug}
        cfg={editingKey}
        onClose={() => setEditingKey(null)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["configs", slug] })}
      />

      <HistoryDrawer
        key={historyKey?.id ?? "none"}
        slug={slug}
        cfg={historyKey}
        onClose={() => setHistoryKey(null)}
      />
    </>
  );
}

export function EditConfigDrawer({
  slug,
  cfg,
  onClose,
  onSaved,
}: {
  slug: string;
  cfg: ConfigKeyRead | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm();
  const { message: toast } = App.useApp();
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: (v: { value: string | null; note?: string }) =>
      updateConfigValue(slug, cfg!.key, v.value, v.note),
    onSuccess: () => {
      toast.success("已保存");
      onSaved();
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  if (!cfg) return null;

  return (
    <Drawer
      open={!!cfg}
      onClose={onClose}
      title={
        <span style={{ fontWeight: 600, letterSpacing: "-0.01em" }}>编辑 {cfg.key}</span>
      }
      width={520}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={onClose} style={{ borderRadius: 8 }}>取消</Button>
          <Button
            type="primary"
            loading={mutation.isPending}
            onClick={() => mutation.mutate({ value: form.getFieldValue("value") ?? null, note })}
            style={{ borderRadius: 980 }}
          >
            保存
          </Button>
        </Space>
      }
    >
      {cfg.description && (
        <Paragraph type="secondary" style={{ color: "#86868b", fontSize: 14, background: "#f5f5f7", padding: 12, borderRadius: 10 }}>
          {cfg.description}
        </Paragraph>
      )}
      <Form
        form={form}
        layout="vertical"
        initialValues={{ value: cfg.current_value ?? "" }}
        requiredMark={false}
      >
        <Form.Item label="新值" name="value">
          <ConfigValueInput cfg={cfg} />
        </Form.Item>
        <Form.Item label="备注（可选，会写入历史）">
          <Input.TextArea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}

export function ConfigValueInput({ cfg }: { cfg: ConfigKeyRead }) {
  if (cfg.options && cfg.options.length > 0) {
    return (
      <Select
        options={cfg.options.map((o) => ({ label: String(o), value: String(o) }))}
        defaultValue={cfg.current_value ?? undefined}
        style={{ width: "100%" }}
      />
    );
  }
  switch (cfg.value_type) {
    case "int":
      return (
        <InputNumber
          style={{ width: "100%" }}
          defaultValue={Number(cfg.current_value ?? cfg.default_value ?? 0)}
        />
      );
    case "float":
      return (
        <InputNumber
          step={0.01}
          style={{ width: "100%" }}
          defaultValue={Number(cfg.current_value ?? cfg.default_value ?? 0)}
        />
      );
    case "bool":
      return <Switch defaultChecked={(cfg.current_value ?? "false") === "true"} />;
    default:
      return <Input.TextArea rows={3} defaultValue={cfg.current_value ?? ""} />;
  }
}

export function HistoryDrawer({
  slug,
  cfg,
  onClose,
}: {
  slug: string;
  cfg: ConfigKeyRead | null;
  onClose: () => void;
}) {
  const historyQuery = useQuery({
    queryKey: ["history", slug, cfg?.key],
    queryFn: () => getConfigHistory(slug, cfg!.key),
    enabled: !!cfg,
  });

  if (!cfg) return null;
  const entries: ConfigHistoryEntry[] = historyQuery.data ?? [];

  return (
    <Drawer
      open={!!cfg}
      onClose={onClose}
      title={
        <span style={{ fontWeight: 600, letterSpacing: "-0.01em" }}>变更历史 · {cfg.key}</span>
      }
      width={560}
      destroyOnClose
    >
      {historyQuery.isLoading && <Skeleton active />}
      {!historyQuery.isLoading && entries.length === 0 && (
        <Empty description="暂无变更记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
      {!historyQuery.isLoading && entries.length > 0 && (
        <Timeline
          items={entries.map((e) => ({
            color: e.old_value == null ? "green" : "blue",
            children: (
              <Space direction="vertical" size={0}>
                <Text style={{ fontSize: 12, color: "#86868b" }}>
                  {dayjs(e.changed_at).format("YYYY-MM-DD HH:mm:ss")}
                  {e.changed_by ? ` · ${e.changed_by}` : ""}
                </Text>
                <Text>
                  <Text code delete={!!e.old_value}>
                    {e.old_value ?? "（未设置）"}
                  </Text>{" "}
                  →{" "}
                  <Text code>{e.new_value ?? "（未设置）"}</Text>
                </Text>
                {e.note && (
                  <Text style={{ fontSize: 12, color: "#86868b" }}>
                    {e.note}
                  </Text>
                )}
              </Space>
            ),
          }))}
        />
      )}
    </Drawer>
  );
}
