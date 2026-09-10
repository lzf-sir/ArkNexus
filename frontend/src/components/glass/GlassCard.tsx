// frontend/src/components/glass/GlassCard.tsx
import { motion, type HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";
import { hoverLift } from "../motion/motionPresets";

interface GlassCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  hover?: boolean;
  padding?: number | string;
  radius?: number;
}

export function GlassCard({
  children,
  hover = false,
  padding = 20,
  radius = 18,
  className = "",
  ...rest
}: GlassCardProps) {
  return (
    <motion.div
      className={`glass ${hover ? "glass-hover" : ""} ${className}`.trim()}
      style={{
        padding,
        borderRadius: radius,
        ...(rest.style || {}),
      }}
      whileHover={hover ? hoverLift : undefined}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
