# ArkNexus 前端液态玻璃重构 — 实施计划 3：邮件 / AI / 设置 / 个人

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。
>
> **前置条件：** 计划 1（基础设施）+ 计划 2（登录/初始化/概览）已完成并验证 commit。`tokens`、`ThemeProvider`、`AuroraBackground`、`GlassCard/Panel/Button`、`FadeIn` 均已就位。

**目标：** 重构剩余 4 个 App（Email / AI Chat / Settings / Profile）至液态玻璃设计系统。**Email 页保留其内部组件（FoldersPanel/MessageList/MessageView/DraftDrawer/TopBar）的功能逻辑**，仅替换外层容器与 TopBar 为玻璃样式；AI / Settings / Profile 重写为新设计。

**架构：** Email 页是最复杂的（3 栏 + 抽屉），仅做最小侵入式改造（外层包装 + TopBar 玻璃化）；其余 3 页保留 `FadeIn` + `GlassCard` 模式重构。`useAuth`、`useTheme`、`lucide-react`、`framer-motion` 复用。

**技术栈：** React 18 + TypeScript + Ant Design 5 + framer-motion 13 + lucide-react + dayjs（沿用计划 1、2 基础）

---

## 现有代码上下文

实施前需熟悉的文件：

- `frontend/src/apps/email/pages/EmailInboxPage.tsx` — 主容器，组合 MailboxSidebar + FoldersPanel + MessageList + MessageView + DraftDrawer + TopBar
- `frontend/src/apps/email/components/TopBar.tsx` — Email 页顶部工具栏（搜索、刷新、新建邮件等）
- `frontend/src/apps/email/EmailApp.tsx` — 极简 `<Outlet />`，无需改动
- `frontend/src/apps/email/components/{FoldersPanel,MessageList,MessageView,DraftDrawer,MailboxSidebar}.tsx` — 内部组件，**功能保留**
- `frontend/src/apps/ai/pages/AIChatPage.tsx` — 单文件实现会话列表 + 对话区
- `frontend/src/apps/ai/api/client.ts` — 已存在 API
- `frontend/src/apps/ai/components/AIOnboarding.tsx` — 已存在引导弹窗
- `frontend/src/apps/settings/pages/SettingsPage.tsx` — 左侧 Menu + 右侧模块
- `frontend/src/apps/settings/modules/{AIModelSettings,EmailSettingsModule,ServicesModule,DataSovereigntyModule}.tsx` — 4 个设置模块，保留
- `frontend/src/apps/profile/ProfilePage.tsx` — 单文件实现
- `frontend/src/lib/api.ts` — 已存在 `fetchMe` / `listOAuthAccounts` / `unlinkOAuthAccount`

---

## 文件结构（变更）

**新增：**

- `frontend/src/apps/ai/components/ConversationList.tsx` — AI 会话列表（左栏 260px）
- `frontend/src/apps/ai/components/ChatPanel.tsx` — AI 对话区（右栏 flex）
- `frontend/src/apps/ai/components/MessageBubble.tsx` — 单条消息气泡（user/assistant）
- `frontend/src/apps/ai/components/ChatInput.tsx` — 底部输入框
- `frontend/src/apps/ai/components/index.ts`
- `frontend/src/apps/settings/components/SettingsSidebar.tsx` — 设置模块导航
- `frontend/src/apps/profile/components/ProfileHeader.tsx` — 顶部头像 + 用户名 + 徽章
- `frontend/src/apps/profile/components/InfoCard.tsx` — 描述列表卡
- `frontend/src/apps/profile/components/SecurityCard.tsx` — 安全 / 改密 / 2FA
- `frontend/src/apps/profile/components/OAuthAccountsCard.tsx` — OAuth 关联卡
- `frontend/src/apps/profile/components/index.ts`

**修改：**

- `frontend/src/apps/email/pages/EmailInboxPage.tsx` — 外层包裹 glass 容器、TopBar 改造
- `frontend/src/apps/email/components/TopBar.tsx` — 玻璃化样式
- `frontend/src/apps/ai/pages/AIChatPage.tsx` — 简化为装配 ConversationList + ChatPanel
- `frontend/src/apps/settings/pages/SettingsPage.tsx` — 简化为装配 SettingsSidebar + Module 内容
- `frontend/src/apps/profile/ProfilePage.tsx` — 简化为装配 ProfileHeader + tab + 3 个卡

---

## 任务清单

### 任务 1：Email TopBar 玻璃化

**文件：**
- 修改：`frontend/src/apps/email/components/TopBar.tsx`

- [ ] **步骤 1：读取当前 TopBar.tsx**

```bash
wc -l frontend/src/apps/email/components/TopBar.tsx
```

- [ ] **步骤 2：在 TopBar 根容器添加 glass 类**

打开 `frontend/src/apps/email/components/TopBar.tsx`，找到根 `<div>` / `<Space>` / `<div>` wrapper，添加 `className="glass"` 与调整样式：

