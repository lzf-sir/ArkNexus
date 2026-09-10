// frontend/src/components/motion/motionPresets.ts
import type { Variants, Transition } from "framer-motion";

export const EASE_LIQUID = [0.25, 0.1, 0.25, 1] as const;

export const transitions = {
  fast: { duration: 0.15, ease: EASE_LIQUID } satisfies Transition,
  base: { duration: 0.25, ease: EASE_LIQUID } satisfies Transition,
  slow: { duration: 0.4, ease: EASE_LIQUID } satisfies Transition,
  page: { duration: 0.5, ease: EASE_LIQUID } satisfies Transition,
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: transitions.base },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: transitions.slow },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: transitions.base },
};

export const stagger = (delayChildren = 0, staggerChildren = 0.06): Variants => ({
  hidden: {},
  show: { transition: { delayChildren, staggerChildren } },
});

export const hoverLift = {
  scale: 1.02,
  y: -4,
  transition: { duration: 0.2, ease: EASE_LIQUID },
};

export const pressSink = {
  scale: 0.96,
  transition: { duration: 0.12, ease: EASE_LIQUID },
};