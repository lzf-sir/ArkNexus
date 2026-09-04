// In-app banner prompting the user to install ArkNexus as a PWA.
//
// Shown in MainLayout when:
// - The browser supports BeforeInstallPromptEvent (Chrome/Edge) and hasn't yet
//   installed, AND the deferred prompt is available, OR
// - We're on iOS Safari (no native prompt — we just show instructions to use
//   the share sheet → "Add to Home Screen").
//
// On dismissal we set dismissed=true in localStorage so we don't pester again.

import { Button, Modal, Space, Typography } from "antd";
import { Download, Share, X, Smartphone } from "lucide-react";
import { useState } from "react";
import { usePwaInstall } from "@/lib/pwa";

const STORAGE_KEY = "arknexus-pwa-dismissed";
const { Text } = Typography;

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function setDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function PwaInstallBanner() {
  const { canInstall, isIos, installed, promptInstall } = usePwaInstall();
  const [open, setOpen] = useState(false);

  if (installed) return null;
  if (!canInstall && !isIos) return null;
  if (wasDismissed()) return null;

  return (
    <div
      role="region"
      aria-label="PWA 安装提示"
      style={{
        position: "fixed",
        bottom: 16,
        left: 16,
        right: 16,
        maxWidth: 460,
        margin: "0 auto",
        zIndex: 1000,
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 14,
        padding: "12px 14px",
        boxShadow: "0 6px 24px rgba(0,0,0,0.10)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
      className="apple-fade-in"
    >
      <div
        style={{
          width: 36,
          height: 36,
          flexShrink: 0,
          borderRadius: 10,
          background: "linear-gradient(135deg, #0071e3 0%, #42a1ec 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Smartphone size={18} color="#fff" strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text strong style={{ fontSize: 13, display: "block", lineHeight: 1.3 }}>
          安装到主屏
        </Text>
        <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.4 }}>
          {isIos ? "iOS 用户用 Safari 分享菜单" : "像原生 App 一样使用，支持离线"}
        </Text>
      </div>
      <Space size={4}>
        <Button
          size="small"
          type="primary"
          icon={isIos ? <Share size={13} strokeWidth={2} /> : <Download size={13} strokeWidth={2} />}
          onClick={async () => {
            if (isIos) {
              setOpen(true);
            } else {
              await promptInstall();
              setDismissed();
            }
          }}
          style={{ borderRadius: 8, height: 30, fontSize: 12 }}
        >
          {isIos ? "查看步骤" : "安装"}
        </Button>
        <Button
          size="small"
          type="text"
          icon={<X size={14} strokeWidth={1.8} />}
          onClick={() => setDismissed()}
          style={{ width: 30, height: 30, padding: 0 }}
          aria-label="关闭"
        />
      </Space>

      <Modal
        open={open}
        onCancel={() => {
          setOpen(false);
          setDismissed();
        }}
        footer={null}
        title="iOS 安装步骤"
        width={360}
        centered
      >
        <ol style={{ paddingLeft: 18, lineHeight: 1.8, fontSize: 14 }}>
          <li>点击底部「分享」按钮 <Share size={13} strokeWidth={1.8} style={{ verticalAlign: "middle" }} /></li>
          <li>选择「添加到主屏幕」</li>
          <li>点击「添加」完成</li>
        </ol>
        <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 8 }}>
          安装后图标会出现在主屏，离线也能查看已缓存的邮件和 AI 会话。
        </Text>
      </Modal>
    </div>
  );
}