```tsx
// 假设根容器是 <div style={{ ... }}>
<div
  className="glass"
  style={{
    padding: "12px 16px",
    borderRadius: 14,
    margin: "0 0 16px 0",
    ...existingInlineStyles,
  }}
>
  {/* 保留所有 children */}
</div>
```

如果根容器已经是 antd `Space` 等，改为：

```tsx
<div className="glass" style={{ borderRadius: 14, padding: "12px 16px", marginBottom: 16 }}>
  {/* 原 Space 内容 */}
</div>
```

具体做法：将根 `<div>` 或 `<Space>` **外层**包裹一个 `<div className="glass" style={...}>`，或直接给现有根容器加 `className="glass"`。

- [ ] **步骤 3：构建验证**

```bash
cd frontend && npx tsc -b --noEmit
```

预期：0 错误。

- [ ] **步骤 4：手动验证**

```bash
cd frontend && npx vite dev
```

访问 /email，验证 TopBar 区域玻璃叠加 + 圆角正常显示。

- [ ] **步骤 5：Commit**

```bash
git add frontend/src/apps/email/components/TopBar.tsx
git commit -m "refactor(email): apply glass styling to Email TopBar"
```

---

### 任务 2：EmailInboxPage 外层玻璃容器

**文件：**
- 修改：`frontend/src/apps/email/pages/EmailInboxPage.tsx`

- [ ] **步骤 1：定位根 return**

打开 `frontend/src/apps/email/pages/EmailInboxPage.tsx`，找到 `return (` 后的最外层 JSX（通常是 `<div>` 或 `<Space direction="horizontal">`）。

- [ ] **步骤 2：添加外层 glass 包装**

将根容器改为：

```tsx
<div className="glass" style={{ padding: 12, borderRadius: 18, minHeight: "calc(100vh - 120px)" }}>
  {/* 原根容器 JSX */}
</div>
```

例如原代码是：

```tsx
return (
  <div style={{ display: "flex", gap: 12 }}>
    <MailboxSidebar ... />
    <FoldersPanel ... />
    ...
  </div>
);
```

改为：

```tsx
return (
  <div className="glass" style={{ padding: 12, borderRadius: 18, minHeight: "calc(100vh - 120px)" }}>
    <div style={{ display: "flex", gap: 12 }}>
      <MailboxSidebar ... />
      <FoldersPanel ... />
      ...
    </div>
  </div>
);
```

- [ ] **步骤 3：构建验证**

```bash
cd frontend && npx vite build
```

预期：构建成功。

- [ ] **步骤 4：手动验证**

访问 /email，确认：
- 外层玻璃卡圆角 18px + 模糊叠加
- 内部 3 栏布局无破坏
- 切邮件时仍正常

- [ ] **步骤 5：Commit**

```bash
git add frontend/src/apps/email/pages/EmailInboxPage.tsx
git commit -m "refactor(email): wrap EmailInboxPage in glass container"
```

---

### 任务 3：AI Chat 子组件

**文件：**
- 创建：`frontend/src/apps/ai/components/ConversationList.tsx`
- 创建：`frontend/src/apps/ai/components/MessageBubble.tsx`
- 创建：`frontend/src/apps/ai/components/ChatInput.tsx`
- 创建：`frontend/src/apps/ai/components/ChatPanel.tsx`
- 创建：`frontend/src/apps/ai/components/index.ts`

- [ ] **步骤 1：创建 ConversationList.tsx**

```tsx
// frontend/src/apps/ai/components/ConversationList.tsx
import { Button, Input, Typography } from "antd";
import { Plus, Search, Pin, PinOff, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import dayjs from "dayjs";
import type { ConversationSummary } from "../api/client";

const { Text } = Typography;

interface Props {
  conversations: ConversationSummary[];
  selectedId: string | null;
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onPin: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
}

export function ConversationList({
  conversations,
  selectedId,
  loading,
  searchQuery,
  onSearchChange,
  onSelect,
  onNew,
  onPin,
  onDelete,
}: Props) {
  const sorted = [...conversations].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return (
    <div className="glass" style={{ width: 260, padding: 12, borderRadius: 16, display: "flex", flexDirection: "column", gap: 12, flexShrink: 0 }}>
      <Button type="primary" icon={<Plus size={15} strokeWidth={2} />} block onClick={onNew} style={{ borderRadius: 999 }}>
        新建会话
      </Button>
      <Input
        prefix={<Search size={14} strokeWidth={1.8} />}
        placeholder="搜索会话…"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        allowClear
        size="middle"
      />
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, paddingRight: 4 }}>
        {loading ? (
          <Text type="secondary" style={{ padding: 16, textAlign: "center" }}>加载中...</Text>
        ) : sorted.length === 0 ? (
          <Text type="secondary" style={{ padding: 16, textAlign: "center" }}>暂无会话</Text>
        ) : (
          sorted.map((c, idx) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.03 }}
            >
              <ConversationItem
                conv={c}
                active={c.id === selectedId}
                onSelect={() => onSelect(c.id)}
                onPin={() => onPin(c.id, !c.pinned)}
                onDelete={() => onDelete(c.id)}
              />
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

function ConversationItem({
  conv,
  active,
  onSelect,
  onPin,
  onDelete,
}: {
  conv: ConversationSummary;
  active: boolean;
  onSelect: () => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      whileHover={{ x: 2 }}
      onClick={onSelect}
      className={active ? "glass-tinted" : ""}
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        background: active ? undefined : "transparent",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {conv.pinned && <Pin size={12} strokeWidth={2} />}
        <span style={{ fontWeight: 600, fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {conv.title || "新会话"}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onPin(); }}
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, color: "inherit", display: "flex" }}
          aria-label={conv.pinned ? "取消置顶" : "置顶"}
        >
          {conv.pinned ? <PinOff size={12} /> : <Pin size={12} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, color: "inherit", display: "flex" }}
          aria-label="删除"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <span style={{ fontSize: 11, color: "var(--ant-color-text-tertiary, #86868b)" }}>
        {dayjs(conv.updated_at).format("MM-DD HH:mm")}
      </span>
    </motion.div>
  );
}
```

