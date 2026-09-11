import { App } from "antd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ConversationSummary,
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  searchConversations,
  streamChat,
  updateConversation,
} from "../api/client";
import { AIOnboarding } from "../components/AIOnboarding";
import { ChatPanel, ChatItem, ConversationList } from "../components";

export function AIChatPage() {
  const queryClient = useQueryClient();
  const { message: toast } = App.useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const conversationsQuery = useQuery<ConversationSummary[]>({
    queryKey: ["ai-conversations", search],
    queryFn: () => (search ? searchConversations(search).then(() => [] as ConversationSummary[]) : listConversations()),
    refetchInterval: 30_000,
  });

  const messagesQuery = useQuery({
    queryKey: ["ai-conversation", selectedId],
    queryFn: () => (selectedId ? getConversation(selectedId) : null),
    enabled: !!selectedId,
  });

  const [liveMessages, setLiveMessages] = useState<ChatItem[]>([]);

  useEffect(() => {
    setLiveMessages([]);
  }, [selectedId]);

  const displayMessages: ChatItem[] = useMemo(() => {
    if (messagesQuery.data?.messages && liveMessages.length === 0) {
      return messagesQuery.data.messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      }));
    }
    return liveMessages;
  }, [messagesQuery.data, liveMessages]);

  const conversations: ConversationSummary[] = conversationsQuery.data ?? [];

  const handleNew = async () => {
    try {
      const conv = await createConversation();
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
      setSelectedId(conv.id);
      toast.success("新会话已创建");
    } catch (err) {
      toast.error("创建失败：" + (err as Error).message);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || streaming) return;
    const text = input.trim();
    setInput("");

    let convId = selectedId;
    if (!convId) {
      try {
        const conv = await createConversation();
        convId = conv.id;
        setSelectedId(conv.id);
      } catch (err) {
        toast.error("创建会话失败：" + (err as Error).message);
        return;
      }
    }

    const userMsg: ChatItem = { id: `tmp-${Date.now()}-u`, role: "user", content: text };
    const assistantId = `tmp-${Date.now()}-a`;
    setLiveMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const stream = streamChat(convId, text, ctrl.signal);
      let acc = "";
      for await (const chunk of stream) {
        acc += chunk;
        setLiveMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m)));
      }
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // User-initiated stop; leave partial content visible.
      } else {
        toast.error("发送失败：" + (err as Error).message);
        setLiveMessages((prev) => prev.filter((m) => m.id !== assistantId));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      queryClient.invalidateQueries({ queryKey: ["ai-conversation", convId] });
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  const handlePin = async (id: string, pinned: boolean) => {
    try {
      await updateConversation(id, { is_pinned: pinned });
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    } catch (err) {
      toast.error("操作失败：" + (err as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteConversation(id);
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
      if (selectedId === id) setSelectedId(null);
      toast.success("已删除");
    } catch (err) {
      toast.error("删除失败：" + (err as Error).message);
    }
  };

  return (
    <div style={{ display: "flex", gap: 12, height: "calc(100vh - 120px)" }}>
      <ConversationList
        conversations={conversations}
        selectedId={selectedId}
        loading={conversationsQuery.isLoading}
        searchQuery={search}
        onSearchChange={setSearch}
        onSelect={setSelectedId}
        onNew={handleNew}
        onPin={handlePin}
        onDelete={handleDelete}
      />
      <ChatPanel
        messages={displayMessages}
        input={input}
        onInputChange={setInput}
        onSend={handleSend}
        onStop={handleStop}
        disabled={false}
        streaming={streaming}
        emptyHint="开始一段新的对话"
      />
      <AIOnboarding />
    </div>
  );
}