import { Col, Row, Space, Typography } from "antd";
import { Inbox, Mail, Activity, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { FadeIn } from "../../components/motion/FadeIn";
import { listMailboxes, getStats } from "../email/api/client";
import type { Mailbox } from "../email/api/client";
import { listServices } from "../settings/api/client";
import type { ServiceRead } from "../settings/api/client";
import {
  QuickActionsCard,
  RecentMailboxesCard,
  ServicesStatusCard,
  StatsCard,
} from "./components";

const { Title, Paragraph } = Typography;

export function DashboardPage() {
  const mailboxesQuery = useQuery<Mailbox[]>({
    queryKey: ["mailboxes"],
    queryFn: () => listMailboxes(false),
    refetchInterval: 30_000,
  });
  const statsQuery = useQuery({
    queryKey: ["stats"],
    queryFn: getStats,
    refetchInterval: 30_000,
  });
  const servicesQuery = useQuery<ServiceRead[]>({
    queryKey: ["services"],
    queryFn: listServices,
    refetchInterval: 30_000,
  });

  const mailboxes = mailboxesQuery.data ?? [];
  const totalMessages = mailboxes.reduce((s, m) => s + m.message_count, 0);
  const totalUnread = mailboxes.reduce((s, m) => s + m.unread_count, 0);
  const services = servicesQuery.data ?? [];

  const refreshAll = () => {
    mailboxesQuery.refetch();
    statsQuery.refetch();
    servicesQuery.refetch();
  };

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <FadeIn variant="slide">
        <div>
          <Title level={3} style={{ marginBottom: 4, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>
            概览
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 15 }}>
            快速了解 ArkNexus 当前状态。
          </Paragraph>
        </div>
      </FadeIn>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <StatsCard
            icon={Inbox}
            title="活跃邮箱"
            value={mailboxes.length}
            delay={0}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatsCard
            icon={Mail}
            title="总邮件数"
            value={totalMessages}
            loading={mailboxesQuery.isLoading}
            footer="30 天内"
            delay={0.06}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatsCard
            icon={Activity}
            title="未读邮件"
            value={totalUnread}
            danger={totalUnread > 0}
            delay={0.12}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatsCard
            icon={ShieldCheck}
            title="数据保留"
            value={statsQuery.data?.retention_days ?? "—"}
            suffix="天"
            footer="到期自动清理"
            delay={0.18}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <RecentMailboxesCard mailboxes={mailboxes} />
        </Col>
        <Col xs={24} lg={10}>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <ServicesStatusCard services={services} loading={servicesQuery.isLoading} />
            <QuickActionsCard onRefresh={refreshAll} />
          </Space>
        </Col>
      </Row>
    </Space>
  );
}
