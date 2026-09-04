import { useEffect, useMemo, useState, useCallback } from "react";
import { Modal, Input, List, Tag, Typography, Empty } from "antd";
import {
  LayoutDashboard,
  Mail,
  Bot,
  Settings as SettingsIcon,
  User as UserIcon,
  Plus,
  Trash2,
  Moon,
  Sun,
  Monitor,
  Search,
  Edit3,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme, type ThemeMode } from "../theme/ThemeContext";

const { Text } = Typography;

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  group: string;
  keywords?: string;
  action: () => void | Promise<void>;
}

const Mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { setMode } = useTheme();

  // Global keyboard shortcut: Cmd+K (Mac) / Ctrl+K (others).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = Mac ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const commands = useMemo<CommandItem[]>(() => {
    const goto = (path: string) => () => {
      navigate(path);
      setOpen(false);
    };
    const setTheme = (m: ThemeMode) => () => {
      setMode(m);
      setOpen(false);
    };
    return [
      // ===== Pages =====
      { id: "go-dashboard", label: "概览", hint: "Dashboard", icon: <LayoutDashboard size={15} strokeWidth={1.8} />, group: "导航", action: goto("/") },
      { id: "go-email", label: "临时邮箱", hint: "Email inbox", icon: <Mail size={15} strokeWidth={1.8} />, group: "导航", action: goto("/email") },
      { id: "go-ai", label: "AI 会话", hint: "AI chat", icon: <Bot size={15} strokeWidth={1.8} />, group: "导航", action: goto("/ai/chat") },
      { id: "go-settings", label: "系统设置", hint: "Settings", icon: <SettingsIcon size={15} strokeWidth={1.8} />, group: "导航", action: goto("/settings") },
      { id: "go-profile", label: "个人资料", hint: "Profile", icon: <UserIcon size={15} strokeWidth={1.8} />, group: "导航", action: goto("/profile") },
      // ===== Email actions =====
      { id: "email-create-mailbox", label: "新建临时邮箱", hint: "在临时邮箱页打开创建弹窗", icon: <Plus size={15} strokeWidth={2} />, group: "邮箱", keywords: "create mailbox", action: () => { navigate("/email"); setTimeout(() => window.dispatchEvent(new CustomEvent("arknexus:open-create-mailbox")), 50); setOpen(false); } },
      // ===== Theme =====
      { id: "theme-light", label: "切换到浅色模式", icon: <Sun size={15} strokeWidth={1.8} />, group: "主题", action: setTheme("light") },
      { id: "theme-dark", label: "切换到深色模式", icon: <Moon size={15} strokeWidth={1.8} />, group: "主题", action: setTheme("dark") },
      { id: "theme-system", label: "跟随系统主题", icon: <Monitor size={15} strokeWidth={1.8} />, group: "主题", action: setTheme("system") },
    ];
  }, [navigate, setMode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => {
      const haystack = `${c.label} ${c.hint ?? ""} ${c.keywords ?? ""} ${c.group}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [commands, query]);

  const [highlight, setHighlight] = useState(0);
  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  const runAt = useCallback((idx: number) => {
    const cmd = filtered[idx];
    if (cmd) {
      void cmd.action();
    }
  }, [filtered]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        runAt(highlight);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, highlight, runAt]);

  return (
    <Modal
      open={open}
      onCancel={() => setOpen(false)}
      footer={null}
      width={560}
      destroyOnClose
      closable={false}
      styles={{ body: { padding: 0 } }}
      style={{ top: 96 }}
    >
      <div style={{ padding: 12, borderBottom: "1px solid var(--apple-border)" }}>
        <Input
          autoFocus
          allowClear
          size="large"
          prefix={<Search size={15} strokeWidth={1.8} style={{ color: "var(--apple-gray)" }} />}
          placeholder="搜索命令、跳转页面…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ border: "none", boxShadow: "none", fontSize: 15 }}
        />
      </div>
      <div style={{ maxHeight: 420, overflowY: "auto", padding: "6px 0" }}>
        {filtered.length === 0 ? (
          <Empty
            description="没有匹配的命令"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: "32px 0" }}
          />
        ) : (
          <List
            dataSource={filtered}
            renderItem={(item, idx) => (
              <List.Item
                onClick={() => runAt(idx)}
                onMouseEnter={() => setHighlight(idx)}
                style={{
                  cursor: "pointer",
                  padding: "8px 16px",
                  border: "none",
                  background: idx === highlight ? "var(--apple-gray-light)" : "transparent",
                  transition: "background 0.1s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      background: "var(--apple-gray-light)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      color: "var(--apple-gray-dark)",
                    }}
                  >
                    {item.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: "var(--apple-gray-dark)" }}>
                      {item.label}
                    </div>
                    {item.hint && (
                      <Text style={{ fontSize: 11, color: "var(--apple-gray)" }}>
                        {item.hint}
                      </Text>
                    )}
                  </div>
                  <Tag style={{ borderRadius: 6, margin: 0, fontSize: 11 }}>{item.group}</Tag>
                </div>
              </List.Item>
            )}
          />
        )}
      </div>
      <div
        style={{
          padding: "8px 12px",
          borderTop: "1px solid var(--apple-border)",
          display: "flex",
          gap: 12,
          fontSize: 11,
          color: "var(--apple-gray)",
        }}
      >
        <span><kbd style={kbdStyle}>↑↓</kbd> 选择</span>
        <span><kbd style={kbdStyle}>↵</kbd> 执行</span>
        <span><kbd style={kbdStyle}>esc</kbd> 关闭</span>
        <span style={{ marginLeft: "auto" }}>{Mac ? "⌘" : "Ctrl"}+K</span>
      </div>
    </Modal>
  );
}

const kbdStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "1px 5px",
  borderRadius: 4,
  border: "1px solid var(--apple-border)",
  background: "var(--apple-gray-light)",
  fontFamily: "ui-monospace, monospace",
  fontSize: 10,
  color: "var(--apple-gray-dark)",
  margin: "0 2px",
};
