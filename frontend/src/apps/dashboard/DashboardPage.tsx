import {
  App,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Space,
  Statistic,
  Tag,
  Timeline,
  Typography,
} from "antd";
import {
  Mail,
  Plus,
  RefreshCw,
  Pencil,
  Clock,
  Trash2,
  Activity,
  ShieldCheck,
  Zap,
  Inbox,
  Bot,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Link } from "react-router-dom";
import { listMailboxes, getStats } from "../email/api/client";
import { listServices } from "../settings/api/client";
import type { Mailbox } from "../email/api/client";
import type { ServiceRead } from "../settings/api/client";

const { Title, Paragraph, Text } = Typography;

export function DashboardPage() {
  const { message } = App.useApp();

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
  const recentMailboxes = [...mailboxes]
    .sort((a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf())
    .slice(0, 5);

  const services = servicesQuery.data ?? [];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }} className="apple-fade-in">
      {/* Page header */}
      <div>
        <Title level={3} style={{ marginBottom: 4, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>
          概览
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0, color: "#86868b", fontSize: 15 }}>
          快速了解 ArkNexus 当前状态。
        </Paragraph>
      </div>

      {/* Stats cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="apple-card" style={{ borderRadius: 16 }}>
            <Statistic
              title={
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#86868b", fontSize: 13, fontWeight: 500 }}>
                  <Inbox size={15} strokeWidth={1.8} /> 活跃邮箱
                </span>
              }
              value={mailboxes.length}
              valueStyle={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", color: "#1d1d1f" }}
              suffix={
                <Button
                  type="link"
                  size="small"
                  icon={<Plus size={14} strokeWidth={2} />}
                  onClick={() => (window.location.href = "/email")}
                  style={{ fontSize: 13, padding: 0, height: "auto" }}
                >
                  新建
                </Button>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="apple-card" style={{ borderRadius: 16 }}>
            <Statistic
              title={
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#86868b", fontSize: 13, fontWeight: 500 }}>
                  <Mail size={15} strokeWidth={1.8} /> 总邮件数
                </span>
              }
              value={totalMessages}
              loading={mailboxesQuery.isLoading}
              valueStyle={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", color: "#1d1d1f" }}
            />
            <Text style={{ fontSize: 12, color: "#86868b" }}>30 天内</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="apple-card" style={{ borderRadius: 16 }}>
            <Statistic
              title={
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#86868b", fontSize: 13, fontWeight: 500 }}>
                  <Activity size={15} strokeWidth={1.8} /> 未读邮件
                </span>
              }
              value={totalUnread}
              valueStyle={{
                fontSize: 32,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: totalUnread > 0 ? "#ff3b30" : "#1d1d1f",
              }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="apple-card" style={{ borderRadius: 16 }}>
            <Statistic
              title={
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#86868b", fontSize: 13, fontWeight: 500 }}>
                  <ShieldCheck size={15} strokeWidth={1.8} /> 数据保留
                </span>
              }
              value={statsQuery.data?.retention_days ?? "—"}
              suffix="天"
              valueStyle={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", color: "#1d1d1f" }}
            />
            <Text style={{ fontSize: 12, color: "#86868b" }}>到期自动清理</Text>
          </Card>
        </Col>
      </Row>

      {/* Main content row */}
      <Row gutter={[16, 16]}>
        {/* Recent mailboxes */}
        <Col xs={24} lg={14}>
          <Card
            className="apple-card"
            style={{ borderRadius: 16, height: "100%" }}
            title={
              <span style={{ fontWeight: 600, letterSpacing: "-0.01em", fontSize: 16 }}>
                最近创建的邮箱
              </span>
            }
            extra={
              <Link to="/email">
                <Button size="small" type="link">
                  全部 <Pencil size={13} strokeWidth={2} style={{ marginLeft: 2 }} />
                </Button>
              </Link>
            }
          >
            {recentMailboxes.length === 0 ? (
              <Empty
                description="还没有邮箱"
                style={{ padding: "40px 0" }}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <Space direction="vertical" size={10} style={{ width: "100%" }}>
                {recentMailboxes.map((m, idx) => (
                  <div
                    key={m.id}
                    className="apple-card-flat"
                    style={{
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#f5f5f7";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "var(--apple-surface)";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: "linear-gradient(135deg, #0071e3 0%, #42a1ec 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontSize: 13,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {m.display_name?.[0]?.toUpperCase() ?? m.address[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "#1d1d1f", fontSize: 14 }}>
                          {m.display_name || m.address.split("@")[0]}
                        </div>
                        <div style={{ fontSize: 12, color: "#86868b", marginTop: 1 }}>
                          {m.address} · 创建于 {dayjs(m.created_at).format("MM-DD HH:mm")}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {m.unread_count > 0 && (
                        <Badge
                          count={m.unread_count}
                          style={{
                            backgroundColor: "#0071e3",
                            fontSize: 11,
                          }}
                        />
                      )}
                      <Tag style={{ borderRadius: 6, margin: 0, fontSize: 12 }}>{m.message_count} 封</Tag>
                      <Tag
                        color={Math.max(0, dayjs(m.expires_at).diff(dayjs(), "day")) <= 3 ? "orange" : "blue"}
                        style={{ margin: 0, borderRadius: 6, fontSize: 12 }}
                      >
                        {Math.max(0, dayjs(m.expires_at).diff(dayjs(), "day"))} 天后过期
                      </Tag>
                    </div>
                  </div>
                ))}
              </Space>
            )}
          </Card>
        </Col>

        {/* Services + quick actions */}
        <Col xs={24} lg={10}>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Card
              className="apple-card"
              style={{ borderRadius: 16 }}
              title={
                <span style={{ fontWeight: 600, letterSpacing: "-0.01em", fontSize: 16 }}>
                  微服务状态
                </span>
              }
            >
              {servicesQuery.isLoading ? (
                <Text style={{ color: "#86868b" }}>加载中...</Text>
              ) : services.length === 0 ? (
                <Empty description="暂无已注册服务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Timeline
                  items={services.map((svc) => ({
                    color: svc.is_online ? "green" : "red",
                    dot: svc.is_online ? (
                      <Badge status="processing" />
                    ) : (
                      <Badge status="error" />
                    ),
                    children: (
                      <div>
                        <div style={{ fontWeight: 600, color: "#1d1d1f", fontSize: 14 }}>
                          {svc.display_name}
                        </div>
                        <div style={{ fontSize: 12, color: "#86868b", marginTop: 2 }}>
                          <code>{svc.slug}</code>
                          {svc.version ? ` · v${svc.version}` : ""}
                        </div>
                        <div style={{ fontSize: 12, color: "#86868b", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                          <Clock size={11} strokeWidth={1.8} /> {timeAgo(svc.last_heartbeat_at)}
                        </div>
                      </div>
                    ),
                  }))}
                />
              )}
            </Card>

            <Card
              className="apple-card"
              style={{ borderRadius: 16 }}
              title={
                <span style={{ fontWeight: 600, letterSpacing: "-0.01em", fontSize: 16 }}>
                  快速操作
                </span>
              }
            >
              <Space wrap size={[8, 8]}>
                <Link to="/email">
                  <Button type="primary" icon={<Plus size={15} strokeWidth={2} />} style={{ borderRadius: 980 }}>
                    新建临时邮箱
                  </Button>
                </Link>
                <Button
                  icon={<Pencil size={15} strokeWidth={2} />}
                  onClick={() => message.info("请进入「临时邮箱 → 左侧邮箱 → 写邮件」创建草稿")}
                  style={{ borderRadius: 980 }}
                >
                  写邮件
                </Button>
                <Link to="/ai/chat">
                  <Button icon={<Bot size={15} strokeWidth={2} />} style={{ borderRadius: 980 }}>
                    AI 会话
                  </Button>
                </Link>
                <Link to="/settings">
                  <Button icon={<Mail size={15} strokeWidth={2} />} style={{ borderRadius: 980 }}>
                    系统设置
                  </Button>
                </Link>
                <Button
                  icon={<RefreshCw size={15} strokeWidth={2} />}
                  onClick={() => {
                    mailboxesQuery.refetch();
                    statsQuery.refetch();
                    servicesQuery.refetch();
                    void message;
                  }}
                  style={{ borderRadius: 980 }}
                >
                  刷新
                </Button>
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>
    </Space>
  );
}

function timeAgo(iso: string): string {
  const diff = dayjs().diff(dayjs(iso), "minute");
  if (diff < 1) return "刚刚";
  if (diff < 60) return `${diff} 分钟前`;
  if (diff < 1440) return `${Math.floor(diff / 60)} 小时前`;
  return dayjs(iso).format("MM-DD HH:mm");
}