- [ ] **步骤 2：创建 MessageBubble.tsx**

```tsx
// frontend/src/apps/ai/components/MessageBubble.tsx
import { motion } from "framer-motion";
import { Bot, User } from "lucide-react";

interface Props {
  role: "user" | "assistant" | "system";
  content: string;
  streaming?: boolean;
}

export function MessageBubble({ role, content, streaming }: Props) {
  if (role === "system") {
    return (
      <div style={{ textAlign: "center", padding: "8px 0", fontSize: 12, color: "var(--ant-color-text-tertiary, #86868b)" }}>
        {content}
      </div>
    );
  }
  const isUser = role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        display: "flex",
        gap: 10,
        flexDirection: isUser ? "row-reverse" : "row",
        alignItems: "flex-start",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: isUser
            ? "linear-gradient(135deg, #007AFF, #5856D6)"
            : "linear-gradient(135deg, #34C759, #30D158)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {isUser ? <User size={16} color="#fff" strokeWidth={2} /> : <Bot size={16} color="#fff" strokeWidth={2} />}
      </div>
      <div
        className={isUser ? "glass-tinted" : "glass"}
        style={{
          padding: "10px 14px",
          borderRadius: 16,
          maxWidth: "70%",
          fontSize: 14,
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {content}
        {streaming && <TypingDots />}
      </div>
    </motion.div>
  );
}

function TypingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 3, marginLeft: 4 }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
          style={{ display: "inline-block", width: 4, height: 4, borderRadius: "50%", background: "currentColor" }}
        />
      ))}
    </span>
  );
}
```

- [ ] **步骤 3：创建 ChatInput.tsx**

```tsx
// frontend/src/apps/ai/components/ChatInput.tsx
import { Button, Input } from "antd";
import { Send, Square } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop?: () => void;
  disabled?: boolean;
  streaming?: boolean;
  placeholder?: string;
}

export function ChatInput({ value, onChange, onSend, onStop, disabled, streaming, placeholder }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = Math.min(ref.current.scrollHeight, 160) + "px";
    }
  }, [value]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSend();
    }
  };

  return (
    <div className="glass" style={{ padding: 10, borderRadius: 16, display: "flex", gap: 8, alignItems: "flex-end" }}>
      <Input.TextArea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder || "输入消息，回车发送，Shift+回车换行"}
        autoSize={{ minRows: 1, maxRows: 6 }}
        disabled={disabled}
        style={{ resize: "none", border: "none", boxShadow: "none", background: "transparent" }}
      />
      {streaming ? (
        <Button danger icon={<Square size={14} />} onClick={onStop} style={{ borderRadius: 999 }}>停止</Button>
      ) : (
        <motion.div whileTap={{ scale: 0.94 }}>
          <Button
            type="primary"
            icon={<Send size={14} />}
            onClick={onSend}
            disabled={disabled || !value.trim()}
            style={{ borderRadius: 999 }}
          >
            发送
          </Button>
        </motion.div>
      )}
    </div>
  );
}
```

- [ ] **步骤 4：创建 ChatPanel.tsx**

```tsx
// frontend/src/apps/ai/components/ChatPanel.tsx
import { Empty } from "antd";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";

export interface ChatItem {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

interface Props {
  messages: ChatItem[];
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onStop?: () => void;
  disabled?: boolean;
  streaming?: boolean;
  emptyHint?: string;
}

export function ChatPanel({ messages, input, onInputChange, onSend, onStop, disabled, streaming, emptyHint }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="glass" style={{ flex: 1, padding: 16, borderRadius: 16, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
        {messages.length === 0 ? (
          <Empty description={emptyHint || "开始一段新的对话"} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 60 }} />
        ) : (
          <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}>
            {messages.map((m) => (
              <MessageBubble key={m.id} role={m.role} content={m.content} streaming={streaming && m === messages[messages.length - 1] && m.role === "assistant"} />
            ))}
          </motion.div>
        )}
      </div>
      <div style={{ marginTop: 12 }}>
        <ChatInput
          value={input}
          onChange={onInputChange}
          onSend={onSend}
          onStop={onStop}
          disabled={disabled}
          streaming={streaming}
        />
      </div>
    </div>
  );
}
```

