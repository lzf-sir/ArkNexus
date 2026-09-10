import { Button } from "antd";
import { Mail } from "lucide-react";
import { motion } from "framer-motion";
import { startOAuthLogin } from "../../api/oauth";

interface ProviderMeta {
  icon: React.ReactNode;
  label: string;
  color: string;
}

const META: Record<string, ProviderMeta> = {
  github: { icon: <GithubIcon size={18} />, label: "GitHub", color: "#24292f" },
  google: { icon: <Mail size={18} strokeWidth={1.8} />, label: "Google", color: "#4285f4" },
  microsoft: { icon: <MicrosoftIcon size={18} />, label: "Microsoft", color: "#2f2f2f" },
};

interface Props {
  providers: string[];
}

export function OAuthButtonRow({ providers }: Props) {
  if (providers.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
      {providers.map((name, idx) => {
        const meta = META[name] ?? { icon: null, label: name, color: "#86868b" };
        return (
          <motion.div
            key={name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: idx * 0.06 }}
          >
            <Button
              block
              onClick={() => startOAuthLogin(name, "/")}
              style={{
                height: 44,
                borderRadius: 12,
                background: meta.color,
                color: "#fff",
                border: "none",
                fontWeight: 500,
                fontSize: 15,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
              {meta.icon}
              使用 {meta.label} 登录
            </Button>
          </motion.div>
        );
      })}
    </div>
  );
}

function GithubIcon({ size = 18 }: { size?: number }) {
  // lucide-react v1 removed brand icons, so the GitHub mark is inlined here
  // (same approach the previous LoginPage used).
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function MicrosoftIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}
