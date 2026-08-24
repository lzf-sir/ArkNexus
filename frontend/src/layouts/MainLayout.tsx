import { Layout, Menu, theme, Avatar, Space, Dropdown, Tag } from "antd";
import {
  DashboardOutlined,
  MailOutlined,
  RobotOutlined,
  SettingOutlined,
  GithubOutlined,
  LogoutOutlined,
  UserOutlined,
  MessageOutlined,
} from "@ant-design/icons";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { App as AntApp } from "antd";
import { useAuth } from "../apps/auth/AuthContext";

const { Header, Sider, Content, Footer: AntDesignFooter } = Layout;

// First-level menu "AI 助手" with a single sub-entry "AI 会话".
const navItems = [
  { key: "/", icon: <DashboardOutlined />, label: <Link to="/">概览</Link> },
  {
    key: "/ai",
    icon: <RobotOutlined />,
    label: "AI 助手",
    children: [
      {
        key: "/ai/chat",
        icon: <MessageOutlined />,
        label: <Link to="/ai/chat">AI 会话</Link>,
      },
    ],
  },
  { key: "/email", icon: <MailOutlined />, label: <Link to="/email">临时邮箱</Link> },
  { key: "/settings", icon: <SettingOutlined />, label: <Link to="/settings">系统设置</Link> },
];

export function MainLayout() {
  const { token } = theme.useToken();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { message } = AntApp.useApp();

  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith("/ai")) return "/ai";
    if (location.pathname.startsWith("/email")) return "/email";
    if (location.pathname.startsWith("/settings")) return "/settings";
    return "/";
  }, [location.pathname]);

  const onLogout = () => {
    logout();
    message.success("已登出");
    navigate("/login", { replace: true });
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        breakpoint="lg"
        collapsedWidth={64}
        style={{
          background: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div
          style={{
            height: 48,
            margin: 16,
            fontSize: 18,
            fontWeight: 600,
            color: token.colorPrimary,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 22 }}>⛓</span> ArkNexus
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={navItems}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            paddingInline: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              height: "100%",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 500 }}>个人超级工作台</div>
            <Space size="large">
              <Tag color="geekblue" style={{ margin: 0 }}>
                30 天保留
              </Tag>
              <a
                href="https://github.com/"
                target="_blank"
                rel="noreferrer"
                style={{ color: token.colorTextSecondary, fontSize: 13 }}
              >
                <GithubOutlined /> ArkNexus
              </a>
              {user && (
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: "logout",
                        icon: <LogoutOutlined />,
                        label: "登出",
                        onClick: onLogout,
                      },
                    ],
                  }}
                  trigger={["click"]}
                >
                  <Space style={{ cursor: "pointer" }}>
                    <Avatar
                      size={28}
                      icon={<UserOutlined />}
                      style={{ backgroundColor: token.colorPrimary }}
                    />
                    <span style={{ fontSize: 13 }}>
                      {user.display_name || user.email}
                    </span>
                  </Space>
                </Dropdown>
              )}
            </Space>
          </div>
        </Header>
        <Content style={{ padding: 24, background: token.colorBgLayout }}>
          <Outlet />
        </Content>
        <AntDesignFooter style={{ textAlign: "center", background: token.colorBgContainer }}>
          ArkNexus · 临时邮箱 + AI 助手 · 数据保留 30 天
        </AntDesignFooter>
      </Layout>
    </Layout>
  );
}
