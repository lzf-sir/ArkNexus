import { Card } from "antd";
import { Mail } from "lucide-react";
import { ServiceConfigsPanel } from "../components/ServiceConfigPanel";

// Email service config (EMAIL_DOMAIN, SMTP_*, RETENTION_DAYS, ...) is surfaced
// here as its own function module; the generic "服务与集成" module excludes it
// to avoid duplicate editing entries.
const EMAIL_SERVICE_SLUG = "email-service";

export function EmailSettingsModule() {
  return (
    <Card className="apple-card" style={{ borderRadius: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "linear-gradient(135deg, #0071e3 0%, #42a1ec 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Mail size={16} color="#fff" strokeWidth={2} />
        </div>
        <span style={{ fontWeight: 600, fontSize: 18, letterSpacing: "-0.01em" }}>邮件服务</span>
      </div>
      <p style={{ color: "#86868b", fontSize: 14, marginTop: 4, marginBottom: 16 }}>
        临时邮箱服务的域名、SMTP 与留存策略配置。修改后写入审计日志并即时生效。
      </p>
      <ServiceConfigsPanel slug={EMAIL_SERVICE_SLUG} />
    </Card>
  );
}
