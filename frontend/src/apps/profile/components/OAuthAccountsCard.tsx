// frontend/src/apps/profile/components/OAuthAccountsCard.tsx
import { Button, Empty, Space, Tag } from "antd";
import { Link2, Unlink } from "lucide-react";
import { InfoCard } from "./InfoCard";
import type { OAuthAccountInfo } from "@/lib/api";

const PROVIDER_LABEL: Record<string, string> = {
  github: "GitHub",
  google: "Google",
  microsoft: "Microsoft",
};

interface Props {
  accounts: OAuthAccountInfo[];
  onLink: (provider: string) => void;
  onUnlink: (provider: string) => void;
}

export function OAuthAccountsCard({ accounts, onLink, onUnlink }: Props) {
  const linked = new Set(accounts.map((a) => a.provider));
  const allProviders = ["github", "google", "microsoft"];

  return (
    <InfoCard title="OAuth 关联" description="将外部账号链接到当前账号，方便登录">
      {accounts.length === 0 ? (
        <Empty description="尚未关联任何 OAuth 账号" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Space direction="vertical" size={10} style={{ width: "100%", marginBottom: 12 }}>
          {accounts.map((a) => (
            <div key={a.provider} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 10, background: "rgba(0,0,0,0.02)" }}>
              <Space>
                <Link2 size={14} />
                <span style={{ fontWeight: 500 }}>{PROVIDER_LABEL[a.provider] ?? a.provider}</span>
                <Tag style={{ borderRadius: 6 }}>{a.provider_email ?? a.provider_display_name ?? a.provider_user_id}</Tag>
              </Space>
              <Button size="small" danger icon={<Unlink size={12} />} onClick={() => onUnlink(a.provider)} style={{ borderRadius: 999 }}>
                取消关联
              </Button>
            </div>
          ))}
        </Space>
      )}
      <Space wrap>
        {allProviders.filter((p) => !linked.has(p)).map((p) => (
          <Button key={p} icon={<Link2 size={14} />} onClick={() => onLink(p)} style={{ borderRadius: 999 }}>
            关联 {PROVIDER_LABEL[p] ?? p}
          </Button>
        ))}
      </Space>
    </InfoCard>
  );
}
