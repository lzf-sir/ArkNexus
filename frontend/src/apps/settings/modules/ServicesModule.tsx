import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, Empty, Skeleton, Space } from "antd";
import { useState } from "react";
import {
  ServiceCard,
  ServiceConfigsPanel,
  statusTag,
} from "../components/ServiceConfigPanel";
import {
  ServiceRead,
  deleteService,
  heartbeatService,
  listServices,
} from "../api/client";

// Services that have a dedicated settings module; exclude them here so their
// config keys aren't editable from two places.
const DEDICATED_SLUGS = new Set(["ai-service", "email-service"]);

export function ServicesModule() {
  const queryClient = useQueryClient();

  const servicesQuery = useQuery({
    queryKey: ["services"],
    queryFn: listServices,
    refetchInterval: 30_000,
  });

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const visibleServices = (servicesQuery.data ?? []).filter(
    (s) => !DEDICATED_SLUGS.has(s.slug)
  );
  const selectedService: ServiceRead | null = visibleServices.find(
    (s) => s.slug === selectedSlug
  ) ?? null;

  return (
    <div style={{ display: "flex", gap: 16 }}>
      <Card
        className="apple-card"
        style={{ width: 320, flexShrink: 0, borderRadius: 16 }}
        title={
          <span style={{ fontWeight: 600, fontSize: 16, letterSpacing: "-0.01em" }}>服务列表</span>
        }
      >
        {servicesQuery.isLoading && <Skeleton active />}
        {!servicesQuery.isLoading && visibleServices.length === 0 && (
          <Empty description="暂无其他已注册服务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
        {visibleServices.length > 0 && (
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
            {visibleServices.map((s) => (
              <ServiceCard
                key={s.slug}
                svc={s}
                selected={selectedSlug === s.slug}
                onSelect={() => setSelectedSlug(s.slug)}
                onHeartbeat={async () => {
                  try {
                    await heartbeatService(s.slug);
                    queryClient.invalidateQueries({ queryKey: ["services"] });
                  } catch (err) {
                    // surface via toast if needed
                    console.error(err);
                  }
                }}
                onDelete={async () => {
                  try {
                    await deleteService(s.slug);
                    if (selectedSlug === s.slug) setSelectedSlug(null);
                    queryClient.invalidateQueries({ queryKey: ["services"] });
                  } catch (err) {
                    console.error(err);
                  }
                }}
              />
            ))}
          </Space>
        )}
      </Card>

      <Card
        className="apple-card"
        style={{ flex: 1, borderRadius: 16 }}
        title={
          <span style={{ fontWeight: 600, fontSize: 16, letterSpacing: "-0.01em" }}>
            {selectedService ? `${selectedService.display_name} 配置` : "选择一个服务"}
          </span>
        }
        extra={
          selectedService && (
            <span style={{ fontSize: 12, color: "#86868b" }}>{statusTag(selectedService)}</span>
          )
        }
      >
        {!selectedService && (
          <Empty description="在左侧选择一个服务查看配置项" style={{ marginTop: 48 }} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
        {selectedService && <ServiceConfigsPanel slug={selectedService.slug} />}
      </Card>
    </div>
  );
}
