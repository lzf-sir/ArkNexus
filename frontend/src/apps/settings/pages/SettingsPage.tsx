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
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
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
  listServices,
  updateConfigValue,
} from "../api/client";

const { Title, Text, Paragraph } = Typography;

function statusTag(svc: ServiceRead) {
  if (!svc.is_active) return <Tag color="default">停用</Tag>;
  if (svc.is_online)
    return (
      <Tag color="green">
        <span style={{ fontSize: 10 }}>● </span>在线
      </Tag>
    );
  return <Tag color="red">离线</Tag>;
}

function relativeTime(iso: string): string {
  const t = dayjs(iso);
  const diff = dayjs().diff(t, "minute");
  if (diff < 1) return "刚刚";
  if (diff < 60) return `${diff} 分钟前`;
  if (diff < 1440) return `${Math.floor(diff / 60)} 小时前`;
  return t.format("YYYY-MM-DD HH:mm");
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { message: toast } = App.useApp();

  const servicesQuery = useQuery({
    queryKey: ["services"],
    queryFn: listServices,
    refetchInterval: 30_000,
  });

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const selectedService = useMemo(() => {
    if (!servicesQuery.data || !selectedSlug) return null;
    return servicesQuery.data.find((s) => s.slug === selectedSlug) ?? null;
  }, [servicesQuery.data, selectedSlug]);

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          系统设置
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          管理所有 ArkNexus 微服务的功能开关与配置项。配置改动会写入审计日志并通过心跳反馈给对应服务。
        </Paragraph>
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        <Card title="服务列表" style={{ width: 320, flexShrink: 0 }}>
          {servicesQuery.isLoading && <Skeleton active />}
          {servicesQuery.data && servicesQuery.data.length === 0 && (
            <Empty description="暂无已注册服务" />
          )}
          {servicesQuery.data && servicesQuery.data.length > 0 && (
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              {servicesQuery.data.map((s) => (
                <ServiceCard
                  key={s.slug}
                  svc={s}
                  selected={selectedSlug === s.slug}
                  onSelect={() => setSelectedSlug(s.slug)}
                  onHeartbeat={async () => {
                    try {
                      await heartbeatService(s.slug);
                      toast.success(`已向 ${s.display_name} 发送心跳`);
                      queryClient.invalidateQueries({ queryKey: ["services"] });
                    } catch (err) {
                      toast.error((err as Error).message);
                    }
                  }}
                  onDelete={async () => {
                    try {
                      await deleteService(s.slug);
                      toast.success(`已移除 ${s.display_name}`);
                      if (selectedSlug === s.slug) setSelectedSlug(null);
                      queryClient.invalidateQueries({ queryKey: ["services"] });
                    } catch (err) {
                      toast.error((err as Error).message);
                    }
                  }}
                />
              ))}
            </Space>
          )}
        </Card>

        <Card
          title={selectedService ? `${selectedService.display_name} 配置` : "选择一个服务"}
          style={{ flex: 1 }}
          extra={
            selectedService && (
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={() =>
                  queryClient.invalidateQueries({
                    queryKey: ["configs", selectedService.slug],
                  })
                }
              >
                刷新
              </Button>
            )
          }
        >
          {!selectedService && <Empty description="在左侧选择一个服务查看配置项" />}
          {selectedService && <ServiceConfigsPanel slug={selectedService.slug} />}
        </Card>
      </div>
    </Space>
  );
}

function ServiceCard({
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
    <Card
      size="small"
      hoverable
      onClick={onSelect}
      style={{
        cursor: "pointer",
        borderColor: selected ? "#1677ff" : undefined,
        background: selected ? "rgba(22,119,255,0.05)" : undefined,
      }}
      styles={{ body: { padding: 12 } }}
    >
      <Space direction="vertical" size={4} style={{ width: "100%" }}>
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Text strong>{svc.display_name}</Text>
          {statusTag(svc)}
        </Space>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <code>{svc.slug}</code>
          {svc.version ? ` · v${svc.version}` : ""}
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <ClockCircleOutlined /> {relativeTime(svc.last_heartbeat_at)}
        </Text>
        <Space size={4} onClick={(e) => e.stopPropagation()}>
          <Button size="small" onClick={onHeartbeat} icon={<ReloadOutlined />}>
            心跳
          </Button>
          <Popconfirm
            title="从注册表中移除该服务？"
            description="仅影响注册表；要彻底下线请去停掉对应服务进程。"
            onConfirm={onDelete}
            okText="移除"
            cancelText="取消"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              移除
            </Button>
          </Popconfirm>
        </Space>
      </Space>
    </Card>
  );
}

function ServiceConfigsPanel({ slug }: { slug: string }) {
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
        <Empty description="该服务尚未发布任何配置项" />
      )}

      {Object.entries(grouped).map(([group, items]) => (
        <div key={group} style={{ marginBottom: 24 }}>
          <Title level={5} style={{ marginBottom: 12 }}>
            {group}
          </Title>
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
                      <Text type="secondary" style={{ fontSize: 12 }}>
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
                render: (v) => <Tag>{v}</Tag>,
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
                    {r.is_readonly && <Tag color="orange">只读</Tag>}
                    {r.is_required && <Tag color="red">必填</Tag>}
                    {r.is_secret && <Tag color="purple">敏感</Tag>}
                  </Space>
                ),
              },
              {
                title: "说明",
                dataIndex: "description",
                render: (v) =>
                  v ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>
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
                      icon={<EditOutlined />}
                      onClick={() => setEditingKey(r)}
                    >
                      编辑
                    </Button>
                    <Button
                      size="small"
                      type="link"
                      icon={<HistoryOutlined />}
                      onClick={() => setHistoryKey(r)}
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

function EditConfigDrawer({
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
      title={`编辑 ${cfg.key}`}
      width={520}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button
            type="primary"
            loading={mutation.isPending}
            onClick={() => mutation.mutate({ value: form.getFieldValue("value") ?? null, note })}
          >
            保存
          </Button>
        </Space>
      }
    >
      {cfg.description && <Paragraph type="secondary">{cfg.description}</Paragraph>}
      <Form
        form={form}
        layout="vertical"
        initialValues={{ value: cfg.current_value ?? "" }}
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

function ConfigValueInput({ cfg }: { cfg: ConfigKeyRead }) {
  if (cfg.options && cfg.options.length > 0) {
    return (
      <Select
        options={cfg.options.map((o) => ({ label: String(o), value: String(o) }))}
        defaultValue={cfg.current_value ?? undefined}
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

function HistoryDrawer({
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
      title={`变更历史 · ${cfg.key}`}
      width={560}
      destroyOnClose
    >
      {historyQuery.isLoading && <Skeleton active />}
      {!historyQuery.isLoading && entries.length === 0 && (
        <Empty description="暂无变更记录" />
      )}
      {!historyQuery.isLoading && entries.length > 0 && (
        <Timeline
          items={entries.map((e) => ({
            color: e.old_value == null ? "green" : "blue",
            children: (
              <Space direction="vertical" size={0}>
                <Text type="secondary" style={{ fontSize: 12 }}>
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
                  <Text type="secondary" style={{ fontSize: 12 }}>
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