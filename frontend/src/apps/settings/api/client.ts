import { api } from "@/lib/api";

export interface ServiceRead {
  id: string;
  slug: string;
  display_name: string;
  description: string | null;
  version: string | null;
  icon: string | null;
  base_url: string | null;
  health_url: string | null;
  is_active: boolean;
  first_seen_at: string;
  last_heartbeat_at: string;
  is_online: boolean;
}

export interface ConfigKeyRead {
  id: string;
  service_id: string;
  key: string;
  display_name: string | null;
  description: string | null;
  group: string | null;
  value_type: "string" | "int" | "float" | "bool" | "json";
  current_value: string | null;
  default_value: string | null;
  is_secret: boolean;
  is_readonly: boolean;
  is_required: boolean;
  options: unknown[] | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ConfigKeyGrouped {
  group: string;
  items: ConfigKeyRead[];
}

export interface ConfigHistoryEntry {
  id: string;
  config_key_id: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
  note: string | null;
}

// ===== Services =====

export async function listServices(): Promise<ServiceRead[]> {
  const { data } = await api.get<ServiceRead[]>("/services");
  return data;
}

export async function heartbeatService(
  slug: string,
  meta?: Record<string, unknown>
): Promise<ServiceRead> {
  const { data } = await api.post<ServiceRead>(`/services/${slug}/heartbeat`, {
    heartbeat_meta: meta ?? null,
  });
  return data;
}

export async function deleteService(slug: string): Promise<void> {
  await api.delete(`/services/${slug}`);
}

// ===== Config keys =====

export async function listServiceConfigs(slug: string): Promise<ConfigKeyRead[]> {
  const { data } = await api.get<ConfigKeyRead[]>(`/services/${slug}/configs`);
  return data;
}

export async function listServiceConfigsGrouped(
  slug: string
): Promise<ConfigKeyGrouped[]> {
  const { data } = await api.get<ConfigKeyGrouped[]>(
    `/services/${slug}/configs/grouped`
  );
  return data;
}

export async function updateConfigValue(
  slug: string,
  key: string,
  value: string | null,
  note?: string
): Promise<ConfigKeyRead> {
  const { data } = await api.patch<ConfigKeyRead>(
    `/services/${slug}/configs/${key}/value`,
    { value, note }
  );
  return data;
}

export async function getConfigHistory(
  slug: string,
  key: string
): Promise<ConfigHistoryEntry[]> {
  const { data } = await api.get<ConfigHistoryEntry[]>(
    `/services/${slug}/configs/${key}/history`
  );
  return data;
}