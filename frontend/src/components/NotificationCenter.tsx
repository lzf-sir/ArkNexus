// Notification Center — bell icon in the top header, dropdown with event list.
//
// Wires up to the SSE feed exposed by useNotifications. Clicking the bell
// marks all events as read. Clicking an event navigates to the relevant page
// (new mail → /email, AI done → /ai/chat, system → no-op + toast).

import { Badge, Button, Dropdown, Empty, Tooltip, Typography, message as antdMessage } from "antd";
import {
  Bell,
  BellOff,
  Check,
  Mail,
  Sparkles,
  Info,
  CircleAlert,
  RefreshCw,
} from "lucide-react";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  useNotifications,
  type NotificationEvent,
} from "@/lib/useNotifications";

const { Text } = Typography;

function eventIcon(type: string) {
  if (type === "email.received") return <Mail size={14} strokeWidth={2} />;
  if (type.startsWith("ai.")) return <Sparkles size={14} strokeWidth={2} />;
  if (type === "system.error") return <CircleAlert size={14} strokeWidth={2} />;
  return <Info size={14} strokeWidth={2} />;
}

function eventColor(type: string): string {
  if (type === "email.received") return "#0071e3";
  if (type.startsWith("ai.")) return "#34c759";
  if (type === "system.error") return "#ff3b30";
  return "#86868b";
}

function navigateFor(event: NotificationEvent, navigate: (to: string) => void) {
  if (event.type === "email.received") {
    navigate("/email");
    return;
  }
  if (event.type.startsWith("ai.")) {
    navigate("/ai/chat");
    return;
  }
  // System events don't have a destination; show a toast as feedback.
  antdMessage.info({
    content: event.body || event.title,
    duration: 3,
  });
}

export function NotificationCenter() {
  const feed = useNotifications(true);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) feed.markAllRead();
  };

  const dropdownContent = (
    <div
      className="apple-card"
      style={{
        width: 360,
        maxHeight: 480,
        borderRadius: 14,
        boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid rgba(0,0,0,0.05)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text strong style={{ fontSize: 14 }}>
          通知
        </Text>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Tooltip title={feed.connected ? "实时连接已建立" : "正在重连…"}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                background: feed.connected ? "#34c759" : "#ff9500",
                display: "inline-block",
              }}
            />
          </Tooltip>
          <Button
            size="small"
            type="text"
            icon={<RefreshCw size={13} strokeWidth={1.8} />}
            onClick={() => feed.clear()}
            style={{ height: 26, padding: "0 8px", borderRadius: 6 }}
          >
            清空
          </Button>
        </div>
      </div>

      <div className="apple-scroll" style={{ flex: 1, overflowY: "auto" }}>
        {feed.events.length === 0 ? (
          <Empty
            description={feed.connected ? "暂无新通知" : "正在连接通知服务…"}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ marginTop: 32 }}
          />
        ) : (
          feed.events.map((evt) => (
            <div
              key={evt.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                setOpen(false);
                navigateFor(evt, navigate);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpen(false);
                  navigateFor(evt, navigate);
                }
              }}
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid rgba(0,0,0,0.04)",
                cursor: "pointer",
                display: "flex",
                gap: 10,
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,113,227,0.05)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  flexShrink: 0,
                  background: `${eventColor(evt.type)}15`,
                  color: eventColor(evt.type),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {eventIcon(evt.type)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#1d1d1f",
                    lineHeight: 1.35,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={evt.title}
                >
                  {evt.title}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#86868b",
                    marginTop: 2,
                    lineHeight: 1.4,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={evt.body}
                >
                  {evt.body}
                </div>
                <div style={{ fontSize: 11, color: "#aeaeb2", marginTop: 4 }}>
                  {dayjs(evt.created_at * 1000).format("MM-DD HH:mm:ss")}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div
        style={{
          padding: "8px 16px",
          borderTop: "1px solid rgba(0,0,0,0.05)",
          textAlign: "center",
          fontSize: 11,
          color: "#86868b",
        }}
      >
        实时通过 SSE 推送 · 关闭浏览器标签后失效
      </div>
    </div>
  );

  return (
    <Dropdown
      open={open}
      onOpenChange={onOpenChange}
      trigger={["click"]}
      placement="bottomRight"
      dropdownRender={() => dropdownContent}
    >
      <Tooltip title={feed.connected ? "通知" : "通知（连接中…）"}>
        <Badge
          count={feed.unread}
          size="small"
          offset={[-4, 2]}
          color="#ff3b30"
        >
          <Button
            type="text"
            size="small"
            icon={
              feed.connected ? (
                <Bell size={15} strokeWidth={1.8} />
              ) : (
                <BellOff size={15} strokeWidth={1.8} />
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
              color: feed.connected ? "var(--apple-gray)" : "#ff9500",
            }}
            aria-label="通知中心"
          />
        </Badge>
      </Tooltip>
    </Dropdown>
  );
}