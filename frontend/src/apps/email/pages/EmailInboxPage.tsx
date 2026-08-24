import {
  App,
  Button,
  Card,
  Checkbox,
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
  const [folder, setFolder] = useState<string>("inbox"); // "inbox" | "trash" | "starred" | folder_id
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

  // Folder/label filtering on the client side (after fetch) so we can reuse the per-mailbox list endpoint.
  const isSearching = search.trim().length > 0;
  const rawMessages = isSearching ? (searchQuery.data ?? []) : (messagesQuery.data ?? []);
  const filteredMessages = useMemo(() => {
    // When searching, the search endpoint already returns ranked results.
    if (isSearching) {
      let msgs = rawMessages.map((h) => ({
        id: h.id,
        mailbox_id: h.mailbox_id,
        from_address: h.from_address,
        from_name: h.from_name,
        subject: h.subject,
        preview: h.preview, // HTML with <mark> highlights
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
    <div style={{ display: "flex", gap: 16, height: "calc(100vh - 160px)" }}>
      <Card
        style={{ width: 220, flexShrink: 0, overflow: "auto" }}
        styles={{ body: { padding: 12 } }}
      >
        <MailboxSidebar
          mailboxes={mailboxesQuery.data}
          selectedId={selectedMailboxId}
          onSelect={onSelectMailbox}
          onCreate={() => setCreateOpen(true)}
          onRefresh={() => mailboxesQuery.refetch()}
          isLoading={mailboxesQuery.isFetching}
        />
        <div style={{ height: 1, background: "#f0f0f0", margin: "12px 0" }} />
        <FoldersPanel
          selectedFolder={folder}
          selectedLabelId={labelId}
          onSelectFolder={(f) => setFolder(f)}
          onSelectLabel={(id) => setLabelId(id)}
        />
      </Card>

      <Card
        style={{ flex: 1, display: "flex", flexDirection: "column" }}
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
        <div style={{ padding: 12, borderBottom: "1px solid #f0f0f0" }}>
          <TopBar
            mailbox={selectedMailbox}
            onDraft={() => setDraftOpen(true)}
            onRefresh={() => messagesQuery.refetch()}
            isRefreshing={messagesQuery.isFetching}
            autoRefresh={autoRefresh}
            onToggleAutoRefresh={() => setAutoRefresh((v) => !v)}
          />
        </div>

        <div style={{ padding: "8px 12px", borderBottom: "1px solid #f0f0f0" }}>
          <Space.Compact style={{ width: "100%" }}>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索主题 / 发件人 / 正文..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "60%" }}
            />
            <Segmented
              value={activeTab}
              onChange={(v) => setActiveTab(v as "inbox" | "drafts")}
              options={[
                { label: "邮件", value: "inbox" },
                { label: `草稿${draftsQuery.data ? ` (${draftsQuery.data.length})` : ""}`, value: "drafts" },
              ]}
            />
          </Space.Compact>
        </div>

        {selectedMessageIds.length > 0 && (
          <div
            style={{
              padding: "8px 16px",
              borderBottom: "1px solid #f0f0f0",
              background: "#e6f4ff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Space>
              <Text strong>{selectedMessageIds.length} 项已选</Text>
              <Button size="small" onClick={() => setSelectedMessageIds([])}>
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
                  >
                    恢复
                  </Button>
                  <Popconfirm
                    title={`永久删除 ${selectedMessageIds.length} 封邮件？此操作不可撤销。`}
                    onConfirm={() => {
                      bulkMutation.mutate({ action: "delete", ids: selectedMessageIds });
                    }}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />}>
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
                  >
                    星标
                  </Button>
                  <Button
                    size="small"
                    onClick={() => bulkMutation.mutate({ action: "unstar", ids: selectedMessageIds })}
                  >
                    取消星标
                  </Button>
                  <Button
                    size="small"
                    onClick={() => bulkMutation.mutate({ action: "mark_read", ids: selectedMessageIds })}
                  >
                    标为已读
                  </Button>
                  <Button
                    size="small"
                    onClick={() => bulkMutation.mutate({ action: "mark_unread", ids: selectedMessageIds })}
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
                    <Button size="small" icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                </>
              )}
            </Space>
          </div>
        )}

        {folder === "trash" && activeTab === "inbox" && (
          <div
            style={{
              padding: "6px 12px",
              borderBottom: "1px solid #f0f0f0",
              background: "#fafafa",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
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
              >
                清空回收站
              </Button>
            </Popconfirm>
          </div>
        )}

        <div style={{ flex: 1, overflow: "auto" }}>
          {activeTab === "inbox" ? (
            <>
              {!selectedMailboxId && (
                <div style={{ padding: 24, textAlign: "center" }}>
                  <Spin />
                </div>
              )}
              {selectedMailboxId && isSearching && (
                <div style={{ padding: "8px 16px", color: "#999", fontSize: 12 }}>
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
                    style={{ marginTop: 32 }}
                  />
                )}
            </>
          ) : (
            <>
              {draftsQuery.isLoading && <Spin />}
              {draftsQuery.data && draftsQuery.data.length === 0 && (
                <Empty description="暂无草稿" style={{ marginTop: 32 }} />
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
        >
          <Form.Item
            name="local_part"
            label="自定义本地部分（可选）"
            extra="留空则随机生成"
          >
            <Input placeholder="例如：my-tag" />
          </Form.Item>
          <Form.Item name="display_name" label="备注名（可选）">
            <Input placeholder="仅本地显示" />
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
    <Space direction="vertical" size={0} style={{ width: "100%", padding: "8px 0" }}>
      {drafts.map((d) => {
        const deleting = pendingDeleteId === d.id;
        const to = d.to_addresses.join(", ");
        return (
          <div
            key={d.id}
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #f0f0f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <Space size={4}>
                <FileTextOutlined />
                <Text strong>{d.subject || "(无主题)"}</Text>
              </Space>
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                收件人：{to || "（未填写）"}
              </div>
              <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>
                {new Date(d.updated_at).toLocaleString()}
              </div>
            </div>
            <Space>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => onEdit(d)}
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
                />
              </Popconfirm>
            </Space>
          </div>
        );
      })}
    </Space>
  );
}
