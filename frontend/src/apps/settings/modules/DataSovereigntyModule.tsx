// Data Sovereignty settings module — export + import endpoints for the email
// and AI services. Single-page UI inside Settings → 数据主权.
//
// UX flow:
//   - Two big buttons: 导出邮件数据 / 导出 AI 会话 (each downloads its own zip)
//   - A "一键导出全部" button that triggers both downloads in parallel
//   - An "导入邮件" drag-drop / file picker that POSTs to / /api/v1/system/import/mbox

import { Alert, Button, Card, Progress, Space, Typography, Upload, message } from "antd";
import {
  Download,
  Upload as UploadIcon,
  FileArchive,
  Sparkles,
  Mail,
  Database,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";
import { api, getToken } from "@/lib/api";
import type { UploadProps } from "antd";

const { Text, Paragraph, Title: TitleText } = Typography;

interface ExportMeta {
  label: string;
  icon: React.ReactNode;
  endpoint: string;
  filenamePrefix: string;
  description: string;
}

const TARGETS: ExportMeta[] = [
  {
    label: "邮件数据",
    icon: <Mail size={16} strokeWidth={1.8} />,
    endpoint: "/system/export",
    filenamePrefix: "arknexus-export",
    description: "所有邮箱、邮件（含附件）、文件夹、labels。mbox 格式可直接导入 Thunderbird / Apple Mail。",
  },
  {
    label: "AI 会话",
    icon: <Sparkles size={16} strokeWidth={1.8} />,
    endpoint: "/ai/system/export",
    filenamePrefix: "arknexus-ai-export",
    description: "所有 AI 对话的完整消息记录、模型参数、系统提示词（不含 API Key）。",
  },
];

async function downloadZip(meta: ExportMeta): Promise<{ count?: string; ok: boolean }> {
  try {
    const token = getToken();
    const res = await fetch(resolveUrl(meta.endpoint), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    // Read X-Export-Count-* headers (best-effort).
    const countMessages =
      res.headers.get("X-Export-Count-Messages") ||
      res.headers.get("X-Export-Count-Conversations") ||
      "";

    const blob = await res.blob();
    // Pick a filename from the Content-Disposition header if present.
    const cd = res.headers.get("Content-Disposition") || "";
    const match = cd.match(/filename="?([^";]+)"?/);
    const filename = match?.[1] || `${meta.filenamePrefix}-${stamp()}.zip`;

    triggerDownload(blob, filename);
    return { count: countMessages, ok: true };
  } catch (e) {
    return { ok: false };
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

function resolveUrl(endpoint: string): string {
  // Mirror lib/api.ts logic — use the configured base if present.
  const fromBuild = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
  if (fromBuild) return `${fromBuild.replace(/\/+$/, "")}${endpoint}`;
  const fromWindow = (window as unknown as { __ARK_NEXUS_API_BASE__?: string }).__ARK_NEXUS_API_BASE__;
  const base =
    typeof fromWindow === "string" && fromWindow.trim()
      ? fromWindow.trim().replace(/\/+$/, "")
      : "/api/v1";
  return `${base}${endpoint}`;
}

function stamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  target_mailbox_id: string;
}

export function DataSovereigntyModule() {
  const [exporting, setExporting] = useState<Record<string, boolean>>({});
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<number | null>(null);

  const exportOne = async (meta: ExportMeta) => {
    setExporting((m) => ({ ...m, [meta.label]: true }));
    try {
      const { ok, count } = await downloadZip(meta);
      if (ok) {
        const detail = count ? `（${count} 条记录）` : "";
        message.success(`${meta.label} 导出完成 ${detail}`);
      } else {
        message.error(`${meta.label} 导出失败`);
      }
    } finally {
      setExporting((m) => ({ ...m, [meta.label]: false }));
    }
  };

  const exportAll = async () => {
    setExporting((m) => {
      const next = { ...m };
      TARGETS.forEach((t) => (next[t.label] = true));
      return next;
    });
    try {
      const results = await Promise.all(TARGETS.map((t) => downloadZip(t)));
      const ok = results.filter((r) => r.ok).length;
      if (ok === TARGETS.length) {
        message.success("全部数据导出完成（已下载 2 个 zip 文件）");
      } else {
        message.warning(`部分导出失败：${ok}/${TARGETS.length} 成功`);
      }
    } finally {
      setExporting((m) => {
        const next = { ...m };
        TARGETS.forEach((t) => (next[t.label] = false));
        return next;
      });
    }
  };

  const uploadProps: UploadProps = {
    name: "file",
    accept: ".mbox,.zip,application/mbox,application/zip",
    maxCount: 1,
    showUploadList: false,
    beforeUpload: async (file) => {
      setImporting(true);
      setImportProgress(20);
      try {
        const form = new FormData();
        form.append("file", file);
        setImportProgress(50);
        const res = await api.post<ImportResult>("/system/import/mbox", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setImportProgress(100);
        message.success(
          `导入完成：${res.data.imported} 条成功${res.data.skipped ? `，${res.data.skipped} 跳过` : ""}${res.data.errors ? `，${res.data.errors} 失败` : ""}`
        );
      } catch (err) {
        message.error(`导入失败：${(err as Error).message}`);
      } finally {
        setImporting(false);
        setTimeout(() => setImportProgress(null), 800);
      }
      return false; // prevent antd's default upload
    },
  };

  return (
    <div className="apple-fade-in" style={{ maxWidth: 880 }}>
      <TitleText level={4} style={{ marginTop: 0, letterSpacing: "-0.01em" }}>
        <Database size={18} strokeWidth={1.8} style={{ verticalAlign: "text-bottom", marginRight: 6 }} />
        数据主权
      </TitleText>
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        所有数据始终保存在你自己的服务器上。你可以随时导出全部数据备份，或从 .mbox / Gmail Takeout .zip 导入历史邮件。
      </Paragraph>

      {/* Export cards */}
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        {TARGETS.map((t) => (
          <Card
            key={t.label}
            className="apple-card"
            style={{ borderRadius: 14 }}
            styles={{ body: { padding: 16 } }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  flexShrink: 0,
                  background: "linear-gradient(135deg, #0071e3 0%, #42a1ec 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {t.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text strong style={{ fontSize: 15 }}>
                  {t.label}
                </Text>
                <Paragraph
                  type="secondary"
                  style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.5 }}
                >
                  {t.description}
                </Paragraph>
              </div>
              <Button
                type="primary"
                icon={<Download size={14} strokeWidth={2} />}
                loading={exporting[t.label]}
                onClick={() => exportOne(t)}
                style={{ borderRadius: 10 }}
              >
                导出
              </Button>
            </div>
          </Card>
        ))}

        {/* Bulk export */}
        <Card
          className="apple-card"
          style={{
            borderRadius: 14,
            background: "linear-gradient(135deg, rgba(0,113,227,0.04), rgba(66,161,236,0.04))",
          }}
          styles={{ body: { padding: 16 } }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "#fff",
                border: "1px solid rgba(0,113,227,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FileArchive size={18} strokeWidth={1.8} color="#0071e3" />
            </div>
            <div style={{ flex: 1 }}>
              <Text strong style={{ fontSize: 15 }}>
                一键导出全部
              </Text>
              <Paragraph
                type="secondary"
                style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.5 }}
              >
                同时导出 2 个 zip（邮件 + AI 会话）。浏览器会请求两次下载权限。
              </Paragraph>
            </div>
            <Button
              type="primary"
              icon={<Download size={14} strokeWidth={2} />}
              loading={Object.values(exporting).some(Boolean)}
              onClick={exportAll}
              style={{ borderRadius: 10, background: "#0071e3" }}
            >
              一键导出
            </Button>
          </div>
        </Card>
      </Space>

      {/* Import */}
      <TitleText
        level={5}
        style={{ marginTop: 32, marginBottom: 12, letterSpacing: "-0.01em" }}
      >
        <UploadIcon size={16} strokeWidth={1.8} style={{ verticalAlign: "text-bottom", marginRight: 6 }} />
        导入邮件
      </TitleText>
      <Card
        className="apple-card"
        style={{ borderRadius: 14 }}
        styles={{ body: { padding: 16 } }}
      >
        <Paragraph type="secondary" style={{ marginTop: 0, fontSize: 13, lineHeight: 1.6 }}>
          支持 <Text code>.mbox</Text> 文件（Thunderbird / Apple Mail / mutt 导出）和{" "}
          <Text code>.zip</Text> 文件（Gmail Takeout 会自动按标签分组导入到独立邮箱）。
        </Paragraph>

        <Upload.Dragger {...uploadProps} disabled={importing} style={{ borderRadius: 12 }}>
          <p style={{ margin: "12px 0" }}>
            <UploadIcon size={28} strokeWidth={1.6} style={{ color: "#0071e3" }} />
          </p>
          <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>
            {importing ? "导入中…" : "点击或拖拽 .mbox / .zip 文件到这里"}
          </p>
          <p style={{ fontSize: 12, color: "#86868b", margin: "6px 0 0" }}>
            支持 Thunderbird / Gmail Takeout / Apple Mail / mutt 导出
          </p>
        </Upload.Dragger>

        {importProgress !== null && (
          <div style={{ marginTop: 14 }}>
            <Progress
              percent={importProgress}
              showInfo={false}
              strokeColor="#0071e3"
              trailColor="rgba(0,0,0,0.04)"
            />
            {importProgress === 100 && (
              <Text type="success" style={{ fontSize: 13, display: "block", marginTop: 6 }}>
                <CheckCircle2 size={13} strokeWidth={2} style={{ verticalAlign: "text-bottom", marginRight: 4 }} />
                导入完成
              </Text>
            )}
          </div>
        )}
      </Card>

      <Alert
        type="info"
        showIcon
        style={{ marginTop: 20, borderRadius: 12 }}
        message="数据格式说明"
        description={
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, fontSize: 13 }}>
            <li>导出文件为 zip，内含 manifest.json / messages/ / mbox/all.mbox 等</li>
            <li>mbox 文件可直接拖入 Thunderbird 「Local Folders」完成恢复</li>
            <li>JSON 树是无损的，可在未来通过同样的导入接口完整还原到 ArkNexus</li>
            <li>导入不会覆盖现有邮件，按 receive time 追加</li>
          </ul>
        }
      />
    </div>
  );
}