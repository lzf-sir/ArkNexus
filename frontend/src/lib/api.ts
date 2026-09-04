import axios, { AxiosInstance } from "axios";

const TOKEN_KEY = "arknexus.auth.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/**
 * Resolve the API base URL.
 *
 * Order of precedence:
 *   1. VITE_API_BASE_URL build-time env var (Cloudflare Pages dashboard,
 *      .env.production, etc.).
 *   2. window.__ARK_NEXUS_API_BASE__ injected at runtime via a small
 *      <script> snippet - useful when the same SPA build is served from
 *      multiple environments (staging vs production) without rebuilding.
 *   3. Same-origin /api/v1 - convenient for local dev where the gateway
 *      is reverse-proxied on the same host.
 */
function resolveApiBaseUrl(): string {
  const fromBuild = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
  if (fromBuild) return fromBuild.replace(/\/+$/, "");
  const fromWindow = (window as unknown as { __ARK_NEXUS_API_BASE__?: string }).__ARK_NEXUS_API_BASE__;
  if (typeof fromWindow === "string" && fromWindow.trim()) {
    return fromWindow.trim().replace(/\/+$/, "");
  }
  return "/api/v1";
}

export const api: AxiosInstance = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 15_000,
});

api.interceptors.request.use((config) => {
  const t = getToken();
  if (t) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${t}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const message =
      err?.response?.data?.detail ||
      err?.message ||
      "请求失败";
    return Promise.reject(new Error(message));
  }
);

export interface AuthUser {
  id: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
  is_verified: boolean;
  is_admin: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

export async function register(payload: {
  email: string;
  password: string;
  display_name?: string;
}): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>("/auth/register", payload);
  setToken(data.access_token);
  return data;
}

export async function login(payload: {
  email: string;
  password: string;
}): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>("/auth/login", payload);
  setToken(data.access_token);
  return data;
}

export async function fetchMe(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>("/auth/me");
  return data;
}

export interface OAuthAccountInfo {
  id: string;
  provider: string;
  provider_user_id: string;
  provider_email: string | null;
  provider_display_name: string | null;
  created_at: string | null;
  last_used_at: string | null;
}

export async function listOAuthAccounts(): Promise<OAuthAccountInfo[]> {
  const { data } = await api.get<OAuthAccountInfo[]>("/auth/me/oauth-accounts");
  return data;
}

export async function unlinkOAuthAccount(id: string): Promise<void> {
  await api.delete(`/auth/me/oauth-accounts/${id}`);
}

export function logout() {
  setToken(null);
}