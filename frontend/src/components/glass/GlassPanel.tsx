// frontend/src/components/glass/GlassPanel.tsx
import { motion, type HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";
import { transitions } from "../motion/motionPresets";

interface GlassPanelProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  radius?: number;
  padding?: number | string;
  variant?: "default" | "elevated" | "tinted";
}

export function GlassPanel({
  children,
  radius = 24,
  padding = 24,
  variant = "elevated",
  className = "",
  ...rest
}: GlassPanelProps) {
  const classNames = {
    default: "glass",
    elevated: "glass-elevated",
    tinted: "glass-tinted",
  };
  return (
    <motion.div
      className={`${classNames[variant]} ${className}`}
      style={{
        padding,
        borderRadius: radius,
        ...(rest.style || {}),
      }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={transitions.base}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
