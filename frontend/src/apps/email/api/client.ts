import { api } from "@/lib/api";

export interface Mailbox {
  id: string;
  address: string;
  display_name: string | null;
  created_at: string;
  expires_at: string;
  last_accessed_at: string;
  message_count: number;
  unread_count: number;
}

export interface AttachmentMeta {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  content_id: string | null;
}

export interface MessageSummary {
  id: string;
  mailbox_id: string;
  from_address: string;
  from_name: string | null;
  subject: string;
  preview: string;
  received_at: string;
  is_read: boolean;
  is_starred: boolean;
  has_attachments: boolean;
  size_bytes: number;
}

export interface MessageDetail extends Omit<MessageSummary, "preview"> {
  rfc_message_id: string | null;
  to_addresses: string[];
  cc_addresses: string[];
  body_text: string | null;
  body_html: string | null;
  labels?: Array<{ id?: string; label_id?: string; name: string; color: string }>;
  attachments: AttachmentMeta[];
}

export interface Draft {
  id: string;
  mailbox_id: string;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string;
  body_text: string | null;
  body_html: string | null;
  created_at: string;
  updated_at: string;
}

export interface LabelInfo {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface FolderInfo {
  id: string;
  slug: string;
  name: string;
  is_system: boolean;
  color: string | null;
  created_at: string;
}

export interface MessageLabelInfo {
  label_id: string;
  name: string;
  color: string;
}

export interface MessageSummaryWithLabels extends MessageSummary {
  is_trashed: boolean;
  folder_id: string | null;
  labels: MessageLabelInfo[];
}

export interface SearchHit {
  id: string;
  mailbox_id: string;
  rfc_message_id: string | null;
  from_address: string;
  from_name: string | null;
  subject: string | null;
  preview: string; // HTML with <mark> highlights
  received_at: string;
  is_read: boolean;
  is_starred: boolean;
  has_attachments: boolean;
  size_bytes: number;
  rank: number;
}

export interface SystemStats {
  mailbox_total: number;
  mailbox_active: number;
  message_total: number;
  message_active: number;
  attachment_total: number;
  retention_days: number;
  cleanup_last_run: string | null;
}

// ===== Mailbox APIs =====
export async function listMailboxes(includeExpired = false): Promise<Mailbox[]> {
  const { data } = await api.get<Mailbox[]>("/mailboxes", {
    params: { include_expired: includeExpired },
  });
  return data;
}

export async function createMailbox(opts?: {
  local_part?: string;
  display_name?: string;
}): Promise<Mailbox> {
  const { data } = await api.post<Mailbox>("/mailboxes", opts ?? {});
  return data;
}

export async function getMailbox(id: string): Promise<Mailbox> {
  const { data } = await api.get<Mailbox>(`/mailboxes/${id}`);
  return data;
}

export async function deleteMailbox(id: string): Promise<void> {
  await api.delete(`/mailboxes/${id}`);
}

export async function updateMailbox(
  id: string,
  payload: { display_name?: string; extend_days?: number }
): Promise<Mailbox> {
  const { data } = await api.patch<Mailbox>(`/mailboxes/${id}`, payload);
  return data;
}

// ===== Message APIs =====
export async function listMessages(
  mailboxId: string,
  opts?: { limit?: number; offset?: number; only_unread?: boolean }
): Promise<MessageSummary[]> {
  const { data } = await api.get<MessageSummary[]>(
    `/mailboxes/${mailboxId}/messages`,
    { params: opts ?? {} }
  );
  return data;
}

export async function searchMessages(
  mailboxId: string,
  q: string,
  opts?: { limit?: number; only_unread?: boolean }
): Promise<SearchHit[]> {
  const { data } = await api.get<SearchHit[]>(
    `/mailboxes/${mailboxId}/messages/search`,
    { params: { q, ...(opts ?? {}) } }
  );
  return data;
}

export interface BulkResult {
  affected: number;
  action: string;
}

export async function bulkAction(
  mailboxId: string,
  messageIds: string[],
  action: "delete" | "mark_read" | "mark_unread" | "star" | "unstar"
): Promise<BulkResult> {
  const { data } = await api.post<BulkResult>(
    `/mailboxes/${mailboxId}/messages/bulk`,
    { message_ids: messageIds, action }
  );
  return data;
}

export async function getMessage(id: string): Promise<MessageDetail> {
  const { data } = await api.get<MessageDetail>(`/messages/${id}`);
  return data;
}

export async function updateMessage(
  id: string,
  payload: { is_read?: boolean; is_starred?: boolean }
): Promise<MessageDetail> {
  const { data } = await api.patch<MessageDetail>(`/messages/${id}`, payload);
  return data;
}

export async function deleteMessage(id: string): Promise<void> {
  await api.delete(`/messages/${id}`);
}

export async function sendMail(
  mailboxId: string,
  payload: {
    to_addresses: string[];
    cc_addresses?: string[];
    subject: string;
    body_text?: string;
    body_html?: string;
  }
): Promise<{ accepted: string[]; queued_at: string; relay_mode: string }> {
  const { data } = await api.post(`/mailboxes/${mailboxId}/send`, payload);
  return data;
}

// ===== Draft APIs =====
export async function listDrafts(mailboxId: string): Promise<Draft[]> {
  const { data } = await api.get<Draft[]>(`/mailboxes/${mailboxId}/drafts`);
  return data;
}

export async function createDraft(
  mailboxId: string,
  payload: Partial<Draft>
): Promise<Draft> {
  const { data } = await api.post<Draft>(`/mailboxes/${mailboxId}/drafts`, payload);
  return data;
}

export async function updateDraft(
  draftId: string,
  payload: Partial<Draft>
): Promise<Draft> {
  const { data } = await api.patch<Draft>(`/drafts/${draftId}`, payload);
  return data;
}

export async function deleteDraft(draftId: string): Promise<void> {
  await api.delete(`/drafts/${draftId}`);
}

// ===== System APIs =====
export async function getStats(): Promise<SystemStats> {
  const { data } = await api.get<SystemStats>("/system/stats");
  return data;
}

export async function triggerCleanup(): Promise<{
  mailboxes_deleted: number;
  messages_deleted: number;
  attachments_deleted: number;
  files_removed: number;
  ran_at: string;
}> {
  const { data } = await api.post("/system/cleanup");
  return data;
}

// ===== Folder APIs =====
export async function listFolders(): Promise<FolderInfo[]> {
  const { data } = await api.get<FolderInfo[]>("/folders");
  return data;
}

export async function createFolder(payload: { name: string; color?: string }): Promise<FolderInfo> {
  const { data } = await api.post<FolderInfo>("/folders", payload);
  return data;
}

export async function updateFolder(id: string, payload: { name?: string; color?: string }): Promise<FolderInfo> {
  const { data } = await api.patch<FolderInfo>(`/folders/${id}`, payload);
  return data;
}

export async function deleteFolder(id: string): Promise<void> {
  await api.delete(`/folders/${id}`);
}

// ===== Label APIs =====
export async function listLabels(): Promise<LabelInfo[]> {
  const { data } = await api.get<LabelInfo[]>("/labels");
  return data;
}

export async function createLabel(payload: { name: string; color?: string }): Promise<LabelInfo> {
  const { data } = await api.post<LabelInfo>("/labels", payload);
  return data;
}

export async function updateLabel(id: string, payload: { name?: string; color?: string }): Promise<LabelInfo> {
  const { data } = await api.patch<LabelInfo>(`/labels/${id}`, payload);
  return data;
}

export async function deleteLabel(id: string): Promise<void> {
  await api.delete(`/labels/${id}`);
}

export async function getMessageLabels(messageId: string): Promise<MessageLabelInfo[]> {
  const { data } = await api.get<MessageLabelInfo[]>(`/messages/${messageId}/labels`);
  return data;
}

export async function setMessageLabels(messageId: string, labelIds: string[]): Promise<LabelInfo[]> {
  const { data } = await api.put<LabelInfo[]>(`/messages/${messageId}/labels`, { label_ids: labelIds });
  return data;
}

// ===== Trash APIs =====
export async function trashMessage(id: string): Promise<void> {
  await api.post(`/messages/${id}/trash`);
}

export async function restoreMessage(id: string): Promise<void> {
  await api.post(`/messages/${id}/restore`);
}

export async function emptyTrash(): Promise<{ deleted: number }> {
  const { data } = await api.post<{ deleted: number }>("/trash/empty");
  return data;
}
