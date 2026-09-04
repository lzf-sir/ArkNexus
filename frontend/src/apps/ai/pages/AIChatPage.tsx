import {
  App,
  Button,
  Card,
  Dropdown,
  Empty,
  Input,
  Modal,
  Skeleton,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  Bot,
  Copy,
  Check,
  Edit3,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Send,
  Square,
  Trash2,
  User,
  Archive,
  ArchiveRestore,
  Search,
  Download,
  X,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActiveSelection,
  ConversationSummary,
  ModelInfo,
  SearchHit,
  createConversation,
  deleteConversation,
  exportConversation,
  fetchAIConfig,
  getConversation,
  listConversations,
  searchConversations,
  streamChat,
  updateConversation,
} from "../api/client";
import { REGION_COLOR, REGION_LABEL } from "../constants";
import { AIOnboarding } from "../components/AIOnboarding";

const { Text } = Typography;

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  pending?: boolean;
  error?: string;
  created_at?: string;
}

export function AIChatPage() {
  const queryClient = useQueryClient();
  const { message: toast } = App.useApp();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [search, setSearch] = useState("");
  const [exportOpenFor, setExportOpenFor] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const configQuery = useQuery({
    queryKey: ["ai-config"],
    queryFn: fetchAIConfig,
    staleTime: 30_000,
  });

  const conversationsQuery = useQuery({
    queryKey: ["ai-conversations", showArchived],
    queryFn: () => listConversations(showArchived),
    refetchInterval: 30_000,
  });

  const trimmedSearch = search.trim();
  const searchQuery = useQuery<SearchHit[]>({
    queryKey: ["ai-search", trimmedSearch, showArchived],
    queryFn: () =>
      searchConversations(trimmedSearch, { include_archived: showArchived }),
    enabled: trimmedSearch.length > 0,
    staleTime: 10_000,
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

  const providersById = useMemo(() => {
    const m: Record<string, any> = {};
    (configQuery.data?.providers ?? []).forEach((p) => (m[p.id] = p));
    return m;
  }, [configQuery.data]);

  const active: ActiveSelection | null = configQuery.data?.active ?? null;
  const activeProvider: any | null = active ? providersById[active.provider_id] ?? null : null;
  const activeModel: ModelInfo | null =
    activeProvider && active
      ? activeProvider.models.find((m: ModelInfo) => m.id === active.model_id) ?? null
      : null;

  const newChat = async () => {
    if (!active) {
      toast.warning("请先在「系统设置 → AI 模型配置」中配置 API Key 并选择模型");
      return;
    }
    const defaults = configQuery.data?.default_params;
    try {
      const conv = await createConversation({
        provider_id: active.provider_id,
        model_id: active.model_id,
        temperature: defaults?.temperature ?? undefined,
        max_tokens: defaults?.max_tokens ?? undefined,
        top_p: defaults?.top_p ?? undefined,
      });
      setSelectedId(conv.id);
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    if (!selectedId) {
      await newChat();
      return;
    }
    if (!active) {
      toast.warning("请先在「系统设置 → AI 模型配置」中配置 API Key 并选择模型");
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

  const handleRename = async () => {
    if (!selectedConv || !renameValue.trim()) return;
    try {
      await updateConversation(selectedConv.id, { title: renameValue.trim() });
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["ai-conversation", selectedConv.id] });
      toast.success("已重命名");
      setRenameOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleTogglePin = async (c: ConversationSummary) => {
    try {
      await updateConversation(c.id, { is_pinned: !c.is_pinned });
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleToggleArchive = async (c: ConversationSummary) => {
    try {
      await updateConversation(c.id, { is_archived: !c.is_archived });
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
      if (c.id === selectedId) setSelectedId(null);
      toast.success(c.is_archived ? "已取消归档" : "已归档");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleExport = async (convId: string, format: "md" | "json") => {
    setExportOpenFor(null);
    try {
      await exportConversation(convId, format);
      toast.success(`已导出为 ${format.toUpperCase()}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleRegenerate = async () => {
    if (!selectedId || streaming) return;
    // Find the last user message in the local messages.
    const lastUserIdx = (() => {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "user") return i;
      }
      return -1;
    })();
    if (lastUserIdx < 0) {
      toast.warning("没有可重新生成的用户消息");
      return;
    }
    const lastUserText = messages[lastUserIdx].content;
    // Drop any assistant messages after that user turn (including the empty pending one if present).
    setMessages((cur) => cur.slice(0, lastUserIdx + 1));
    const assistantId = "tmp-a-" + Date.now();
    setMessages((cur) => [
      ...cur,
      { id: assistantId, role: "assistant", content: "", pending: true },
    ]);
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await streamChat(
        selectedId,
        lastUserText,
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

  const selectedConv = (conversationsQuery.data ?? []).find((c) => c.id === selectedId) ?? null;

  return (
    <div className="apple-fade-in apple-chat-layout" style={{ height: "calc(100vh - 104px)", display: "flex", gap: 16 }}>
      {/* Conversations sidebar */}
      <Card
        className="apple-card apple-chat-sidebar"
        style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", borderRadius: 16 }}
        styles={{ body: { padding: 0, flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" } }}
        title={
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.01em" }}>
              {showArchived ? "已归档" : "对话列表"}
            </span>
            <Space size={4}>
              <Tooltip title={showArchived ? "查看活跃对话" : "查看已归档"}>
                <Button
                  size="small"
                  type="text"
                  icon={showArchived ? <ArchiveRestore size={14} strokeWidth={1.8} /> : <Archive size={14} strokeWidth={1.8} />}
                  onClick={() => setShowArchived((v) => !v)}
                  style={{ width: 28, height: 28, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                />
              </Tooltip>
              <Tooltip title="新建对话">
                <Button
                  size="small"
                  type="primary"
                  icon={<Plus size={14} strokeWidth={2.4} />}
                  onClick={newChat}
                  style={{ width: 28, height: 28, padding: 0, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}
                />
              </Tooltip>
            </Space>
          </div>
        }
      >
        {/* Search input */}
        <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
          <Input
            allowClear
            size="small"
            prefix={<Search size={13} strokeWidth={1.8} style={{ color: "#86868b" }} />}
            placeholder="搜索全部对话"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ borderRadius: 8 }}
          />
        </div>
        <div className="apple-scroll" style={{ flex: 1, overflow: "auto" }}>
          {trimmedSearch ? (
            // ===== Search results view =====
            searchQuery.isLoading ? (
              <div style={{ padding: 12 }}>
                <Skeleton active />
              </div>
            ) : (searchQuery.data ?? []).length === 0 ? (
              <Empty
                description={`没有找到包含「${trimmedSearch}」的对话`}
                style={{ marginTop: 48 }}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <>
                <div
                  style={{
                    padding: "8px 14px",
                    fontSize: 11,
                    color: "#86868b",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  {(searchQuery.data ?? []).length} 条结果
                </div>
                {(searchQuery.data ?? []).map((hit, idx) => (
                  <SearchHitRow
                    key={`${hit.conversation_id}-${hit.message_id || "title"}-${idx}`}
                    hit={hit}
                    onSelect={() => {
                      setSelectedId(hit.conversation_id);
                      setSearch("");
                    }}
                  />
                ))}
              </>
            )
          ) : conversationsQuery.isLoading ? (
            <div style={{ padding: 12 }}>
              <Skeleton active />
            </div>
          ) : (conversationsQuery.data ?? []).length === 0 ? (
            <Empty description="暂无对话" style={{ marginTop: 48 }} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            (conversationsQuery.data ?? []).map((c) => (
              <div
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                style={{
                  cursor: "pointer",
                  padding: "10px 14px",
                  borderBottom: "1px solid rgba(0,0,0,0.04)",
                  background: c.id === selectedId ? "rgba(0,113,227,0.06)" : "transparent",
                  borderLeft:
                    c.id === selectedId
                      ? "3px solid #0071e3"
                      : "3px solid transparent",
                  transition: "background 0.15s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  if (c.id !== selectedId) e.currentTarget.style.background = "rgba(0,0,0,0.02)";
                }}
                onMouseLeave={(e) => {
                  if (c.id !== selectedId) e.currentTarget.style.background = "transparent";
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {c.is_pinned ? (
                      <Pin size={12} strokeWidth={2} fill="#fadb14" color="#fadb14" style={{ flexShrink: 0 }} />
                    ) : (
                      <Bot size={14} strokeWidth={1.8} style={{ color: "#0071e3", flexShrink: 0 }} />
                    )}
                    <Text
                      ellipsis
                      style={{
                        fontSize: 13,
                        fontWeight: c.id === selectedId ? 600 : 500,
                        color: "#1d1d1f",
                      }}
                    >
                      {c.title}
                    </Text>
                    {c.is_archived && (
                      <Tag color="default" style={{ margin: 0, borderRadius: 6, fontSize: 10, padding: "0 4px" }}>
                        归档
                      </Tag>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "#86868b", marginTop: 3, marginLeft: 20 }}>
                    {(providersById[c.provider_id]?.name ?? c.provider_id)} · {c.model_id}
                    <br />
                    {c.message_count} 条消息 · {dayjs(c.updated_at).format("MM-DD HH:mm")}
                  </div>
                </div>
                <Space size={2} onClick={(e) => e.stopPropagation()}>
                  <Tooltip title={c.is_pinned ? "取消置顶" : "置顶"}>
                    <Button
                      type="text"
                      size="small"
                      icon={
                        c.is_pinned ? (
                          <PinOff size={13} strokeWidth={1.8} color="#fadb14" />
                        ) : (
                          <Pin size={13} strokeWidth={1.8} />
                        )
                      }
                      onClick={() => handleTogglePin(c)}
                      style={{ width: 24, height: 24, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                    />
                  </Tooltip>
                  <Tooltip title="导出对话">
                    <Dropdown
                      menu={{
                        items: [
                          {
                            key: "md",
                            label: "导出为 Markdown (.md)",
                            onClick: () => handleExport(c.id, "md"),
                          },
                          {
                            key: "json",
                            label: "导出为 JSON (.json)",
                            onClick: () => handleExport(c.id, "json"),
                          },
                        ],
                      }}
                      trigger={["click"]}
                      open={exportOpenFor === c.id}
                      onOpenChange={(o) => setExportOpenFor(o ? c.id : null)}
                    >
                      <Button
                        type="text"
                        size="small"
                        icon={<Download size={13} strokeWidth={1.8} />}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: 24, height: 24, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                      />
                    </Dropdown>
                  </Tooltip>
                  <Tooltip title={c.is_archived ? "取消归档" : "归档"}>
                    <Button
                      type="text"
                      size="small"
                      icon={
                        c.is_archived ? (
                          <ArchiveRestore size={13} strokeWidth={1.8} />
                        ) : (
                          <Archive size={13} strokeWidth={1.8} />
                        )
                      }
                      onClick={() => handleToggleArchive(c)}
                      style={{ width: 24, height: 24, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                    />
                  </Tooltip>
                  <PopconfirmWrapper
                    onConfirm={async () => {
                      try {
                        await deleteConversation(c.id);
                        if (c.id === selectedId) setSelectedId(null);
                        queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
                      } catch (err) {
                        toast.error((err as Error).message);
                      }
                    }}
                  />
                </Space>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Main chat area */}
      <Card
        className="apple-card apple-chat-main"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          borderRadius: 16,
          overflow: "hidden",
        }}
        styles={{ body: { padding: 0, height: "100%", display: "flex", flexDirection: "column" } }}
        title={
          <div style={{ display: "flex", alignItems: "center", justifyContent: "justify-between", width: "100%" }}>
            <Space align="center" style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #0071e3 0%, #42a1ec 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Bot size={16} color="#fff" strokeWidth={2} />
              </div>
              <Text
                ellipsis
                style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", maxWidth: 280 }}
                title={selectedConv?.title || "AI 会话"}
              >
                {selectedConv?.title || "AI 会话"}
              </Text>
              {selectedConv && (
                <Tooltip title="重命名">
                  <Button
                    type="text"
                    size="small"
                    icon={<Edit3 size={13} strokeWidth={1.8} />}
                    onClick={() => {
                      setRenameValue(selectedConv.title);
                      setRenameOpen(true);
                    }}
                    style={{ width: 26, height: 26, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                  />
                </Tooltip>
              )}
              {activeProvider && activeModel && (
                <Tag color={REGION_COLOR[activeProvider.region]} style={{ borderRadius: 6 }}>
                  {REGION_LABEL[activeProvider.region]}
                </Tag>
              )}
              {activeModel && (
                <Tag color="blue" style={{ borderRadius: 6 }}>{activeModel.name}</Tag>
              )}
            </Space>
            {selectedConv && !streaming && (
              <Tooltip title="重新生成最近一条助手回复">
                <Button
                  size="small"
                  icon={<RotateCcw size={13} strokeWidth={1.8} />}
                  onClick={handleRegenerate}
                  style={{ borderRadius: 8 }}
                >
                  重新生成
                </Button>
              </Tooltip>
            )}
          </div>
        }
      >
        {/* Messages */}
        <div
          className="apple-scroll"
          style={{
            flex: 1,
            overflow: "auto",
            padding: 20,
            background: "#fbfbfd",
          }}
        >
          {messages.length === 0 && active && (
            <Empty
              description="开始与 AI 对话吧"
              style={{ marginTop: 80 }}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
          {messages.length === 0 && !active && configQuery.data && (
            <div className="apple-scroll" style={{ overflow: "auto" }}>
              <AIOnboarding
                providers={configQuery.data.providers}
                configuredProviderIds={(configQuery.data.provider_configs ?? [])
                  .filter((c) => c.api_key_set)
                  .map((c) => c.provider_id)}
                activeProviderId={configQuery.data.active?.provider_id}
              />
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div
          style={{
            padding: 12,
            borderTop: "1px solid rgba(0,0,0,0.04)",
            background: "#fff",
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
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
              style={{ borderRadius: 12, fontSize: 14 }}
            />
            {streaming ? (
              <Button
                danger
                icon={<Square size={15} strokeWidth={2} fill="currentColor" />}
                onClick={stop}
                style={{ borderRadius: 12, height: 40, minWidth: 80 }}
              >
                停止
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<Send size={16} strokeWidth={2} />}
                onClick={send}
                disabled={!input.trim() || !selectedId}
                style={{ borderRadius: 12, height: 40, minWidth: 80 }}
              >
                发送
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Rename conversation modal */}
      <Modal
        open={renameOpen}
        title="重命名对话"
        okText="保存"
        cancelText="取消"
        onCancel={() => setRenameOpen(false)}
        onOk={handleRename}
        destroyOnClose
      >
        <Input
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onPressEnter={handleRename}
          placeholder="新标题"
          maxLength={200}
          style={{ height: 40 }}
        />
      </Modal>
    </div>
  );
}

// Inline delete confirm (kept local to avoid a Popconfirm import shuffle).
function PopconfirmWrapper({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const { modal } = App.useApp();
  return (
    <Button
      type="text"
      size="small"
      danger
      icon={<Trash2 size={13} strokeWidth={1.8} />}
      onClick={(e) => {
        e.stopPropagation();
        modal.confirm({
          title: "删除此对话？",
          okText: "删除",
          cancelText: "取消",
          onOk: onConfirm,
        });
      }}
      style={{ width: 24, height: 24, padding: 0, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
    />
  );
}

// ============================================================
// Search hit row (rendered when the user types in the sidebar search box)
// ============================================================
function SearchHitRow({ hit, onSelect }: { hit: SearchHit; onSelect: () => void }) {
  const roleTag =
    hit.role === "user" ? "blue" :
    hit.role === "assistant" ? "green" :
    hit.role === "title" ? "gold" : "default";
  const roleLabel =
    hit.role === "user" ? "我" :
    hit.role === "assistant" ? "AI" :
    hit.role === "title" ? "标题" : hit.role;

  // Convert the >>...<< highlight markers from the backend into <mark> tags.
  const rendered = renderHighlight(hit.snippet);

  return (
    <div
      onClick={onSelect}
      style={{
        cursor: "pointer",
        padding: "10px 14px",
        borderBottom: "1px solid rgba(0,0,0,0.04)",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(0,113,227,0.04)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Tag color={roleTag} style={{ margin: 0, borderRadius: 6, fontSize: 10, padding: "0 4px" }}>
          {roleLabel}
        </Tag>
        <Text ellipsis style={{ fontSize: 13, fontWeight: 600, color: "#1d1d1f" }}>
          {hit.conversation_title || "(无标题)"}
        </Text>
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#86868b",
          lineHeight: 1.55,
          wordBreak: "break-word",
        }}
        // Backend escapes HTML in the snippet and uses >>...<< for the highlight.
        dangerouslySetInnerHTML={{ __html: rendered }}
      />
      <div style={{ fontSize: 10, color: "#aeaeb2", marginTop: 4 }}>
        {dayjs(hit.created_at).format("YYYY-MM-DD HH:mm")}
      </div>
    </div>
  );
}

function renderHighlight(snippet: string): string {
  // Escape HTML, then turn >>...<< into <mark>...</mark>.
  const esc = snippet
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc.replace(/>>([\s\S]+?)&lt;&lt;/g, (_m, inner) => `<mark style="background:rgba(0,113,227,0.18);padding:0 2px;border-radius:2px;">${inner}</mark>`);
}

// ============================================================
// Message bubble
// ============================================================
function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    if (!msg.content) return;
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        marginBottom: 20,
        flexDirection: isUser ? "row-reverse" : "row",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: isUser
            ? "linear-gradient(135deg, #0071e3 0%, #42a1ec 100%)"
            : "linear-gradient(135deg, #34c759 0%, #30d158 100%)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        {isUser ? (
          <User size={16} color="#fff" strokeWidth={2} />
        ) : (
          <Bot size={16} color="#fff" strokeWidth={2} />
        )}
      </div>

      {/* Bubble */}
      <div
        className="apple-msg-bubble"
        style={{
          maxWidth: "70%",
          background: isUser ? "#0071e3" : "#fff",
          color: isUser ? "#fff" : "#1d1d1f",
          padding: "12px 16px",
          borderRadius: 18,
          borderBottomRightRadius: isUser ? 4 : 18,
          borderBottomLeftRadius: isUser ? 18 : 4,
          border: !isUser ? "1px solid rgba(0,0,0,0.06)" : undefined,
          boxShadow: isUser ? "none" : "0 1px 3px rgba(0,0,0,0.04)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          lineHeight: 1.7,
          fontSize: 14,
          position: "relative",
        }}
      >
        {msg.pending && !msg.content ? (
          <span style={{ opacity: 0.6 }}>
            <Spin size="small" /> 思考中...
          </span>
        ) : msg.error ? (
          <span style={{ color: "#ff3b30" }}>{msg.error}</span>
        ) : (
          msg.content
        )}
        {msg.pending && msg.content && (
          <span style={{ opacity: 0.5, marginLeft: 4 }}>▍</span>
        )}
        {/* Copy button (only when bubble has content and not pending) */}
        {!msg.pending && msg.content && !msg.error && (
          <button
            onClick={handleCopy}
            aria-label="复制消息"
            className="msg-copy-btn"
            style={{
              position: "absolute",
              bottom: -10,
              right: isUser ? "auto" : 8,
              left: isUser ? 8 : "auto",
              width: 26,
              height: 26,
              borderRadius: 13,
              border: "1px solid rgba(0,0,0,0.08)",
              background: copied ? "#34c759" : "#fff",
              color: copied ? "#fff" : "#86868b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              opacity: 0,
              transition: "opacity 0.2s, background 0.2s, color 0.2s",
              padding: 0,
              boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
            }}
          >
            {copied ? <Check size={13} strokeWidth={2.4} /> : <Copy size={13} strokeWidth={1.8} />}
          </button>
        )}
      </div>
    </div>
  );
}
