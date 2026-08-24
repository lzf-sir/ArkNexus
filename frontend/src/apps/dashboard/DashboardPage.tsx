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
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  MailOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Link } from "react-router-dom";
import { listMailboxes, getStats } from "../email/api/client";
import { listServices } from "../settings/api/client";
import type { Mailbox  } from "../email/api/client";
import type { ServiceRead  } from "../settings/api/client";

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
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          概览
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          快速了解 ArkNexus 当前状态。
        </Paragraph>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="活跃邮箱"
              value={mailboxes.length}
              prefix={<MailOutlined />}
              suffix={
                <Button
                  type="link"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => (window.location.href = "/email")}
                >
                  新建
                </Button>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总邮件数"
              value={totalMessages}
              loading={mailboxesQuery.isLoading}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              30 天内
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="未读邮件"
              value={totalUnread}
              valueStyle={{ color: totalUnread > 0 ? "#cf1322" : undefined }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="数据保留"
              value={statsQuery.data?.retention_days ?? "—"}
              suffix="天"
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              到期自动清理
            </Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title="最近创建的邮箱"
            extra={
              <Link to="/email">
                <Button size="small" type="link">
                  全部 <EditOutlined />
                </Button>
              </Link>
            }
          >
            {recentMailboxes.length === 0 ? (
              <Empty description="还没有邮箱" />
            ) : (
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                {recentMailboxes.map((m) => (
                  <Card
                    key={m.id}
                    size="small"
                    styles={{ body: { padding: 12 } }}
                  >
                    <Space
                      style={{ width: "100%", justifyContent: "space-between" }}
                    >
                      <Space direction="vertical" size={0}>
                        <Text strong>{m.address}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {m.display_name || "（未命名）"} · 创建于{" "}
                          {dayjs(m.created_at).format("MM-DD HH:mm")}
                        </Text>
                      </Space>
                      <Space>
                        <Badge count={m.unread_count} size="small">
                          <Tag>{m.message_count} 封</Tag>
                        </Badge>
                        <Tag color="gold">{Math.max(0, dayjs(m.expires_at).diff(dayjs(), "day"))} 天后过期</Tag>
                      </Space>
                    </Space>
                  </Card>
                ))}
              </Space>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="微服务状态">
            {servicesQuery.isLoading ? (
              <Text type="secondary">加载中...</Text>
            ) : services.length === 0 ? (
              <Empty description="暂无已注册服务" />
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
                    <Space direction="vertical" size={0}>
                      <Text strong>{svc.display_name}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        <code>{svc.slug}</code>
                        {svc.version ? ` · v${svc.version}` : ""}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        <ClockCircleOutlined /> {timeAgo(svc.last_heartbeat_at)}
                      </Text>
                    </Space>
                  ),
                }))}
              />
            )}
          </Card>

          <Card title="快速操作" style={{ marginTop: 16 }}>
            <Space wrap>
              <Link to="/email">
                <Button type="primary" icon={<PlusOutlined />}>
                  新建临时邮箱
                </Button>
              </Link>
              <Link to="/email/compose">
                <Button icon={<EditOutlined />}>写邮件</Button>
              </Link>
              <Link to="/settings">
                <Button icon={<MailOutlined />}>系统设置</Button>
              </Link>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  mailboxesQuery.refetch();
                  statsQuery.refetch();
                  servicesQuery.refetch();
                  void message;
                }}
              >
                刷新
              </Button>
            </Space>
          </Card>
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