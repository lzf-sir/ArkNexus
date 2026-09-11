import { motion } from "framer-motion";
import { ReactNode } from "react";

export interface SettingsModule {
  key: string;
  label: string;
  icon: ReactNode;
  hint: string;
}

interface Props {
  modules: SettingsModule[];
  active: string;
  onSelect: (key: string) => void;
}

export function SettingsSidebar({ modules, active, onSelect }: Props) {
  return (
    <div
      className="glass"
      style={{
        width: 264,
        flexShrink: 0,
        borderRadius: 16,
        padding: 8,
        position: "sticky",
        top: 80,
      }}
    >
      {modules.map((m, idx) => (
        <motion.div
          key={m.key}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, delay: idx * 0.04 }}
          onClick={() => onSelect(m.key)}
          whileHover={{ x: 2 }}
          className={m.key === active ? "glass-tinted" : ""}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: "10px 12px",
            borderRadius: 10,
            cursor: "pointer",
            marginBottom: 2,
          }}
        >
          <span style={{ color: "var(--ant-color-primary, #007AFF)", flexShrink: 0, marginTop: 2 }}>{m.icon}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{m.label}</div>
            <div style={{ fontSize: 12, color: "var(--ant-color-text-tertiary, #86868b)", marginTop: 2 }}>
              {m.hint}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