- [ ] **步骤 5：创建 index.ts**

```ts
// frontend/src/apps/ai/components/index.ts
export { ConversationList } from "./ConversationList";
export { MessageBubble } from "./MessageBubble";
export { ChatInput } from "./ChatInput";
export { ChatPanel, type ChatItem } from "./ChatPanel";
```

- [ ] **步骤 6：构建验证**

```bash
cd frontend && npx tsc -b --noEmit
```

预期：0 错误。**注意：** `ConversationSummary` 类型需要从 `../api/client` 导出；如果没有导出，从原 `AIChatPage.tsx` 查看类型定义并补齐 export。

- [ ] **步骤 7：Commit**

```bash
git add frontend/src/apps/ai/components/
git commit -m "feat(ai): extract ConversationList, MessageBubble, ChatInput, ChatPanel"
```

---

### 任务 4：重写 AIChatPage

**文件：**
- 修改：`frontend/src/apps/ai/pages/AIChatPage.tsx`

- [ ] **步骤 1：读取现有 API 签名**

```bash
cd frontend && head -30 src/apps/ai/api/client.ts
```

确认 `streamChat`、`listConversations`、`createConversation`、`getConversation`、`searchConversations`、`deleteConversation`、`updateConversation` 的签名。

- [ ] **步骤 2：完全重写 AIChatPage.tsx**

用以下代码**完全替换**现有文件：

```tsx
import { App } from "antd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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

  const conversationsQuery = useQuery({
    queryKey: ["ai-conversations", search],
    queryFn: () => (search ? searchConversations(search) : listConversations()),
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

    try {
      const stream = streamChat(convId, text);
      let acc = "";
      for await (const chunk of stream) {
        acc += chunk;
        setLiveMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m)));
      }
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    } catch (err) {
      toast.error("发送失败：" + (err as Error).message);
      setLiveMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setStreaming(false);
      queryClient.invalidateQueries({ queryKey: ["ai-conversation", convId] });
    }
  };

  const handleStop = () => {
    setStreaming(false);
  };

  const handlePin = async (id: string, pinned: boolean) => {
    try {
      await updateConversation(id, { pinned });
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
```

- [ ] **步骤 3：构建验证**

```bash
cd frontend && npx tsc -b --noEmit
```

预期：0 错误。如果 `streamChat` 返回类型与 `for await` 不匹配，按类型注释或转换。

- [ ] **步骤 4：手动验证**

```bash
cd frontend && npx vite dev
```

访问 /ai/chat：
- 左侧会话列表玻璃化、置顶 / 删除按钮可见
- 新建会话 → 输入 → 发送：消息从下方滑入
- AI 消息流式输出：内容逐字追加 + typing dots 收尾

- [ ] **步骤 5：Commit**

```bash
git add frontend/src/apps/ai/pages/AIChatPage.tsx
git commit -m "refactor(ai): simplify AIChatPage to compose ConversationList + ChatPanel"
```

---

### 任务 5：Settings 侧边栏组件

**文件：**
- 创建：`frontend/src/apps/settings/components/SettingsSidebar.tsx`

- [ ] **步骤 1：创建 SettingsSidebar.tsx**

```tsx
// frontend/src/apps/settings/components/SettingsSidebar.tsx
import { motion } from "framer-motion";
import { ReactNode } from "react";

export interface SettingsModule {
  key: string;
  label: string;
  icon: ReactNode;
  hint: string;
}

interface Props {
  modules: SettingsModule[];
  active: string;
  onSelect: (key: string) => void;
}

export function SettingsSidebar({ modules, active, onSelect }: Props) {
  return (
    <div
      className="glass"
      style={{
        width: 264,
        flexShrink: 0,
        borderRadius: 16,
        padding: 8,
        position: "sticky",
        top: 80,
      }}
    >
      {modules.map((m, idx) => (
        <motion.div
          key={m.key}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, delay: idx * 0.04 }}
          onClick={() => onSelect(m.key)}
          whileHover={{ x: 2 }}
          className={m.key === active ? "glass-tinted" : ""}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: "10px 12px",
            borderRadius: 10,
            cursor: "pointer",
            marginBottom: 2,
          }}
        >
          <span style={{ color: "var(--ant-color-primary, #007AFF)", flexShrink: 0, marginTop: 2 }}>{m.icon}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{m.label}</div>
            <div style={{ fontSize: 12, color: "var(--ant-color-text-tertiary, #86868b)", marginTop: 2 }}>
              {m.hint}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
```

- [ ] **步骤 2：Commit**

```bash
git add frontend/src/apps/settings/components/SettingsSidebar.tsx
git commit -m "feat(settings): add SettingsSidebar glass component"
```

---

### 任务 6：重写 SettingsPage

**文件：**
- 修改：`frontend/src/apps/settings/pages/SettingsPage.tsx`

- [ ] **步骤 1：完全重写 SettingsPage.tsx**

用以下代码**完全替换**现有文件：

