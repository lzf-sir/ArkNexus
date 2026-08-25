import { Card, Space, Tag, Typography } from "antd";
import { Mail, Plus, RefreshCw, Trash2 } from "lucide-react";
import dayjs from "dayjs";
import { useQueryClient } from "@tanstack/react-query";
import { App } from "antd";
import type { Mailbox } from "../api/client";
import { deleteMailbox } from "../api/client";
import { useState } from "react";
import { Button, Input, List, Popconfirm, Tooltip } from "antd";

const { Text } = Typography;

interface Props {
  mailboxes: Mailbox[] | undefined;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export function MailboxSidebar({
  mailboxes,
  selectedId,
  onSelect,
  onCreate,
  onRefresh,
  isLoading,
}: Props) {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const handleDelete = async (id: string, address: string) => {
    try {
      await deleteMailbox(id);
      message.success(`已删除 ${address}`);
      queryClient.invalidateQueries({ queryKey: ["mailboxes"] });
      if (selectedId === id) {
        onSelect("");
      }
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Text strong style={{ fontSize: 13, fontWeight: 600, color: "#1d1d1f", letterSpacing: "-0.01em" }}>
          邮箱
        </Text>
        <Space size={4}>
          <Tooltip title="刷新">
            <Button
              size="small"
              type="text"
              icon={<RefreshCw size={14} strokeWidth={1.8} />}
              onClick={onRefresh}
              loading={isLoading}
              style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}
            />
          </Tooltip>
          <Tooltip title="新建临时邮箱">
            <Button
              size="small"
              type="primary"
              icon={<Plus size={14} strokeWidth={2.4} />}
              onClick={onCreate}
              style={{ width: 28, height: 28, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8 }}
            />
          </Tooltip>
        </Space>
      </div>

      {/* Mailbox list */}
      <div className="apple-scroll" style={{ flex: 1, overflow: "auto", maxHeight: "40vh" }}>
        {(mailboxes ?? []).length === 0 && (
          <div style={{ padding: "16px 0", textAlign: "center", color: "#86868b", fontSize: 13 }}>
            暂无邮箱，点击右上角 + 创建
          </div>
        )}
        {(mailboxes ?? []).map((mb) => {
          const isSelected = mb.id === selectedId;
          const daysLeft = Math.max(0, dayjs(mb.expires_at).diff(dayjs(), "day"));
          return (
            <div
              key={mb.id}
              onClick={() => onSelect(mb.id)}
              style={{
                cursor: "pointer",
                padding: "10px 12px",
                borderRadius: 10,
                marginBottom: 4,
                background: isSelected ? "rgba(0,113,227,0.08)" : "transparent",
                border: isSelected
                  ? "1px solid rgba(0,113,227,0.20)"
                  : "1px solid transparent",
                transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.background = "rgba(0,0,0,0.03)";
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.background = "transparent";
              }}
            >
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: isSelected
                      ? "linear-gradient(135deg, #0071e3 0%, #42a1ec 100%)"
                      : "#f5f5f7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: isSelected ? "#fff" : "#86868b",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {mb.display_name?.[0]?.toUpperCase() ?? mb.address[0]?.toUpperCase() ?? "?"}
                </div>
                {mb.unread_count > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: -4,
                      right: -4,
                      background: "#ff3b30",
                      color: "#fff",
                      fontSize: 9,
                      fontWeight: 700,
                      minWidth: 16,
                      height: 16,
                      borderRadius: 980,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 4px",
                    }}
                  >
                    {mb.unread_count}
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Text
                    strong={isSelected}
                    ellipsis
                    title={mb.address}
                    style={{ fontSize: 13, maxWidth: 140, fontWeight: isSelected ? 600 : 500 }}
                  >
                    {mb.display_name || mb.address.split("@")[0]}
                  </Text>
                  <Popconfirm
                    title="删除该邮箱？"
                    description="该邮箱下的所有邮件、附件会被一并清理。"
                    okText="删除"
                    cancelText="取消"
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      handleDelete(mb.id, mb.address);
                    }}
                    onCancel={(e) => e?.stopPropagation()}
                  >
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<Trash2 size={13} strokeWidth={1.8} />}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: 24, height: 24, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                    />
                  </Popconfirm>
                </div>
                <div style={{ fontSize: 11, color: "#86868b", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {mb.address}
                </div>
                <div style={{ marginTop: 4 }}>
                  <Tag
                    color={daysLeft <= 3 ? "orange" : "blue"}
                    style={{ margin: 0, borderRadius: 6, fontSize: 11, padding: "1px 6px" }}
                  >
                    剩 {daysLeft} 天
                  </Tag>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
