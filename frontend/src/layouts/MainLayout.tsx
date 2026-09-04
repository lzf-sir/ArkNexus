import { Layout, Menu, Avatar, Dropdown, Tag, Button, Tooltip } from "antd";
import {
  LayoutDashboard,
  Mail,
  Bot,
  Settings as SettingsIcon,
  Code2,
  LogOut,
  User,
  MessageSquare,
  Link2,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { App as AntApp } from "antd";
import { useAuth } from "../apps/auth/AuthContext";
import { useTheme, type ThemeMode } from "../theme/ThemeContext";
import { CommandPalette } from "../components/CommandPalette";

const { Header, Sider, Content } = Layout;

const navItems = [
  {
    key: "/",
    icon: <LayoutDashboard size={18} strokeWidth={1.8} />,
    label: <Link to="/">概览</Link>,
  },
  {
    key: "/ai",
    icon: <Bot size={18} strokeWidth={1.8} />,
    label: "AI 助手",
    children: [
      {
        key: "/ai/chat",
        icon: <MessageSquare size={16} strokeWidth={1.8} />,
        label: <Link to="/ai/chat">AI 会话</Link>,
      },
    ],
  },
  {
    key: "/email",
    icon: <Mail size={18} strokeWidth={1.8} />,
    label: <Link to="/email">临时邮箱</Link>,
  },
  {
    key: "/settings",
    icon: <SettingsIcon size={18} strokeWidth={1.8} />,
    label: <Link to="/settings">系统设置</Link>,
  },
];

export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { message } = AntApp.useApp();
  const { mode, setMode, resolved } = useTheme();

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

  const themeOptions: { key: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { key: "light", label: "浅色", icon: <Sun size={14} strokeWidth={1.8} /> },
    { key: "dark", label: "深色", icon: <Moon size={14} strokeWidth={1.8} /> },
    { key: "system", label: "跟随系统", icon: <Monitor size={14} strokeWidth={1.8} /> },
  ];

  return (
    <Layout style={{ minHeight: "100vh", background: "#f5f5f7" }}>
      {/* Frosted glass sidebar */}
      <Sider
        width={240}
        breakpoint="lg"
        collapsedWidth={72}
        className="glass-sidebar"
        style={{
          borderRight: "1px solid rgba(0,0,0,0.06)",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "auto",
        }}
      >
        {/* Brand */}
        <div
          style={{
            height: 56,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 20px",
            borderBottom: "1px solid rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, #0071e3 0%, #42a1ec 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(0,113,227,0.25)",
            }}
          >
            <Link2 size={18} color="#fff" strokeWidth={2.5} />
          </div>
          <span
            style={{
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#1d1d1f",
            }}
          >
            ArkNexus
          </span>
        </div>

        {/* Navigation */}
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={navItems}
          style={{
            background: "transparent",
            borderRight: "none",
            padding: "12px 0",
          }}
        />
      </Sider>

      <Layout style={{ background: "transparent" }}>
        {/* Frosted glass header */}
        <Header
          className="glass-header"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 100,
            height: 56,
            lineHeight: "56px",
            borderBottom: "1px solid rgba(0,0,0,0.04)",
            paddingInline: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: "#1d1d1f",
            }}
          >
            个人超级工作台
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <Tag
              style={{
                margin: 0,
                borderRadius: 980,
                background: "rgba(0,113,227,0.08)",
                border: "none",
                color: "#0071e3",
                fontSize: 12,
                fontWeight: 500,
                padding: "2px 12px",
              }}
            >
              30 天保留
            </Tag>
            <Dropdown
              menu={{
                items: themeOptions.map((opt) => ({
                  key: opt.key,
                  icon: opt.icon,
                  label: (
                    <span>
                      {opt.label}
                      {mode === opt.key && (
                        <span style={{ marginLeft: 8, color: "var(--apple-blue)" }}>✓</span>
                      )}
                    </span>
                  ),
                  onClick: () => setMode(opt.key),
                })),
              }}
              trigger={["click"]}
            >
              <Tooltip title="主题">
                <Button
                  type="text"
                  size="small"
                  icon={
                    resolved === "dark" ? (
                      <Moon size={15} strokeWidth={1.8} />
                    ) : (
                      <Sun size={15} strokeWidth={1.8} />
                    )
                  }
                  style={{
                    width: 32,
                    height: 32,
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 8,
                    color: "var(--apple-gray)",
                  }}
                />
              </Tooltip>
            </Dropdown>
            <a
              href="https://github.com/"
              target="_blank"
              rel="noreferrer"
              style={{
                color: "#86868b",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "color 0.2s",
              }}
              className="hover:!text-[#0071e3]"
            >
              <Code2 size={15} strokeWidth={1.8} />
              GitHub
            </a>
            {user && (
              <Dropdown
                menu={{
                  items: [
                    {
                      key: "profile",
                      icon: <User size={14} strokeWidth={1.8} />,
                      label: "个人资料",
                      onClick: () => navigate("/profile"),
                    },
                    { type: "divider" },
                    {
                      key: "logout",
                      icon: <LogOut size={14} strokeWidth={1.8} />,
                      label: "登出",
                      onClick: onLogout,
                    },
                  ],
                }}
                trigger={["click"]}
              >
                <div
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "4px 8px",
                    borderRadius: 980,
                    transition: "background 0.2s",
                  }}
                  className="hover:bg-[rgba(0,0,0,0.04)]"
                >
                  <Avatar
                    size={30}
                    style={{
                      backgroundColor: "linear-gradient(135deg, #0071e3, #42a1ec)",
                      background: "linear-gradient(135deg, #0071e3 0%, #42a1ec 100%)",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {(user.display_name || user.email)[0]?.toUpperCase()}
                  </Avatar>
                  <span style={{ fontSize: 13, color: "#1d1d1f", fontWeight: 500 }}>
                    {user.display_name || user.email}
                  </span>
                </div>
              </Dropdown>
            )}
          </div>
        </Header>

        {/* Content area */}
        <Content
          style={{
            padding: 24,
            minHeight: "calc(100vh - 56px)",
          }}
        >
          <Outlet />
        </Content>
      </Layout>

      <CommandPalette />
    </Layout>
  );
}
