// frontend/src/apps/dashboard/components/ServicesStatusCard.tsx
import { Badge, Empty, Timeline, Typography } from "antd";
import { Clock } from "lucide-react";
import dayjs from "dayjs";
import { GlassCard } from "../../../components/glass/GlassCard";
import type { ServiceRead } from "../../settings/api/client";

const { Text } = Typography;

interface Props {
  services: ServiceRead[];
  loading?: boolean;
}

export function ServicesStatusCard({ services, loading }: Props) {
  return (
    <GlassCard padding={20} radius={18}>
      <Text strong style={{ fontSize: 16, letterSpacing: "-0.01em", display: "block", marginBottom: 16 }}>
        微服务状态
      </Text>
      {loading ? (
        <Text type="secondary">加载中...</Text>
      ) : services.length === 0 ? (
        <Empty description="暂无已注册服务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Timeline
          items={services.map((svc) => ({
            color: svc.is_online ? "green" : "red",
            dot: <Badge status={svc.is_online ? "processing" : "error"} />,
            children: (
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{svc.display_name}</div>
                <div style={{ fontSize: 12, color: "var(--ant-color-text-tertiary, #86868b)", marginTop: 2 }}>
                  <code>{svc.slug}</code>
                  {svc.version ? ` · v${svc.version}` : ""}
                </div>
                <div style={{ fontSize: 12, color: "var(--ant-color-text-tertiary, #86868b)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                  <Clock size={11} strokeWidth={1.8} /> {timeAgo(svc.last_heartbeat_at)}
                </div>
              </div>
            ),
          }))}
        />
      )}
    </GlassCard>
  );
}

function timeAgo(iso: string): string {
  const diff = dayjs().diff(dayjs(iso), "minute");
  if (diff < 1) return "刚刚";
  if (diff < 60) return `${diff} 分钟前`;
  if (diff < 1440) return `${Math.floor(diff / 60)} 小时前`;
  return dayjs(iso).format("MM-DD HH:mm");
}