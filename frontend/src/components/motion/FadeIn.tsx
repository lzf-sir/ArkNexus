import { motion, type HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";
import { slideUp, stagger, fadeIn } from "./motionPresets";

interface FadeInProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  variant?: "fade" | "slide";
  delay?: number;
}

export function FadeIn({ children, variant = "slide", delay = 0, ...rest }: FadeInProps) {
  const variants = variant === "fade" ? fadeIn : slideUp;
  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="show"
      transition={{ delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

interface FadeInStaggerProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  staggerChildren?: number;
  delayChildren?: number;
}

export function FadeInStagger({ children, staggerChildren = 0.06, delayChildren = 0, ...rest }: FadeInStaggerProps) {
  return (
    <motion.div
      variants={stagger(delayChildren, staggerChildren)}
      initial="hidden"
      animate="show"
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export const FadeInItem = motion.div;
