import { api, getToken } from "@/lib/api";

// ============================================================
// Types
// ============================================================
export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  context_window: number;
  max_output: number;
  supports_streaming: boolean;
  supports_vision: boolean;
  supports_tools: boolean;
  tags: string[];
}

export interface ProviderInfo {
  id: string;
  name: string;
  name_en: string;
  region: "global" | "china" | "proxy";
  description: string;
  base_url: string;
  api_style: "openai" | "anthropic" | "gemini";
  auth_header: string;
  auth_prefix: string;
  doc_url: string;
  signup_url: string;
  models: ModelInfo[];
}

export interface CatalogResponse {
  providers: ProviderInfo[];
}

export interface ProviderConfig {
  provider_id: string;
  api_key: string | null;
  api_key_set: boolean;
  base_url_override: string | null;
  enabled_model_ids?: string[] | null;
}

export interface ActiveSelection {
  provider_id: string;
  model_id: string;
}

export interface AIConfigSnapshot {
  providers: ProviderInfo[];
  provider_configs: ProviderConfig[];
  active: ActiveSelection | null;
}

export interface MessageRead {
  id: string;
  conversation_id: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  provider_id: string | null;
  model_id: string | null;
  finish_reason: string | null;
  created_at: string;
}

export interface ConversationSummary {
  id: string;
  user_id: string;
  title: string;
  provider_id: string;
  model_id: string;
  is_pinned: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message_preview: string | null;
}

export interface ConversationRead {
  id: string;
  user_id: string;
  title: string;
  provider_id: string;
  model_id: string;
  system_prompt: string | null;
  temperature: number | null;
  max_tokens: number | null;
  is_pinned: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  messages: MessageRead[];
}

export interface ConversationCreatePayload {
  title?: string;
  provider_id: string;
  model_id: string;
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  first_message?: string;
}

export interface ConversationUpdatePayload {
  title?: string;
  system_prompt?: string;
  is_pinned?: boolean;
  is_archived?: boolean;
  temperature?: number;
  max_tokens?: number;
}

// ============================================================
// Catalog
// ============================================================
export async function fetchCatalog(): Promise<CatalogResponse> {
  const { data } = await api.get<CatalogResponse>("/ai/catalog");
  return data;
}

// ============================================================
// Config (API keys + active selection)
// ============================================================
export async function fetchAIConfig(): Promise<AIConfigSnapshot> {
  const { data } = await api.get<AIConfigSnapshot>("/ai/config");
  return data;
}

export async function saveProviderConfig(
  providerId: string,
  payload: { api_key?: string | null; base_url_override?: string | null }
): Promise<ProviderConfig> {
  const { data } = await api.put<ProviderConfig>(
    `/ai/config/provider/${providerId}`,
    { provider_id: providerId, ...payload }
  );
  return data;
}

export async function clearProviderConfig(providerId: string): Promise<void> {
  await api.delete(`/ai/config/provider/${providerId}`);
}

export async function setActiveSelection(
  payload: ActiveSelection
): Promise<ActiveSelection> {
  const { data } = await api.put<ActiveSelection>("/ai/config/active", payload);
  return data;
}

// ============================================================
// Conversations
// ============================================================
export async function listConversations(includeArchived = false): Promise<ConversationSummary[]> {
  const { data } = await api.get<ConversationSummary[]>("/ai/conversations", {
    params: { include_archived: includeArchived },
  });
  return data;
}

export async function getConversation(id: string): Promise<ConversationRead> {
  const { data } = await api.get<ConversationRead>(`/ai/conversations/${id}`);
  return data;
}

export async function createConversation(
  payload: ConversationCreatePayload
): Promise<ConversationRead> {
  const { data } = await api.post<ConversationRead>("/ai/conversations", payload);
  return data;
}

export async function updateConversation(
  id: string,
  payload: ConversationUpdatePayload
): Promise<ConversationRead> {
  const { data } = await api.patch<ConversationRead>(
    `/ai/conversations/${id}`,
    payload
  );
  return data;
}

export async function deleteConversation(id: string): Promise<void> {
  await api.delete(`/ai/conversations/${id}`);
}

// ============================================================
// Chat (streaming via fetch)
// ============================================================
export interface ChatDelta {
  type: "start" | "delta" | "usage" | "finish" | "done" | "stop" | "error";
  delta?: string;
  text?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  finish_reason?: string;
  assistant_message_id?: string;
  model?: string;
  status?: number;
  message?: string;
}

export async function streamChat(
  conversationId: string,
  userText: string,
  onEvent: (event: ChatDelta) => void,
  signal?: AbortSignal
): Promise<void> {
  const token = getToken();
  const baseURL = (api.defaults.baseURL ?? "/api/v1").replace(/\/+$/, "");
  const url = `${baseURL}/ai/conversations/${conversationId}/chat`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ role: "user", content: userText }),
    signal,
  });

  if (!resp.ok || !resp.body) {
    let detail = `HTTP ${resp.status}`;
    try {
      const j = await resp.json();
      detail = j?.detail ?? detail;
    } catch {}
    throw new Error(detail);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const line = raw.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const parsed: ChatDelta = JSON.parse(data);
        onEvent(parsed);
      } catch {
        /* ignore */
      }
    }
  }
}
