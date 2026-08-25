import {
  App,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  PlusOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  BulkResult,
  Draft,
  bulkAction,
  createDraft,
  createMailbox,
  deleteDraft,
  deleteMailbox,
  emptyTrash,
  listDrafts,
  listMailboxes,
  listMessages,
  restoreMessage,
  searchMessages,
  trashMessage,
  updateDraft,
} from "../api/client";
import type { Mailbox, MessageSummary } from "../api/client";
import { DraftDrawer } from "../components/DraftDrawer";
import { FoldersPanel } from "../components/FoldersPanel";
import { MailboxSidebar } from "../components/MailboxSidebar";
import { MessageList } from "../components/MessageList";
import { MessageView } from "../components/MessageView";
import { TopBar } from "../components/TopBar";

const { Text } = Typography;

interface CreateFormValues {
  local_part?: string;
  display_name?: string;
}

interface ComposeValues {
  to_addresses: string[];
  cc_addresses?: string[];
  subject: string;
  body_text?: string;
}

export function EmailInboxPage() {
  const queryClient = useQueryClient();
  const { message: toast } = App.useApp();

  const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"inbox" | "drafts">("inbox");
  const [folder, setFolder] = useState<string>("inbox");
  const [labelId, setLabelId] = useState<string | null>(null);

  const mailboxesQuery = useQuery<Mailbox[]>({
    queryKey: ["mailboxes"],
    queryFn: () => listMailboxes(false),
    refetchInterval: autoRefresh ? 15_000 : false,
  });

  useEffect(() => {
    if (!selectedMailboxId && mailboxesQuery.data && mailboxesQuery.data.length > 0) {
      setSelectedMailboxId(mailboxesQuery.data[0].id);
    }
  }, [mailboxesQuery.data, selectedMailboxId]);

  const selectedMailbox = useMemo<Mailbox | null>(() => {
    if (!selectedMailboxId || !mailboxesQuery.data) return null;
    return mailboxesQuery.data.find((m) => m.id === selectedMailboxId) ?? null;
  }, [mailboxesQuery.data, selectedMailboxId]);

  const messagesQuery = useQuery<MessageSummary[]>({
    queryKey: ["messages", selectedMailboxId, folder, labelId],
    queryFn: () => listMessages(selectedMailboxId!),
    enabled: !!selectedMailboxId && activeTab === "inbox" && !search.trim(),
    refetchInterval: autoRefresh ? 10_000 : false,
  });

  const searchQuery = useQuery({
    queryKey: ["messages-search", selectedMailboxId, search, folder, labelId],
    queryFn: () => searchMessages(selectedMailboxId!, search),
    enabled: !!selectedMailboxId && activeTab === "inbox" && !!search.trim(),
  });

  const draftsQuery = useQuery<Draft[]>({
    queryKey: ["drafts", selectedMailboxId],
    queryFn: () => listDrafts(selectedMailboxId!),
    enabled: !!selectedMailboxId && activeTab === "drafts",
  });

  const isSearching = search.trim().length > 0;
  const rawMessages = isSearching ? (searchQuery.data ?? []) : (messagesQuery.data ?? []);
  const filteredMessages = useMemo(() => {
    if (isSearching) {
      let msgs = rawMessages.map((h) => ({
        id: h.id,
        mailbox_id: h.mailbox_id,
        from_address: h.from_address,
        from_name: h.from_name,
        subject: h.subject,
        preview: h.preview,
        received_at: h.received_at,
        is_read: h.is_read,
        is_starred: h.is_starred,
        has_attachments: h.has_attachments,
        size_bytes: h.size_bytes,
        is_trashed: false,
        folder_id: null,
        labels: [],
      } as any));
      if (labelId) {
        msgs = msgs.filter((m) => ((m.labels as any[]) ?? []).some((l) => l.label_id === labelId));
      }
      return msgs;
    }
    let msgs = messagesQuery.data ?? [];
    if (folder === "trash") {
      msgs = msgs.filter((m) => (m as any).is_trashed);
    } else if (folder === "starred") {
      msgs = msgs.filter((m) => m.is_starred);
    } else if (folder !== "inbox") {
      msgs = msgs.filter((m) => (m as any).folder_id === folder);
    } else {
      msgs = msgs.filter((m) => !(m as any).is_trashed);
    }
    if (labelId) {
      msgs = msgs.filter((m) =>
        ((m as any).labels ?? []).some((l: any) => l.label_id === labelId)
      );
    }
    return msgs;
  }, [messagesQuery.data, folder, labelId]);

  const onSelectMailbox = (id: string) => {
    setSelectedMailboxId(id || null);
    setSelectedMessageIds([]);
    setSelectedMessageId(null);
  };

  const onSelectMessage = (id: string) => {
    setSelectedMessageId(id);
    setViewerOpen(true);
  };

  const toggleSelect = (id: string) => {
    setSelectedMessageIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
  };

  const bulkMutation = useMutation<BulkResult, Error, { action: "delete" | "mark_read" | "mark_unread" | "star" | "unstar"; ids: string[] }>({
    mutationFn: ({ action, ids }) =>
      bulkAction(selectedMailboxId!, ids, action),
    onSuccess: (result, vars) => {
      toast.success(`${result.action} → 影响 ${result.affected} 封`);
      setSelectedMessageIds([]);
      queryClient.invalidateQueries({ queryKey: ["messages", selectedMailboxId] });
      queryClient.invalidateQueries({ queryKey: ["mailboxes"] });
      void vars;
    },
    onError: (err) => toast.error(err.message),
  });

  const trashM = useMutation({
    mutationFn: (id: string) => trashMessage(id),
    onSuccess: () => {
      toast.success("已移到回收站");
      queryClient.invalidateQueries({ queryKey: ["messages", selectedMailboxId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restoreM = useMutation({
    mutationFn: (id: string) => restoreMessage(id),
    onSuccess: () => {
      toast.success("已恢复");
      queryClient.invalidateQueries({ queryKey: ["messages", selectedMailboxId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const emptyTrashM = useMutation({
    mutationFn: () => emptyTrash(),
    onSuccess: (r) => {
      toast.success(`已永久删除 ${r.deleted} 封`);
      queryClient.invalidateQueries({ queryKey: ["messages", selectedMailboxId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onDeleteDraft = useMutation({
    mutationFn: (id: string) => deleteDraft(id),
    onSuccess: () => {
      toast.success("草稿已删除");
      queryClient.invalidateQueries({ queryKey: ["drafts", selectedMailboxId] });
    },
  });

  const [createForm] = Form.useForm<CreateFormValues>();
  const [composeForm] = Form.useForm<ComposeValues>();

  const createMutation = useMutation({
    mutationFn: (values: CreateFormValues) =>
      createMailbox({
        local_part: values.local_part || undefined,
        display_name: values.display_name || undefined,
      }),
    onSuccess: (mb) => {
      toast.success(`已创建 ${mb.address}`);
      queryClient.invalidateQueries({ queryKey: ["mailboxes"] });
      setSelectedMailboxId(mb.id);
      setCreateOpen(false);
      createForm.resetFields();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const selectedSet = new Set(selectedMessageIds);
  const isTrashFolder = folder === "trash";

  return (
    <div className="apple-fade-in" style={{ display: "flex", gap: 16, height: "calc(100vh - 104px)" }}>
      {/* Left sidebar: mailboxes + folders */}
      <Card
        className="apple-card"
        style={{
          width: 240,
          flexShrink: 0,
          overflow: "auto",
          borderRadius: 16,
          padding: "14px 12px",
          background: "#ffffff",
        }}
        styles={{ body: { padding: 0 } }}
      >
        <MailboxSidebar
          mailboxes={mailboxesQuery.data}
          selectedId={selectedMailboxId}
          onSelect={onSelectMailbox}
          onCreate={() => setCreateOpen(true)}
          onRefresh={() => mailboxesQuery.refetch()}
          isLoading={mailboxesQuery.isFetching}
        />
        <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "14px 4px" }} />
        <FoldersPanel
          selectedFolder={folder}
          selectedLabelId={labelId}
          onSelectFolder={(f) => setFolder(f)}
          onSelectLabel={(id) => setLabelId(id)}
        />
      </Card>

      {/* Main panel: messages */}
      <Card
        className="apple-card"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          borderRadius: 16,
          overflow: "hidden",
        }}
        styles={{
          body: {
            padding: 0,
            flex: 1,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        {/* Top bar */}
        <div style={{ padding: 12, borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
          <TopBar
            mailbox={selectedMailbox}
            onDraft={() => setDraftOpen(true)}
            onRefresh={() => messagesQuery.refetch()}
            isRefreshing={messagesQuery.isFetching}
            autoRefresh={autoRefresh}
            onToggleAutoRefresh={() => setAutoRefresh((v) => !v)}
          />
        </div>

        {/* Search + tabs */}
        <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(0,0,0,0.04)", display: "flex", gap: 8, alignItems: "center" }}>
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: "#86868b" }} />}
            placeholder="搜索主题 / 发件人 / 正文..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, height: 36 }}
          />
          <Segmented
            value={activeTab}
            onChange={(v) => setActiveTab(v as "inbox" | "drafts")}
            options={[
              { label: "邮件", value: "inbox" },
              { label: `草稿${draftsQuery.data ? ` (${draftsQuery.data.length})` : ""}`, value: "drafts" },
            ]}
          />
        </div>

        {/* Bulk action bar */}
        {selectedMessageIds.length > 0 && (
          <div
            style={{
              padding: "8px 16px",
              borderBottom: "1px solid rgba(0,0,0,0.04)",
              background: "rgba(0,113,227,0.04)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Space>
              <Text strong style={{ fontSize: 13 }}>{selectedMessageIds.length} 项已选</Text>
              <Button size="small" onClick={() => setSelectedMessageIds([])} style={{ borderRadius: 8 }}>
                取消选择
              </Button>
            </Space>
            <Space>
              {isTrashFolder ? (
                <>
                  <Button
                    size="small"
                    icon={<UndoOutlined />}
                    onClick={() => {
                      selectedMessageIds.forEach((id) => restoreM.mutate(id));
                      setSelectedMessageIds([]);
                    }}
                    style={{ borderRadius: 8 }}
                  >
                    恢复
                  </Button>
                  <Popconfirm
                    title={`永久删除 ${selectedMessageIds.length} 封邮件？此操作不可撤销。`}
                    onConfirm={() => {
                      bulkMutation.mutate({ action: "delete", ids: selectedMessageIds });
                    }}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 8 }}>
                      永久删除
                    </Button>
                  </Popconfirm>
                </>
              ) : (
                <>
                  <Button
                    size="small"
                    icon={<StarFilled />}
                    onClick={() => bulkMutation.mutate({ action: "star", ids: selectedMessageIds })}
                    style={{ borderRadius: 8 }}
                  >
                    星标
                  </Button>
                  <Button
                    size="small"
                    onClick={() => bulkMutation.mutate({ action: "unstar", ids: selectedMessageIds })}
                    style={{ borderRadius: 8 }}
                  >
                    取消星标
                  </Button>
                  <Button
                    size="small"
                    onClick={() => bulkMutation.mutate({ action: "mark_read", ids: selectedMessageIds })}
                    style={{ borderRadius: 8 }}
                  >
                    标为已读
                  </Button>
                  <Button
                    size="small"
                    onClick={() => bulkMutation.mutate({ action: "mark_unread", ids: selectedMessageIds })}
                    style={{ borderRadius: 8 }}
                  >
                    标为未读
                  </Button>
                  <Popconfirm
                    title={`将 ${selectedMessageIds.length} 封邮件移到回收站？`}
                    onConfirm={() => {
                      selectedMessageIds.forEach((id) => trashM.mutate(id));
                      setSelectedMessageIds([]);
                    }}
                  >
                    <Button size="small" icon={<DeleteOutlined />} style={{ borderRadius: 8 }}>
                      删除
                    </Button>
                  </Popconfirm>
                </>
              )}
            </Space>
          </div>
        )}

        {/* Trash folder notice */}
        {folder === "trash" && activeTab === "inbox" && (
          <div
            style={{
              padding: "6px 12px",
              borderBottom: "1px solid rgba(0,0,0,0.04)",
              background: "#fbfbfd",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text type="secondary" style={{ fontSize: 12, color: "#86868b" }}>
              回收站中的邮件 30 天后将自动清理。
            </Text>
            <Popconfirm
              title="清空回收站？"
              description="将永久删除所有回收站中的邮件，此操作不可撤销。"
              okText="清空"
              cancelText="取消"
              onConfirm={() => emptyTrashM.mutate()}
            >
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={emptyTrashM.isPending}
                style={{ borderRadius: 8 }}
              >
                清空回收站
              </Button>
            </Popconfirm>
          </div>
        )}

        {/* Message list area */}
        <div className="apple-scroll" style={{ flex: 1, overflow: "auto" }}>
          {activeTab === "inbox" ? (
            <>
              {!selectedMailboxId && (
                <div style={{ padding: 24, textAlign: "center" }}>
                  <Spin />
                </div>
              )}
              {selectedMailboxId && isSearching && (
                <div style={{ padding: "8px 16px", color: "#86868b", fontSize: 12 }}>
                  搜索 "{search}" — {messagesQuery.data?.length ?? 0} 个结果
                </div>
              )}
              {selectedMailboxId && (
                <MessageList
                  messages={filteredMessages}
                  selectedId={selectedMessageId}
                  onSelect={onSelectMessage}
                  loading={(isSearching ? searchQuery.isLoading : messagesQuery.isLoading)}
                  selectable
                  selectedIds={selectedSet}
                  onToggleSelect={toggleSelect}
                />
              )}
              {selectedMailboxId &&
                !messagesQuery.isLoading &&
                filteredMessages.length === 0 && (
                  <Empty
                    description={
                      isTrashFolder
                        ? "回收站为空"
                        : isSearching
                        ? "搜索无结果"
                        : folder === "starred"
                        ? "还没有星标邮件"
                        : "收件箱为空"
                    }
                    style={{ marginTop: 48 }}
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                )}
            </>
          ) : (
            <>
              {draftsQuery.isLoading && <Spin />}
              {draftsQuery.data && draftsQuery.data.length === 0 && (
                <Empty description="暂无草稿" style={{ marginTop: 48 }} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
              {draftsQuery.data && draftsQuery.data.length > 0 && (
                <DraftList
                  drafts={draftsQuery.data}
                  onDelete={(id) => onDeleteDraft.mutate(id)}
                  onEdit={(d) => {
                    composeForm.setFieldsValue({
                      to_addresses: d.to_addresses,
                      cc_addresses: d.cc_addresses,
                      subject: d.subject,
                      body_text: d.body_text ?? "",
                    });
                    setDraftOpen(true);
                    toast.info(`正在编辑草稿 ${d.subject || "(无主题)"}`);
                  }}
                  pendingDeleteId={onDeleteDraft.isPending ? onDeleteDraft.variables : undefined}
                />
              )}
            </>
          )}
        </div>
      </Card>

      {/* Drawers & modals */}
      <MessageView
        messageId={selectedMessageId}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />

      <DraftDrawer
        open={draftOpen}
        mailbox={selectedMailbox}
        onClose={() => setDraftOpen(false)}
      />

      <Modal
        title="创建临时邮箱"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        okText="创建"
        cancelText="取消"
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={(values) => createMutation.mutate(values)}
          requiredMark={false}
        >
          <Form.Item
            name="local_part"
            label="自定义本地部分（可选）"
            extra={<span style={{ fontSize: 12, color: "#86868b" }}>留空则随机生成</span>}
          >
            <Input placeholder="例如：my-tag" style={{ height: 40 }} />
          </Form.Item>
          <Form.Item name="display_name" label="备注名（可选）">
            <Input placeholder="仅本地显示" style={{ height: 40 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function DraftList({
  drafts,
  onDelete,
  onEdit,
  pendingDeleteId,
}: {
  drafts: Draft[];
  onDelete: (id: string) => void;
  onEdit: (d: Draft) => void;
  pendingDeleteId?: string;
}) {
  return (
    <div style={{ padding: "8px 0" }}>
      {drafts.map((d) => {
        const deleting = pendingDeleteId === d.id;
        const to = d.to_addresses.join(", ");
        return (
          <div
            key={d.id}
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid rgba(0,0,0,0.04)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <Space size={6}>
                <FileTextOutlined style={{ color: "#0071e3" }} />
                <Text strong style={{ fontSize: 14 }}>{d.subject || "(无主题)"}</Text>
              </Space>
              <div style={{ fontSize: 12, color: "#86868b", marginTop: 4 }}>
                收件人：{to || "（未填写）"}
              </div>
              <div style={{ fontSize: 11, color: "#86868b", marginTop: 2 }}>
                {new Date(d.updated_at).toLocaleString()}
              </div>
            </div>
            <Space>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => onEdit(d)}
                style={{ borderRadius: 8 }}
              >
                编辑
              </Button>
              <Popconfirm
                title="删除此草稿？"
                onConfirm={() => onDelete(d.id)}
              >
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  loading={deleting}
                  style={{ borderRadius: 8 }}
                />
              </Popconfirm>
            </Space>
          </div>
        );
      })}
    </div>
  );
}
