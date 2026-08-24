import {
  App,
  AutoComplete,
  Avatar,
  Badge,
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Slider,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
  Spin,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  SendOutlined,
  SettingOutlined,
  StopOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AIConfigSnapshot,
  ActiveSelection,
  ConversationRead,
  ConversationSummary,
  ModelInfo,
  ProviderConfig,
  ProviderInfo,
  createConversation,
  deleteConversation,
  fetchAIConfig,
  getConversation,
  listConversations,
  saveProviderConfig,
  setActiveSelection,
  streamChat,
} from "../api/client";

const { Text, Title, Paragraph } = Typography;

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  pending?: boolean;
  error?: string;
  created_at?: string;
}

const REGION_COLOR: Record<string, string> = {
  global: "blue",
  china: "magenta",
  proxy: "purple",
};

const REGION_LABEL: Record<string, string> = {
  global: "国际",
  china: "国内",
  proxy: "中转/聚合",
};

export function AIChatPage() {
  const queryClient = useQueryClient();
  const { message: toast } = App.useApp();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // ----- Catalog + active config -----
  const configQuery = useQuery({
    queryKey: ["ai-config"],
    queryFn: fetchAIConfig,
    staleTime: 30_000,
  });

  const conversationsQuery = useQuery({
    queryKey: ["ai-conversations"],
    queryFn: () => listConversations(false),
    refetchInterval: 30_000,
  });

  const conversationQuery = useQuery({
    queryKey: ["ai-conversation", selectedId],
    queryFn: () => getConversation(selectedId!),
    enabled: !!selectedId,
  });

  useEffect(() => {
    if (conversationQuery.data) {
      setMessages(
        conversationQuery.data.messages.map((m) => ({
          id: m.id,
          role: m.role as any,
          content: m.content,
          created_at: m.created_at,
        }))
      );
    } else if (!selectedId) {
      setMessages([]);
    }
  }, [conversationQuery.data, selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ----- Active selection + provider list helpers -----
  const providersById = useMemo(() => {
    const m: Record<string, ProviderInfo> = {};
    (configQuery.data?.providers ?? []).forEach((p) => (m[p.id] = p));
    return m;
  }, [configQuery.data]);

  const active: ActiveSelection | null = configQuery.data?.active ?? null;
  const activeProvider: ProviderInfo | null = active ? providersById[active.provider_id] ?? null : null;
  const activeModel: ModelInfo | null =
    activeProvider && active
      ? activeProvider.models.find((m) => m.id === active.model_id) ?? null
      : null;

  // ----- New chat -----
  const newChat = async () => {
    if (!active) {
      toast.warning("请先在右上角 AI 设置中配置 API Key 并选择模型");
      setSettingsOpen(true);
      return;
    }
    try {
      const conv = await createConversation({
        provider_id: active.provider_id,
        model_id: active.model_id,
      });
      setSelectedId(conv.id);
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // ----- Switch model on the fly (updates conversation too) -----
  const switchModel = async (providerId: string, modelId: string) => {
    try {
      await setActiveSelection({ provider_id: providerId, model_id: modelId });
      queryClient.invalidateQueries({ queryKey: ["ai-config"] });
      // Always start a fresh conversation with the new model so the history aligns cleanly.
      await newChat();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // ----- Send / stream -----
  const send = async () => {
    const text = input.trim();
    if (!text) return;
    if (!selectedId) {
      await newChat();
      return;
    }
    if (!active) {
      toast.warning("请先在设置中选择模型");
      setSettingsOpen(true);
      return;
    }
    setInput("");
    const userMsg: ChatMessage = { id: "tmp-" + Date.now(), role: "user", content: text };
    const assistantId = "tmp-a-" + Date.now();
    const assistantMsg: ChatMessage = { id: assistantId, role: "assistant", content: "", pending: true };
    setMessages((cur) => [...cur, userMsg, assistantMsg]);
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await streamChat(
        selectedId,
        text,
        (event) => {
          if (event.type === "delta" && event.delta) {
            setMessages((cur) =>
              cur.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + event.delta } : m
              )
            );
          } else if (event.type === "error") {
            setMessages((cur) =>
              cur.map((m) =>
                m.id === assistantId
                  ? { ...m, pending: false, error: event.message ?? "请求失败" }
                  : m
              )
            );
          } else if (event.type === "done") {
            setMessages((cur) =>
              cur.map((m) => (m.id === assistantId ? { ...m, pending: false } : m))
            );
          }
        },
        ctrl.signal
      );
    } catch (e) {
      setMessages((cur) =>
        cur.map((m) =>
          m.id === assistantId
            ? { ...m, pending: false, error: (e as Error).message }
            : m
        )
      );
    } finally {
      setStreaming(false);
      abortRef.current = null;
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["ai-conversation", selectedId] });
    }
  };

  const stop = () => {
    abortRef.current?.abort();
  };

  // ----- UI -----
  return (
    <div style={{ height: "calc(100vh - 64px - 48px)", display: "flex", gap: 16 }}>
      {/* Conversations sidebar */}
      <Card
        title="对话列表"
        size="small"
        style={{ width: 280, flexShrink: 0 }}
        bodyStyle={{ padding: 0, height: "calc(100% - 56px)", overflow: "auto" }}
        extra={
          <Space size={4}>
            <Tooltip title="新建对话">
              <Button size="small" type="primary" icon={<PlusOutlined />} onClick={newChat}>
                新建
              </Button>
            </Tooltip>
          </Space>
        }
      >
        {conversationsQuery.isLoading ? (
          <Skeleton active style={{ padding: 12 }} />
        ) : (conversationsQuery.data ?? []).length === 0 ? (
          <Empty description="暂无对话" style={{ marginTop: 32 }} />
        ) : (
          <List
            size="small"
            dataSource={conversationsQuery.data ?? []}
            renderItem={(c) => (
              <List.Item
                onClick={() => setSelectedId(c.id)}
                style={{
                  cursor: "pointer",
                  padding: "10px 12px",
                  background: c.id === selectedId ? "rgba(22,119,255,0.08)" : undefined,
                  borderLeft:
                    c.id === selectedId
                      ? "3px solid #1677ff"
                      : "3px solid transparent",
                }}
                actions={[
                  <Popconfirm
                    key="del"
                    title="删除此对话？"
                    onConfirm={async (e) => {
                      e?.stopPropagation();
                      try {
                        await deleteConversation(c.id);
                        if (c.id === selectedId) setSelectedId(null);
                        queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
                      } catch (err) {
                        toast.error((err as Error).message);
                      }
                    }}
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      danger
                    />
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  avatar={<RobotOutlined style={{ color: "#1677ff" }} />}
                  title={
                    <span style={{ fontSize: 13 }}>
                      {c.title}
                      {c.is_pinned && <Tag color="gold" style={{ marginLeft: 4 }}>置顶</Tag>}
                    </span>
                  }
                  description={
                    <span style={{ fontSize: 11, color: "#888" }}>
                      {(providersById[c.provider_id]?.name ?? c.provider_id)} · {c.model_id}
                      <br />
                      {dayjs(c.updated_at).format("MM-DD HH:mm")}
                    </span>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* Main chat area */}
      <Card
        style={{ flex: 1, display: "flex", flexDirection: "column" }}
        bodyStyle={{
          padding: 0,
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
        title={
          <Space>
            <RobotOutlined style={{ color: "#1677ff" }} />
            <span>AI 会话</span>
            {activeProvider && activeModel && (
              <Tag color={REGION_COLOR[activeProvider.region]}>
                {REGION_LABEL[activeProvider.region]}
              </Tag>
            )}
            {activeModel && <Tag color="blue">{activeModel.name}</Tag>}
          </Space>
        }
        extra={
          <Space>
            <ModelPicker
              providers={configQuery.data?.providers ?? []}
              active={active}
              providerConfigs={configQuery.data?.provider_configs ?? []}
              onSwitch={switchModel}
              onOpenSettings={() => setSettingsOpen(true)}
            />
            <Button
              icon={<SettingOutlined />}
              onClick={() => setSettingsOpen(true)}
            >
              设置
            </Button>
          </Space>
        }
      >
        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: 16,
            background: "#fafafa",
          }}
        >
          {messages.length === 0 && (
            <Empty
              description={
                active
                  ? "开始与 AI 对话吧"
                  : "尚未配置模型，请点击右上角设置"
              }
              style={{ marginTop: 80 }}
            />
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div
          style={{
            padding: 12,
            borderTop: "1px solid #f0f0f0",
            background: "#fff",
          }}
        >
          <Space.Compact style={{ width: "100%" }}>
            <Input.TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="输入消息，Shift+Enter 换行"
              autoSize={{ minRows: 1, maxRows: 6 }}
              disabled={streaming}
            />
            {streaming ? (
              <Button danger icon={<StopOutlined />} onClick={stop}>
                停止
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={send}
                disabled={!input.trim() || !selectedId}
              >
                发送
              </Button>
            )}
          </Space.Compact>
        </div>
      </Card>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        snapshot={configQuery.data}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["ai-config"] });
        }}
      />
    </div>
  );
}

// ============================================================
// Message bubble
// ============================================================
function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        marginBottom: 16,
        flexDirection: isUser ? "row-reverse" : "row",
      }}
    >
      <Avatar
        icon={isUser ? <UserOutlined /> : <RobotOutlined />}
        style={{
          backgroundColor: isUser ? "#1677ff" : "#52c41a",
          flexShrink: 0,
        }}
      />
      <div
        style={{
          maxWidth: "75%",
          background: isUser ? "#1677ff" : "#fff",
          color: isUser ? "#fff" : "#222",
          padding: "10px 14px",
          borderRadius: 8,
          border: !isUser ? "1px solid #f0f0f0" : undefined,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          lineHeight: 1.7,
        }}
      >
        {msg.pending && !msg.content ? (
          <span style={{ opacity: 0.6 }}>
            <Spin size="small" /> 思考中...
          </span>
        ) : msg.error ? (
          <span style={{ color: "#cf1322" }}>{msg.error}</span>
        ) : (
          msg.content
        )}
        {msg.pending && msg.content && (
          <span style={{ opacity: 0.5, marginLeft: 4 }}>▍</span>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Model picker (top right)
// ============================================================
function ModelPicker({
  providers,
  active,
  providerConfigs,
  onSwitch,
  onOpenSettings,
}: {
  providers: ProviderInfo[];
  active: ActiveSelection | null;
  providerConfigs: ProviderConfig[];
  onSwitch: (providerId: string, modelId: string) => void;
  onOpenSettings: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ready = useMemo<(ProviderInfo & { configured: boolean })[]>(
    () =>
      providers.map((p) => ({
        ...p,
        configured: !!providerConfigs.find((c) => c.provider_id === p.id)?.api_key_set,
      })),
    [providers, providerConfigs]
  );

  const grouped = useMemo(() => {
    const g: Record<string, (ProviderInfo & { configured: boolean })[]> = {};
    ready.forEach((p) => {
      (g[p.region] = g[p.region] || []).push(p);
    });
    return g;
  }, [ready]);

  return (
    <div style={{ position: "relative" }}>
      <Button onClick={() => setOpen((o) => !o)} icon={<ThunderboltOutlined />}>
        {active
          ? providersByName(providers, active)?.models.find((m) => m.id === active.model_id)?.name ?? active.model_id
          : "选择模型"}
      </Button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 4,
            width: 480,
            maxHeight: 480,
            overflow: "auto",
            background: "#fff",
            boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
            borderRadius: 8,
            padding: 8,
            zIndex: 100,
          }}
        >
          {Object.entries(grouped).map(([region, items]) => (
            <div key={region}>
              <div style={{ padding: "6px 10px", fontWeight: 600, color: "#888", fontSize: 12 }}>
                {REGION_LABEL[region] ?? region}
              </div>
              {items.map((p) => (
                <div key={p.id} style={{ marginBottom: 6 }}>
                  <div
                    style={{
                      padding: "4px 8px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{p.name}</span>
                    <Space size={4}>
                      {p.configured ? (
                        <Tag color="green">已配置</Tag>
                      ) : (
                        <Button
                          size="small"
                          type="link"
                          icon={<KeyOutlined />}
                          onClick={() => {
                            onOpenSettings();
                            setOpen(false);
                          }}
                        >
                          配置 Key
                        </Button>
                      )}
                    </Space>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 4,
                      padding: "0 4px",
                    }}
                  >
                    {p.models.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => {
                          if (!p.configured) {
                            onOpenSettings();
                            setOpen(false);
                            return;
                          }
                          onSwitch(p.id, m.id);
                          setOpen(false);
                        }}
                        title={m.description}
                        style={{
                          padding: "6px 8px",
                          cursor: "pointer",
                          borderRadius: 4,
                          background:
                            active?.provider_id === p.id && active?.model_id === m.id
                              ? "rgba(22,119,255,0.12)"
                              : "transparent",
                          fontSize: 12,
                        }}
                      >
                        <div style={{ fontWeight: 500 }}>{m.name}</div>
                        <div style={{ color: "#999", fontSize: 11 }}>
                          {(m.context_window / 1000).toFixed(0)}K ctx
                          {m.tags?.includes("free") && <Tag color="green" style={{ marginLeft: 4 }}>免费</Tag>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function providersByName(providers: ProviderInfo[], active: ActiveSelection) {
  return providers.find((p) => p.id === active.provider_id);
}

// ============================================================
// Settings drawer
// ============================================================
function SettingsDrawer({
  open,
  onClose,
  snapshot,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  snapshot: AIConfigSnapshot | undefined;
  onSaved: () => void;
}) {
  const { message: toast } = App.useApp();
  const providers = snapshot?.providers ?? [];
  const configs = snapshot?.provider_configs ?? [];
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const g: Record<string, ProviderInfo[]> = {};
    providers.forEach((p) => (
      (g[p.region] = g[p.region] || []).push(p)
    ));
    return g;
  }, [providers]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <Space>
          <KeyOutlined />
          <span>AI 服务商配置</span>
        </Space>
      }
      width={680}
      destroyOnClose
    >
      <Paragraph type="secondary">
        只需要填写一个或多个服务商的 API Key。Key 会写入 config-service 的加密配置项，仅用于本服务调用上游。
      </Paragraph>
      {!snapshot ? (
        <Skeleton active />
      ) : (
        Object.entries(grouped).map(([region, items]) => (
          <div key={region} style={{ marginBottom: 16 }}>
            <Title level={5} style={{ marginTop: 16 }}>
              <Tag color={REGION_COLOR[region]}>{REGION_LABEL[region]}</Tag>
            </Title>
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              {items.map((p) => {
                const cfg = configs.find((c) => c.provider_id === p.id);
                return (
                  <Card key={p.id} size="small">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <strong>{p.name}</strong>{" "}
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          ({p.name_en})
                        </Text>
                        <div style={{ fontSize: 12, color: "#888" }}>{p.description}</div>
                      </div>
                      <Space>
                        {cfg?.api_key_set ? (
                          <Badge status="success" text="已配置 Key" />
                        ) : (
                          <Badge status="default" text="未配置" />
                        )}
                        <Button
                          type="primary"
                          size="small"
                          icon={<KeyOutlined />}
                          onClick={() => setEditingProviderId(p.id)}
                        >
                          {cfg?.api_key_set ? "修改" : "配置"}
                        </Button>
                        {p.signup_url && (
                          <Button
                            type="link"
                            size="small"
                            href={p.signup_url}
                            target="_blank"
                          >
                            获取 Key
                          </Button>
                        )}
                      </Space>
                    </div>
                    {cfg?.base_url_override && (
                      <div style={{ marginTop: 4, fontSize: 11, color: "#888" }}>
                        Base URL 覆盖: <code>{cfg.base_url_override}</code>
                      </div>
                    )}
                  </Card>
                );
              })}
            </Space>
          </div>
        ))
      )}
      {editingProviderId && (
        <ProviderKeyModal
          provider={providers.find((p) => p.id === editingProviderId)!}
          current={configs.find((c) => c.provider_id === editingProviderId)}
          onClose={() => setEditingProviderId(null)}
          onSaved={() => {
            setEditingProviderId(null);
            onSaved();
            toast.success("已保存");
          }}
        />
      )}
    </Drawer>
  );
}

function ProviderKeyModal({
  provider,
  current,
  onClose,
  onSaved,
}: {
  provider: ProviderInfo;
  current: ProviderConfig | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(current?.base_url_override ?? "");
  const save = useMutation({
    mutationFn: () =>
      saveProviderConfig(provider.id, {
        api_key: apiKey || null,
        base_url_override: baseUrl || null,
      }),
    onSuccess: onSaved,
  });
  return (
    <Modal
      open
      title={`配置 ${provider.name}`}
      onCancel={onClose}
      onOk={() => save.mutate()}
      confirmLoading={save.isPending}
      okText="保存"
      cancelText="取消"
    >
      <Paragraph type="secondary">
        在 {provider.signup_url ? (
          <a href={provider.signup_url} target="_blank" rel="noreferrer">
            {provider.signup_url}
          </a>
        ) : (
          "服务商控制台"
        )}{" "}
        获取 API Key，填入下方。留空表示清除当前 Key。
      </Paragraph>
      <Form layout="vertical">
        <Form.Item label="API Key">
          <Input.Password
            placeholder={current?.api_key ? `当前: ${current.api_key}` : "sk-..."}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </Form.Item>
        <Form.Item
          label={
            <span>
              Base URL 覆盖{" "}
              <Text type="secondary" style={{ fontSize: 12 }}>(可选)</Text>
            </span>
          }
          extra={`默认: ${provider.base_url || "(无)"}`}
        >
          <Input
            placeholder="https://your-proxy.example.com/v1"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
