import { Menu, Space, Typography } from "antd";
import { Bot, Mail, Server } from "lucide-react";
import { useState } from "react";
import { AIModelSettings } from "../modules/AIModelSettings";
import { EmailSettingsModule } from "../modules/EmailSettingsModule";
import { ServicesModule } from "../modules/ServicesModule";

const { Title, Paragraph } = Typography;

type ModuleKey = "ai" | "email" | "services";

const MODULES: { key: ModuleKey; label: string; icon: React.ReactNode; hint: string }[] = [
  { key: "ai", label: "AI 模型配置", icon: <Bot size={16} strokeWidth={1.8} />, hint: "服务商 Key、默认模型与生成参数" },
  { key: "email", label: "邮件服务", icon: <Mail size={16} strokeWidth={1.8} />, hint: "域名、SMTP 与留存策略" },
  { key: "services", label: "服务与集成", icon: <Server size={16} strokeWidth={1.8} />, hint: "其余微服务的配置项" },
];

export function SettingsPage() {
  const [active, setActive] = useState<ModuleKey>("ai");

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }} className="apple-fade-in">
      <div>
        <Title level={3} style={{ marginBottom: 4, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>
          系统设置
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0, color: "#86868b", fontSize: 15 }}>
          按功能模块管理 ArkNexus 的配置。左侧选择一个模块进行设置。
        </Paragraph>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* Module navigation */}
        <div
          className="apple-card"
          style={{ width: 264, flexShrink: 0, borderRadius: 16, padding: 8 }}
        >
          <Menu
            mode="inline"
            selectedKeys={[active]}
            onClick={(e) => setActive(e.key as ModuleKey)}
            style={{ border: "none", background: "transparent" }}
            items={MODULES.map((m) => ({
              key: m.key,
              icon: m.icon,
              label: (
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: "#86868b" }}>{m.hint}</div>
                </div>
              ),
            }))}
          />
        </div>

        {/* Module content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {active === "ai" && <AIModelSettings />}
          {active === "email" && <EmailSettingsModule />}
          {active === "services" && <ServicesModule />}
        </div>
      </div>
    </Space>
  );
}
