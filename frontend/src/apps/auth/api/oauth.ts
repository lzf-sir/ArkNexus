import { api } from "@/lib/api";

export interface OAuthProviderInfo {
  name: string;
  configured: boolean;
}

export async function listOAuthProviders(): Promise<{ providers: OAuthProviderInfo[]; configured: string[] }> {
  const { data } = await api.get<{ providers: OAuthProviderInfo[]; configured: string[] }>("/auth/oauth/providers");
  return data;
}

export function startOAuthLogin(provider: string, redirectTo?: string): void {
  const url = new URL(
    `${api.defaults.baseURL || ""}/auth/oauth/${provider}/start`,
    window.location.origin
  );
  if (redirectTo) url.searchParams.set("redirect_to", redirectTo);
  window.location.href = url.toString();
}
