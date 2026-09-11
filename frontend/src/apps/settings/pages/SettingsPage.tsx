import { Space, Typography } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Bot, Mail, Server, Database } from "lucide-react";
import { AIModelSettings } from "../modules/AIModelSettings";
import { EmailSettingsModule } from "../modules/EmailSettingsModule";
import { ServicesModule } from "../modules/ServicesModule";
import { DataSovereigntyModule } from "../modules/DataSovereigntyModule";
import { SettingsSidebar, type SettingsModule } from "../components/SettingsSidebar";
import { FadeIn } from "../../../components/motion/FadeIn";

const { Title, Paragraph } = Typography;

type ModuleKey = "ai" | "email" | "services" | "data";

const MODULES: SettingsModule[] = [
  { key: "ai", label: "AI 模型配置", icon: <Bot size={16} strokeWidth={1.8} />, hint: "服务商 Key、默认模型与生成参数" },
  { key: "email", label: "邮件服务", icon: <Mail size={16} strokeWidth={1.8} />, hint: "域名、SMTP 与留存策略" },
  { key: "services", label: "服务与集成", icon: <Server size={16} strokeWidth={1.8} />, hint: "其余微服务的配置项" },
  { key: "data", label: "数据主权", icon: <Database size={16} strokeWidth={1.8} />, hint: "导出 / 导入你的全部数据" },
];

export function SettingsPage() {
  const [active, setActive] = useState<ModuleKey>("ai");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get("module");
    if (m === "data" || m === "ai" || m === "email" || m === "services") {
      setActive(m);
    }
  }, []);

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <FadeIn variant="slide">
        <div>
          <Title level={3} style={{ marginBottom: 4, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>
            系统设置
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 15 }}>
            按功能模块管理 ArkNexus 的配置。左侧选择一个模块进行设置。
          </Paragraph>
        </div>
      </FadeIn>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <SettingsSidebar modules={MODULES} active={active} onSelect={(k) => setActive(k as ModuleKey)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.3 }}
            >
              <div className="glass" style={{ padding: 24, borderRadius: 18 }}>
                {active === "ai" && <AIModelSettings />}
                {active === "email" && <EmailSettingsModule />}
                {active === "services" && <ServicesModule />}
                {active === "data" && <DataSovereigntyModule />}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Space>
  );
}