```tsx
import { Space, Typography } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Bot, Mail, Server, Database } from "lucide-react";
import { AIModelSettings } from "../modules/AIModelSettings";
import { EmailSettingsModule } from "../modules/EmailSettingsModule";
import { ServicesModule } from "../modules/ServicesModule";
import { DataSovereigntyModule } from "../modules/DataSovereigntyModule";
import { SettingsSidebar, type SettingsModule } from "../components/SettingsSidebar";
import { FadeIn } from "../../../components/motion/FadeIn";

const { Title, Paragraph } = Typography;

type ModuleKey = "ai" | "email" | "services" | "data";

const MODULES: SettingsModule[] = [
  { key: "ai", label: "AI 模型配置", icon: <Bot size={16} strokeWidth={1.8} />, hint: "服务商 Key、默认模型与生成参数" },
  { key: "email", label: "邮件服务", icon: <Mail size={16} strokeWidth={1.8} />, hint: "域名、SMTP 与留存策略" },
  { key: "services", label: "服务与集成", icon: <Server size={16} strokeWidth={1.8} />, hint: "其余微服务的配置项" },
  { key: "data", label: "数据主权", icon: <Database size={16} strokeWidth={1.8} />, hint: "导出 / 导入你的全部数据" },
];

export function SettingsPage() {
  const [active, setActive] = useState<ModuleKey>("ai");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get("module");
    if (m === "data" || m === "ai" || m === "email" || m === "services") {
      setActive(m);
    }
  }, []);

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <FadeIn variant="slide">
        <div>
          <Title level={3} style={{ marginBottom: 4, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>
            系统设置
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 15 }}>
            按功能模块管理 ArkNexus 的配置。左侧选择一个模块进行设置。
          </Paragraph>
        </div>
      </FadeIn>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <SettingsSidebar modules={MODULES} active={active} onSelect={(k) => setActive(k as ModuleKey)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.3 }}
            >
              <div className="glass" style={{ padding: 24, borderRadius: 18 }}>
                {active === "ai" && <AIModelSettings />}
                {active === "email" && <EmailSettingsModule />}
                {active === "services" && <ServicesModule />}
                {active === "data" && <DataSovereigntyModule />}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Space>
  );
}
```

- [ ] **步骤 2：构建验证**

```bash
cd frontend && npx vite build
```

预期：构建成功。

- [ ] **步骤 3：手动验证**

访问 /settings：
- 左侧玻璃化模块导航入场
- 切换模块：右侧内容从右滑入，旧内容从左滑出
- 设置项表单正常工作

- [ ] **步骤 4：Commit**

```bash
git add frontend/src/apps/settings/pages/SettingsPage.tsx
git commit -m "refactor(settings): compose SettingsSidebar + cross-fade module switcher"
```

---

### 任务 7：Profile 子组件

**文件：**
- 创建：`frontend/src/apps/profile/components/ProfileHeader.tsx`
- 创建：`frontend/src/apps/profile/components/InfoCard.tsx`
- 创建：`frontend/src/apps/profile/components/SecurityCard.tsx`
- 创建：`frontend/src/apps/profile/components/OAuthAccountsCard.tsx`
- 创建：`frontend/src/apps/profile/components/index.ts`

- [ ] **步骤 1：创建 ProfileHeader.tsx**

```tsx
// frontend/src/apps/profile/components/ProfileHeader.tsx
import { Tag, Typography } from "antd";
import { motion } from "framer-motion";
import { Shield } from "lucide-react";

const { Text } = Typography;

interface Props {
  displayName: string;
  email: string;
  role: string;
  isAdmin?: boolean;
}

export function ProfileHeader({ displayName, email, role, isAdmin }: Props) {
  const initial = (displayName || email)[0]?.toUpperCase() ?? "?";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-elevated"
      style={{
        padding: 32,
        borderRadius: 24,
        display: "flex",
        alignItems: "center",
        gap: 24,
      }}
    >
      <motion.div
        whileHover={{ scale: 1.05, rotate: 4 }}
        transition={{ duration: 0.3 }}
        style={{
          width: 88,
          height: 88,
          borderRadius: 24,
          background: "linear-gradient(135deg, #0096FF, #9650FF)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 36,
          fontWeight: 700,
          flexShrink: 0,
          boxShadow: "0 12px 32px rgba(0,150,255,0.30)",
        }}
      >
        {initial}
      </motion.div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Text style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>
            {displayName || email}
          </Text>
          {isAdmin && (
            <Tag icon={<Shield size={11} />} color="blue" style={{ borderRadius: 999, fontSize: 11 }}>
              管理员
            </Tag>
          )}
          <Tag style={{ borderRadius: 999, fontSize: 11 }}>{role || "user"}</Tag>
        </div>
        <Text type="secondary">{email}</Text>
      </div>
    </motion.div>
  );
}
```

- [ ] **步骤 2：创建 InfoCard.tsx**

