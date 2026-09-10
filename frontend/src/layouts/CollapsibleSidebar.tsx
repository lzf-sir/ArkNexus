// frontend/src/layouts/CollapsibleSidebar.tsx
import { motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { ReactNode, useState } from "react";
import { transitions, EASE_LIQUID } from "../components/motion/motionPresets";

export interface SidebarItem {
  key: string;
  label: string;
  icon: ReactNode;
  /** Route path; defaults to `key` when omitted. */
  to?: string;
}

interface Props {
  items: SidebarItem[];
  brand?: ReactNode;
  footer?: ReactNode;
  onNavigate?: (to: string) => void;
}

const COLLAPSED = 64;
const EXPANDED = 240;

export function CollapsibleSidebar({ items, brand, footer, onNavigate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();

  return (
    <motion.aside
      role="navigation"
      aria-label="主导航"
      className="glass"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      animate={{ width: expanded ? EXPANDED : COLLAPSED }}
      transition={transitions.base}
      style={{
        position: "sticky",
        top: 0,
        width: expanded ? EXPANDED : COLLAPSED,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: 12,
        gap: 8,
        overflow: "hidden",
        zIndex: 50,
        transition: `width ${transitions.base.duration}s cubic-bezier(${EASE_LIQUID.join(",")})`,
      }}
    >
      {/* Brand */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 8px",
          height: 44,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "linear-gradient(135deg, #0096FF, #9650FF)",
            flexShrink: 0,
          }}
        />
        <motion.span
          initial={false}
          animate={{ opacity: expanded ? 1 : 0, width: expanded ? "auto" : 0 }}
          transition={transitions.fast}
          style={{
            fontWeight: 700,
            fontSize: 16,
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {brand || "ArkNexus"}
        </motion.span>
      </div>

      {/* Nav items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {items.map((item) => {
          const target = item.to ?? item.key;
          const active = location.pathname === target
            || location.pathname.startsWith(target + "/");
          return (
            <Link
              key={item.key}
              to={target}
              onClick={() => onNavigate?.(target)}
              className={active ? "glass-tinted" : ""}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 12,
                color: "inherit",
                textDecoration: "none",
                position: "relative",
                fontSize: 14,
                fontWeight: active ? 600 : 500,
                transition: "background 0.2s",
              }}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-indicator"
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 8,
                    bottom: 8,
                    width: 3,
                    borderRadius: 999,
                    background: "linear-gradient(180deg, #007AFF, #9650FF)",
                  }}
                />
              )}
              <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                {item.icon}
              </span>
              <motion.span
                initial={false}
                animate={{ opacity: expanded ? 1 : 0, width: expanded ? "auto" : 0 }}
                transition={transitions.fast}
                style={{ whiteSpace: "nowrap", overflow: "hidden" }}
              >
                {item.label}
              </motion.span>
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      {footer && (
        <div style={{ flexShrink: 0, paddingTop: 8, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          {footer}
        </div>
      )}
    </motion.aside>
  );
}
