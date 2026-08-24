import axios, { AxiosInstance } from "axios";

const TOKEN_KEY = "arknexus.auth.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export const api: AxiosInstance = axios.create({
  baseURL: "/api/v1",
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

export function logout() {
  setToken(null);
}