```tsx
// frontend/src/apps/profile/components/InfoCard.tsx
import { Button, Descriptions, Form, Input, Space, Typography } from "antd";
import { Save } from "lucide-react";
import { motion } from "framer-motion";
import { ReactNode, useState } from "react";

const { Title } = Typography;

interface Props {
  title: string;
  description?: string;
  extra?: ReactNode;
  children: ReactNode;
}

export function InfoCard({ title, description, extra, children }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass"
      style={{ padding: 24, borderRadius: 18 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <Title level={5} style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
            {title}
          </Title>
          {description && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {description}
            </Typography.Text>
          )}
        </div>
        {extra}
      </div>
      {children}
    </motion.div>
  );
}

export function ProfileInfoForm({
  displayName,
  email,
  onSave,
  loading,
}: {
  displayName: string;
  email: string;
  onSave: (displayName: string) => Promise<void>;
  loading?: boolean;
}) {
  const [form] = Form.useForm();
  const [dirty, setDirty] = useState(false);
  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ display_name: displayName }}
      onValuesChange={() => setDirty(true)}
    >
      <Descriptions column={1} size="small" styles={{ label: { width: 100, color: "var(--ant-color-text-tertiary, #86868b)" } }}>
        <Descriptions.Item label="邮箱">{email}</Descriptions.Item>
      </Descriptions>
      <Form.Item
        name="display_name"
        label="显示名"
        style={{ marginTop: 12, marginBottom: 0 }}
      >
        <Input placeholder="昵称" maxLength={32} size="large" />
      </Form.Item>
      <Space style={{ marginTop: 16 }}>
        <Button
          type="primary"
          icon={<Save size={14} />}
          loading={loading}
          disabled={!dirty}
          onClick={async () => {
            const v = await form.validateFields();
            await onSave(v.display_name);
            setDirty(false);
          }}
          style={{ borderRadius: 999 }}
        >
          保存
        </Button>
      </Space>
    </Form>
  );
}
```

- [ ] **步骤 3：创建 SecurityCard.tsx**

```tsx
// frontend/src/apps/profile/components/SecurityCard.tsx
import { Button, Form, Input, Popconfirm, Space, Typography } from "antd";
import { KeyRound, LogOut } from "lucide-react";
import { InfoCard } from "./InfoCard";

const { Text } = Typography;

interface Props {
  onChangePassword: (oldPwd: string, newPwd: string) => Promise<void>;
  onLogoutAll: () => void;
}

export function SecurityCard({ onChangePassword, onLogoutAll }: Props) {
  const [form] = Form.useForm();
  return (
    <InfoCard title="安全" description="修改密码或登出所有设备">
      <Form
        form={form}
        layout="vertical"
        onFinish={async (v) => {
          await onChangePassword(v.old_password, v.new_password);
          form.resetFields();
        }}
      >
        <Form.Item name="old_password" label="当前密码" rules={[{ required: true, message: "请输入当前密码" }]}>
          <Input.Password autoComplete="current-password" size="large" />
        </Form.Item>
        <Form.Item
          name="new_password"
          label="新密码"
          rules={[
            { required: true, message: "请输入新密码" },
            { min: 8, message: "密码至少 8 位" },
          ]}
        >
          <Input.Password autoComplete="new-password" size="large" />
        </Form.Item>
        <Form.Item
          name="confirm"
          label="确认新密码"
          dependencies={["new_password"]}
          rules={[
            { required: true, message: "请确认新密码" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("new_password") === value) return Promise.resolve();
                return Promise.reject(new Error("两次输入不一致"));
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" size="large" />
        </Form.Item>
        <Space>
          <Button type="primary" icon={<KeyRound size={14} />} htmlType="submit" style={{ borderRadius: 999 }}>
            修改密码
          </Button>
          <Popconfirm
            title="登出所有设备？"
            description="你将需要在其他设备上重新登录。"
            okText="确认登出"
            cancelText="取消"
            onConfirm={onLogoutAll}
          >
            <Button danger icon={<LogOut size={14} />} style={{ borderRadius: 999 }}>
              登出所有设备
            </Button>
          </Popconfirm>
        </Space>
      </Form>
    </InfoCard>
  );
}
```

- [ ] **步骤 4：创建 OAuthAccountsCard.tsx**

