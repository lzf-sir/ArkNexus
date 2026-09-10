// frontend/src/components/glass/GlassButton.tsx
import { motion, type HTMLMotionProps } from "framer-motion";
import { ReactNode, useState } from "react";
import { pressSink } from "../motion/motionPresets";

type Variant = "primary" | "ghost" | "tinted";

interface GlassButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  children: ReactNode;
  variant?: Variant;
  loading?: boolean;
  block?: boolean;
}

const variantClass: Record<Variant, string> = {
  primary: "glass-tinted",
  ghost: "glass",
  tinted: "glass-tinted",
};

export function GlassButton({
  children,
  variant = "ghost",
  loading = false,
  block = false,
  disabled = false,
  className = "",
  onClick,
  ...rest
}: GlassButtonProps) {
  const [ripple, setRipple] = useState<{ x: number; y: number; key: number } | null>(null);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setRipple({ x: e.clientX - rect.left, y: e.clientY - rect.top, key: Date.now() });
    setTimeout(() => setRipple(null), 600);
    onClick?.(e);
  };

  const isDisabled = disabled || loading;

  return (
    <motion.button
      type="button"
      className={`${variantClass[variant]} ${className}`.trim()}
      whileTap={isDisabled ? undefined : pressSink}
      disabled={isDisabled}
      onClick={handleClick}
      style={{
        position: "relative",
        overflow: "hidden",
        border: "none",
        padding: "8px 18px",
        borderRadius: 999,
        fontSize: 14,
        fontWeight: 600,
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.5 : 1,
        width: block ? "100%" : "auto",
        color: variant === "primary" ? "var(--apple-blue, #007AFF)" : "inherit",
        ...(rest.style || {}),
      }}
      {...rest}
    >
      {loading ? <span>...</span> : children}
      {ripple && (
        <motion.span
          key={ripple.key}
          initial={{ scale: 0, opacity: 0.4 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{
            position: "absolute",
            left: ripple.x - 50,
            top: ripple.y - 50,
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.5)",
            pointerEvents: "none",
          }}
        />
      )}
    </motion.button>
  );
}