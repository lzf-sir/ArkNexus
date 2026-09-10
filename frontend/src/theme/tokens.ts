// frontend/src/theme/tokens.ts
export type ThemeMode = "light" | "dark";

export interface ColorTokens {
  primary: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  surface: string;
  surfaceElevated: string;
  surfaceTinted: string;
  border: string;
  text: string;
  textMuted: string;
}

export interface RadiusTokens {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  full: number;
}

export interface SpacingTokens {
  xs: 4;
  sm: 8;
  md: 12;
  base: 16;
  lg: 20;
  xl: 24;
  "2xl": 32;
  "3xl": 48;
}

export interface MotionTokens {
  duration: { fast: 150; base: 250; slow: 400; page: 500 };
  easing: { liquid: "cubic-bezier(0.25, 0.1, 0.25, 1)" };
}

export interface DesignTokens {
  color: ColorTokens;
  radius: RadiusTokens;
  spacing: SpacingTokens;
  motion: MotionTokens;
}

const motion: MotionTokens = {
  duration: { fast: 150, base: 250, slow: 400, page: 500 },
  easing: { liquid: "cubic-bezier(0.25, 0.1, 0.25, 1)" },
};

const light: DesignTokens = {
  color: {
    primary: "#007AFF",
    accent: "#5856D6",
    success: "#34C759",
    warning: "#FF9500",
    danger: "#FF3B30",
    surface: "rgba(255,255,255,0.55)",
    surfaceElevated: "rgba(255,255,255,0.7)",
    surfaceTinted: "rgba(0,122,255,0.12)",
    border: "rgba(255,255,255,0.7)",
    text: "#1d1d1f",
    textMuted: "#86868b",
  },
  radius: { sm: 8, md: 12, lg: 18, xl: 24, full: 999 },
  spacing: { xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24, "2xl": 32, "3xl": 48 },
  motion,
};

const dark: DesignTokens = {
  ...light,
  color: {
    primary: "#0A84FF",
    accent: "#BF5AF2",
    success: "#30D158",
    warning: "#FF9F0A",
    danger: "#FF453A",
    surface: "rgba(28,28,30,0.55)",
    surfaceElevated: "rgba(28,28,30,0.7)",
    surfaceTinted: "rgba(10,132,255,0.18)",
    border: "rgba(255,255,255,0.1)",
    text: "#f5f5f7",
    textMuted: "#98989d",
  },
};

export const tokens: Record<ThemeMode, DesignTokens> & { motion: MotionTokens } = {
  light,
  dark,
  motion,
};
export const getTokens = (mode: ThemeMode): DesignTokens => tokens[mode];