```tsx
// frontend/src/apps/profile/components/OAuthAccountsCard.tsx
import { Button, Empty, Space, Tag } from "antd";
import { Link2, Unlink } from "lucide-react";
import { InfoCard } from "./InfoCard";
import type { OAuthAccountInfo } from "@/lib/api";

const PROVIDER_LABEL: Record<string, string> = {
  github: "GitHub",
  google: "Google",
  microsoft: "Microsoft",
};

interface Props {
  accounts: OAuthAccountInfo[];
  onLink: (provider: string) => void;
  onUnlink: (provider: string) => void;
}

export function OAuthAccountsCard({ accounts, onLink, onUnlink }: Props) {
  const linked = new Set(accounts.map((a) => a.provider));
  const allProviders = ["github", "google", "microsoft"];

  return (
    <InfoCard title="OAuth 关联" description="将外部账号链接到当前账号，方便登录">
      {accounts.length === 0 ? (
        <Empty description="尚未关联任何 OAuth 账号" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Space direction="vertical" size={10} style={{ width: "100%", marginBottom: 12 }}>
          {accounts.map((a) => (
            <div key={a.provider} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 10, background: "rgba(0,0,0,0.02)" }}>
              <Space>
                <Link2 size={14} />
                <span style={{ fontWeight: 500 }}>{PROVIDER_LABEL[a.provider] ?? a.provider}</span>
                <Tag style={{ borderRadius: 6 }}>{a.account_email}</Tag>
              </Space>
              <Button size="small" danger icon={<Unlink size={12} />} onClick={() => onUnlink(a.provider)} style={{ borderRadius: 999 }}>
                取消关联
              </Button>
            </div>
          ))}
        </Space>
      )}
      <Space wrap>
        {allProviders.filter((p) => !linked.has(p)).map((p) => (
          <Button key={p} icon={<Link2 size={14} />} onClick={() => onLink(p)} style={{ borderRadius: 999 }}>
            关联 {PROVIDER_LABEL[p] ?? p}
          </Button>
        ))}
      </Space>
    </InfoCard>
  );
}
```

- [ ] **步骤 5：创建 index.ts**

```ts
// frontend/src/apps/profile/components/index.ts
export { ProfileHeader } from "./ProfileHeader";
export { InfoCard, ProfileInfoForm } from "./InfoCard";
export { SecurityCard } from "./SecurityCard";
export { OAuthAccountsCard } from "./OAuthAccountsCard";
```

- [ ] **步骤 6：构建验证**

```bash
cd frontend && npx tsc -b --noEmit
```

预期：0 错误。

- [ ] **步骤 7：Commit**

```bash
git add frontend/src/apps/profile/components/
git commit -m "feat(profile): extract ProfileHeader, InfoCard, SecurityCard, OAuthAccountsCard"
```

---

### 任务 8：重写 ProfilePage

**文件：**
- 修改：`frontend/src/apps/profile/ProfilePage.tsx`

- [ ] **步骤 1：完全重写 ProfilePage.tsx**

用以下代码**完全替换**现有文件：

