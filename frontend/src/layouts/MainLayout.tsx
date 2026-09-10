import { Layout, Avatar, Dropdown, Button, Tooltip, Drawer } from "antd";
import {
  LayoutDashboard,
  Mail,
  Bot,
  Settings as SettingsIcon,
  User,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Menu as MenuIcon,
} from "lucide-react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { App as AntApp } from "antd";
import { useAuth } from "../apps/auth/AuthContext";
import { useTheme } from "../theme/ThemeProvider";
import { CollapsibleSidebar, type SidebarItem } from "./CollapsibleSidebar";
import { CommandPalette } from "../components/CommandPalette";
import { PwaInstallBanner } from "../components/PwaInstallBanner";
import { NotificationCenter } from "../components/NotificationCenter";

const { Header, Content } = Layout;

const navItems: SidebarItem[] = [
  { key: "/", label: "概览", icon: <LayoutDashboard size={18} strokeWidth={1.8} />, to: "/" },
  { key: "/ai", label: "AI 助手", icon: <Bot size={18} strokeWidth={1.8} />, to: "/ai/chat" },
  { key: "/email", label: "临时邮箱", icon: <Mail size={18} strokeWidth={1.8} />, to: "/email" },
  { key: "/settings", label: "系统设置", icon: <SettingsIcon size={18} strokeWidth={1.8} />, to: "/settings" },
];

export function MainLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { message } = AntApp.useApp();
  const { setMode, resolved } = useTheme();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const onLogout = () => {
    logout();
    message.success("已登出");
    navigate("/login", { replace: true });
  };

  return (
    <Layout style={{ minHeight: "100vh", background: "transparent" }}>
      <CollapsibleSidebar
        items={navItems}
        brand="ArkNexus"
        footer={
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 4px" }}>
            <Tooltip title="主题">
              <Dropdown
                menu={{
                  items: [
                    { key: "light", icon: <Sun size={14} strokeWidth={1.8} />, label: "浅色", onClick: () => setMode("light") },
                    { key: "dark", icon: <Moon size={14} strokeWidth={1.8} />, label: "深色", onClick: () => setMode("dark") },
                    { key: "system", icon: <Monitor size={14} strokeWidth={1.8} />, label: "跟随系统", onClick: () => setMode("system") },
                  ],
                }}
                trigger={["click"]}
              >
                <Button
                  type="text"
                  size="small"
                  icon={resolved === "dark" ? <Moon size={15} strokeWidth={1.8} /> : <Sun size={15} strokeWidth={1.8} />}
                  style={{ width: 32, height: 32, padding: 0, borderRadius: 8 }}
                />
              </Dropdown>
            </Tooltip>
          </div>
        }
      />

      <Layout style={{ background: "transparent" }}>
        <Header
          className="glass"
          style={{
            position: "sticky",
            top: 12,
            zIndex: 100,
            height: 56,
            margin: "12px 16px 0 16px",
            borderRadius: 14,
            paddingInline: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Button
              type="text"
              size="small"
              icon={<MenuIcon size={18} strokeWidth={1.8} />}
              onClick={() => setMobileNavOpen(true)}
              className="mobile-only"
              style={{ width: 32, height: 32, padding: 0, display: "none", borderRadius: 8 }}
              aria-label="打开菜单"
            />
            <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>
              个人超级工作台
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {user && (
              <Dropdown
                menu={{
                  items: [
                    { key: "profile", icon: <User size={14} strokeWidth={1.8} />, label: "个人资料", onClick: () => navigate("/profile") },
                    { type: "divider" },
                    { key: "logout", icon: <LogOut size={14} strokeWidth={1.8} />, label: "登出", onClick: onLogout },
                  ],
                }}
                trigger={["click"]}
              >
                <div style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", borderRadius: 999 }}>
                  <Avatar
                    size={30}
                    style={{
                      background: "linear-gradient(135deg, #007AFF, #9650FF)",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {(user.display_name || user.email)[0]?.toUpperCase()}
                  </Avatar>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>
                    {user.display_name || user.email}
                  </span>
                </div>
              </Dropdown>
            )}
          </div>
        </Header>

        <Content style={{ padding: 24, minHeight: "calc(100vh - 80px)" }}>
          <Outlet />
        </Content>
      </Layout>

      <CommandPalette />
      <PwaInstallBanner />
      <NotificationCenter />

      <Drawer
        title="ArkNexus"
        placement="left"
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        width={260}
      >
        {/* mobile menu items - simplified version of navItems */}
        {navItems.map((item) => (
          <Link
            key={item.key}
            to={item.to ?? item.key}
            onClick={() => setMobileNavOpen(false)}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, color: "inherit" }}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </Drawer>
    </Layout>
  );
}
