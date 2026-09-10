import { theme, type ThemeConfig } from "antd";
import { getTokens, type ThemeMode } from "./tokens";

/**
 * Build an Ant Design `ThemeConfig` from our design tokens.
 *
 * The `algorithm` (light/dark) comes from antd's built-in theme algorithms,
 * which mutate the seed values below to produce background, text, and
 * border tokens appropriate for the active mode. We only seed color,
 * radius, font, and motion — antd fills the rest.
 *
 * `borderRadius` is intentionally a literal `10` (Apple HIG standard for
 * inputs/buttons) rather than sourced from `t.radius.md` (which is 12,
 * reserved for cards/elevated surfaces via `borderRadiusLG`).
 */
export function buildAntdTheme(mode: ThemeMode): ThemeConfig {
  const t = getTokens(mode);
  return {
    algorithm: mode === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: t.color.primary,
      colorSuccess: t.color.success,
      colorWarning: t.color.warning,
      colorError: t.color.danger,
      colorInfo: t.color.primary,
      borderRadius: 10,
      borderRadiusLG: t.radius.lg,
      borderRadiusSM: t.radius.sm,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Microsoft YaHei", sans-serif',
      motionDurationFast: `${t.motion.duration.fast}ms`,
      motionDurationMid: `${t.motion.duration.base}ms`,
      motionDurationSlow: `${t.motion.duration.slow}ms`,
    },
    components: {
      Button: { borderRadius: t.radius.full, controlHeight: 36 },
      Card: { borderRadiusLG: t.radius.lg, paddingLG: t.spacing.lg },
      Modal: { borderRadiusLG: t.radius.lg },
      Drawer: { paddingLG: t.spacing.lg },
      Input: { borderRadius: t.radius.md, controlHeight: 38 },
      Menu: { itemBorderRadius: t.radius.md, itemHeight: 40 },
      Tag: { borderRadiusSM: t.radius.full },
    },
  };
}