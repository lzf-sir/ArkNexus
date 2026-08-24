import axios from "axios";

// Init endpoints are PUBLIC (no JWT). Use a raw axios instance without auth.
export const initApi = axios.create({
  baseURL: "/api/v1/init",
  timeout: 20_000,
});

initApi.interceptors.response.use(
  (r) => r,
  (err) => {
    const message =
      err?.response?.data?.detail || err?.message || "请求失败";
    return Promise.reject(new Error(message));
  }
);

export interface InitDefaults {
  database_url: string;
  redis_url: string;
  email_domain: string;
}

export interface InitState {
  initialized: boolean;
  database_url: string | null;
  database_driver: string | null;
  redis_url: string | null;
  email_domain: string | null;
  admin_user_id: string | null;
  completed_at: string | null;
  defaults: InitDefaults;
}

export async function fetchStatus(): Promise<InitState> {
  const { data } = await initApi.get<InitState>("/status");
  return data;
}

export interface StepResult {
  saved?: boolean;
  driver?: string;
  scheme?: string;
  host?: string | null;
  port?: number | null;
  database?: string | null;
  skipped?: boolean;
  domain?: string;
}

export async function postDatabase(url: string): Promise<StepResult> {
  const { data } = await initApi.post<StepResult>("/step/database", { url });
  return data;
}

export async function postRedis(url: string): Promise<StepResult> {
  const { data } = await initApi.post<StepResult>("/step/redis", { url });
  return data;
}

export async function postDomain(domain: string): Promise<StepResult> {
  const { data } = await initApi.post<StepResult>("/step/domain", { domain });
  return data;
}

export interface AdminCreated {
  user_id: string;
  email: string;
  display_name: string | null;
}

export async function postAdmin(payload: {
  email: string;
  password: string;
  display_name?: string;
}): Promise<AdminCreated> {
  const { data } = await initApi.post<AdminCreated>("/step/admin", payload);
  return data;
}

export interface FinishResult {
  initialized: boolean;
  completed_at: string;
  admin_user_id: string;
  summary: Record<string, unknown>;
}

export async function postFinish(): Promise<FinishResult> {
  const { data } = await initApi.post<FinishResult>("/finish");
  return data;
}