```tsx
import { App, Segmented, Space } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fetchMe, listOAuthAccounts, unlinkOAuthAccount } from "@/lib/api";
import { useAuth } from "../auth/AuthContext";
import { startOAuthLogin } from "../auth/api/oauth";
import { FadeIn } from "../../components/motion/FadeIn";
import {
  InfoCard,
  OAuthAccountsCard,
  ProfileHeader,
  ProfileInfoForm,
  SecurityCard,
} from "./components";

type Tab = "info" | "security" | "oauth";

export function ProfilePage() {
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const { message: toast } = App.useApp();
  const [tab, setTab] = useState<Tab>("info");

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const oauthQuery = useQuery({
    queryKey: ["oauth-accounts"],
    queryFn: listOAuthAccounts,
    enabled: tab === "oauth",
  });

  const profileMutation = useMutation({
    mutationFn: async (displayName: string | null) => {
      const r = await fetch("/api/v1/auth/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("arknexus.auth.token")}`,
        },
        body: JSON.stringify({ display_name: displayName }),
      });
      if (!r.ok) throw new Error("更新失败");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("已保存");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const passwordMutation = useMutation({
    mutationFn: async ({ old_password, new_password }: { old_password: string; new_password: string }) => {
      const r = await fetch("/api/v1/auth/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("arknexus.auth.token")}`,
        },
        body: JSON.stringify({ old_password, new_password }),
      });
      if (!r.ok) throw new Error("修改失败");
    },
    onSuccess: () => toast.success("密码已修改，请重新登录"),
    onError: (e: Error) => toast.error(e.message),
  });

  const unlinkMutation = useMutation({
    mutationFn: (provider: string) => unlinkOAuthAccount(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oauth-accounts"] });
      toast.success("已取消关联");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user || !meQuery.data) {
    return null;
  }

  const me = meQuery.data as { display_name?: string; email: string; role?: string; is_admin?: boolean };

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <FadeIn variant="slide">
        <ProfileHeader
          displayName={me.display_name || ""}
          email={me.email}
          role={me.role || "user"}
          isAdmin={me.is_admin}
        />
      </FadeIn>

      <Segmented<Tab>
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        options={[
          { value: "info", label: "基本信息" },
          { value: "security", label: "安全" },
          { value: "oauth", label: "OAuth 关联" },
        ]}
        style={{ alignSelf: "flex-start" }}
      />

      {tab === "info" && (
        <InfoCard title="基本信息" description="修改你的显示名">
          <ProfileInfoForm
            displayName={me.display_name || ""}
            email={me.email}
            onSave={async (name) => {
              await profileMutation.mutateAsync(name || null);
            }}
            loading={profileMutation.isPending}
          />
        </InfoCard>
      )}

      {tab === "security" && (
        <SecurityCard
          onChangePassword={async (oldPwd, newPwd) => {
            await passwordMutation.mutateAsync({ old_password: oldPwd, new_password: newPwd });
          }}
          onLogoutAll={logout}
        />
      )}

      {tab === "oauth" && (
        <OAuthAccountsCard
          accounts={oauthQuery.data ?? []}
          onLink={(provider) => startOAuthLogin(provider, "/profile")}
          onUnlink={(provider) => unlinkMutation.mutate(provider)}
        />
      )}
    </Space>
  );
}
```

- [ ] **步骤 2：构建验证**

```bash
cd frontend && npx vite build
```

预期：构建成功，无 warning。

- [ ] **步骤 3：手动验证**

访问 /profile：
- 顶部头像 + 用户名玻璃化卡片入场
- 切换 3 个 tab：基本信息 / 安全 / OAuth
- 修改显示名 → 保存成功
- 修改密码 → 提示重新登录
- OAuth 关联列表可取消 / 关联

- [ ] **步骤 4：Commit**

```bash
git add frontend/src/apps/profile/ProfilePage.tsx
git commit -m "refactor(profile): compose ProfileHeader + tab cards"
```

---

### 任务 9：最终验证与构建

**文件：** 所有前述任务产生的文件

- [ ] **步骤 1：完整类型检查**

```bash
cd frontend && npx tsc -b
```

预期：0 错误。

- [ ] **步骤 2：生产构建**

```bash
cd frontend && npx vite build
```

预期：构建成功，无 warning。

- [ ] **步骤 3：完整冒烟测试**

```bash
cd frontend && npx vite dev
```

依次访问并验证：

1. **/email** — 外层玻璃容器；TopBar 玻璃化；3 栏布局完整；可收发邮件；新建 / 删除 / 搜索正常
2. **/ai/chat** — 左侧会话列表玻璃化；新建会话 → 输入 → 发送：用户消息从右滑入；AI 消息从左滑入 + 流式输出 + typing dots
3. **/settings** — 左侧 4 个模块玻璃化导航入场；切换模块右侧内容从右滑入；4 个 Module 内容正常
4. **/profile** — 顶部头像 + 用户名；tab 切换；修改显示名 / 密码 / OAuth 关联正常
5. **主题切换** — 浅色 ↔ 深色，所有 4 个页面平滑过渡无闪烁

- [ ] **步骤 4：性能抽检**

浏览器开发者工具 → Performance → 录制：
- 切换会话（AI Chat）应 < 250ms
- 切换设置模块应 < 300ms
- 路由切换 < 400ms

- [ ] **步骤 5：Commit（如有遗留修改）**

```bash
git status
git add -A && git commit -m "chore: plan 3 cleanup"
```

- [ ] **步骤 6：打 tag**

```bash
git tag -a v0.2.2-liquid-glass-pages-3 -m "Liquid glass: Email, AI Chat, Settings, Profile"
```

---

## 自检（计划作者执行）

**1. 规格覆盖度：**

| 规格章节 | 实现任务 |
|---|---|
| 8.4 EmailInboxPage | 任务 1, 2（外层 + TopBar） |
| 8.5 AIChatPage | 任务 3, 4 |
| 8.6 SettingsPage | 任务 5, 6 |
| 8.7 ProfilePage | 任务 7, 8 |
| 6.2 卡片入场 stagger | 任务 3 (ConversationList), 5 (SettingsSidebar), 7 (InfoCard) |
| 6.2 页面切换渐入 | 通过 PageTransition（计划 1） |
| 5.1 AuroraBackground 在 EmailInboxPage/AIChatPage 启用 | 计划 1 App.tsx 挂载 |
| 9.1 错误处理 toast | 任务 4, 6, 8 内置（onError → toast） |

**未覆盖（已在计划 2 或延后）：**
- 视觉回归测试 Playwright 截图基线（建议作为额外独立任务或后续计划）
- AuroraBackground 在 SettingsPage/ProfilePage 禁用（规格明示）

**2. 占位符扫描：** 无 "TODO" / "TBD" / "类似任务 N"。

**3. 类型一致性：**
- `Mailbox` / `MessageSummary` 类型从 email 模块导入 ✓
- `ConversationSummary` 从 ai 模块导入，任务 3 定义使用，任务 4 消费 ✓
- `OAuthAccountInfo` 从 `@/lib/api` 导入 ✓
- `GlassCard` / `FadeIn` 路径正确 ✓

无不一致。

---

## 执行选项

3 个计划全部完成并保存：

- 计划 1：`docs/superpowers/plans/2026-09-10-frontend-liquid-glass-refactor.md`（基础设施 + 布局，16 任务）
- 计划 2：`docs/superpowers/plans/2026-09-10-frontend-liquid-glass-refactor-2.md`（登录 / 初始化 / 概览，8 任务）
- 计划 3：`docs/superpowers/plans/2026-09-10-frontend-liquid-glass-refactor-3.md`（邮件 / AI / 设置 / 个人，9 任务）

**执行方式：**

**1. 子代理驱动（推荐）** — 每个任务调度一个新的子代理，任务间进行审查。33 个任务可分批（按计划 1/2/3 划分），最大化并行度和质量关卡。

**2. 内联执行** — 在当前会话中使用 executing-plans 批量执行，设有检查点供审查。
