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
