import type { ThemeConfig } from "antd";

/**
 * Apple Design System — Ant Design Theme Configuration
 *
 * Two variants:
 *   - appleTheme       : light mode (default)
 *   - appleDarkTheme   : dark mode (Apple-style graphite)
 *
 * The active theme is picked at runtime by `pickTheme()` based on the
 * `dark` class on <html>.
 */

const COMMON_TOKENS = {
  colorPrimary: "#0a84ff",
  colorLink: "#0a84ff",
  colorSuccess: "#30d158",
  colorWarning: "#ff9f0a",
  colorError: "#ff453a",
  colorInfo: "#0a84ff",

  fontFamily:
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSize: 14,
  fontSizeLG: 16,
  fontSizeSM: 13,
  fontSizeXL: 20,
  fontSizeHeading1: 34,
  fontSizeHeading2: 28,
  fontSizeHeading3: 22,
  fontSizeHeading4: 18,
  fontSizeHeading5: 16,
  lineHeight: 1.57,

  borderRadius: 10,
  borderRadiusLG: 16,
  borderRadiusSM: 8,
  borderRadiusXS: 6,

  padding: 12,
  paddingLG: 16,
  paddingSM: 8,
  paddingXS: 4,
  margin: 8,
  marginLG: 12,
  marginSM: 8,
  marginXS: 4,

  motionDurationFast: "0.15s",
  motionDurationMid: "0.25s",
  motionDurationSlow: "0.35s",
  motionEaseInOut: "cubic-bezier(0.25, 0.1, 0.25, 1)",
  motionEaseOut: "cubic-bezier(0.25, 0.1, 0.25, 1)",

  controlHeight: 36,
  controlHeightLG: 44,
  controlHeightSM: 28,
} as const;

const COMMON_COMPONENTS = {
  Menu: {
    itemBg: "transparent",
    itemSelectedBg: "rgba(0, 113, 227, 0.08)",
    itemSelectedColor: "#0a84ff",
    itemHoverBg: "rgba(0, 0, 0, 0.03)",
    itemBorderRadius: 8,
    itemMarginInline: 8,
    itemHeight: 38,
    subMenuItemBg: "transparent",
  },
  Card: {
    borderRadiusLG: 16,
    paddingLG: 20,
  },
  Button: {
    borderRadius: 980,
    borderRadiusLG: 980,
    borderRadiusSM: 8,
    controlHeight: 36,
    controlHeightLG: 44,
    controlHeightSM: 28,
    fontWeight: 500,
    primaryShadow: "none",
    defaultShadow: "none",
  },
  Input: {
    borderRadius: 10,
    borderRadiusLG: 12,
    borderRadiusSM: 8,
    activeShadow: "0 0 0 3px rgba(10, 132, 255, 0.18)",
  },
  Modal: { borderRadiusLG: 20 },
  Drawer: { borderRadiusLG: 20 },
  Table: { borderRadius: 12, rowHoverBg: "rgba(0, 0, 0, 0.02)" },
  Tag: { borderRadiusSM: 6 },
  Segmented: {
    borderRadius: 8,
    itemSelectedBg: "#ffffff",
    itemHoverColor: "#0a84ff",
  },
  Tabs: {
    horizontalItemPadding: "8px 0",
    horizontalMargin: "0 24px 0 0",
    inkBarColor: "#0a84ff",
    itemSelectedColor: "#0a84ff",
    itemHoverColor: "#0a84ff",
  },
  Dropdown: { borderRadiusLG: 12 },
  Popover: { borderRadiusLG: 12 },
  Tooltip: { borderRadius: 8 },
  Statistic: { contentFontSize: 28 },
  Avatar: { borderRadius: 50 },
  Badge: { colorBgContainer: "#ff453a" },
  Steps: { colorPrimary: "#0a84ff" },
  Timeline: { dotBg: "#0a84ff" },
  Skeleton: { borderRadius: 8 },
  Select: { borderRadius: 10 },
  Checkbox: { colorPrimary: "#0a84ff" },
  Radio: { colorPrimary: "#0a84ff" },
  Switch: { colorPrimary: "#30d158" },
  Alert: { borderRadiusLG: 12 },
  Result: { iconFontSize: 56 },
} as const;

export const appleTheme: ThemeConfig = {
  token: {
    ...COMMON_TOKENS,
    colorTextBase: "#1d1d1f",
    colorBgBase: "#ffffff",
    colorBgLayout: "#f5f5f7",
    colorBgContainer: "#ffffff",
    colorBgElevated: "#ffffff",
    colorBorder: "rgba(0, 0, 0, 0.08)",
    colorBorderSecondary: "rgba(0, 0, 0, 0.06)",
    colorTextSecondary: "#86868b",
    colorSplit: "rgba(0, 0, 0, 0.06)",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)",
    boxShadowSecondary: "0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
    boxShadowTertiary: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)",
  },
  components: {
    ...COMMON_COMPONENTS,
    Layout: {
      bodyBg: "#f5f5f7",
      headerBg: "transparent",
      siderBg: "transparent",
      headerHeight: 56,
      headerPadding: "0 24px",
    },
    Form: { labelColor: "#1d1d1f", itemMarginBottom: 20 },
  },
};

export const appleDarkTheme: ThemeConfig = {
  token: {
    ...COMMON_TOKENS,
    colorPrimary: "#0a84ff",
    colorTextBase: "#f5f5f7",
    colorBgBase: "#1c1c1e",
    colorBgLayout: "#000000",
    colorBgContainer: "#1c1c1e",
    colorBgElevated: "#2c2c2e",
    colorBorder: "rgba(255, 255, 255, 0.10)",
    colorBorderSecondary: "rgba(255, 255, 255, 0.06)",
    colorTextSecondary: "#98989d",
    colorSplit: "rgba(255, 255, 255, 0.08)",
    boxShadow: "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
    boxShadowSecondary: "0 4px 12px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3)",
    boxShadowTertiary: "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
  },
  components: {
    ...COMMON_COMPONENTS,
    Layout: {
      bodyBg: "#000000",
      headerBg: "transparent",
      siderBg: "transparent",
      headerHeight: 56,
      headerPadding: "0 24px",
    },
    Form: { labelColor: "#f5f5f7", itemMarginBottom: 20 },
    Menu: {
      ...COMMON_COMPONENTS.Menu,
      itemSelectedBg: "rgba(10, 132, 255, 0.20)",
      itemSelectedColor: "#0a84ff",
      itemHoverBg: "rgba(255, 255, 255, 0.06)",
    },
    Table: {
      ...COMMON_COMPONENTS.Table,
      headerBg: "#2c2c2e",
      rowHoverBg: "rgba(255, 255, 255, 0.04)",
    },
    Segmented: {
      ...COMMON_COMPONENTS.Segmented,
      itemSelectedBg: "#3a3a3c",
    },
  },
};

export function pickTheme(): ThemeConfig {
  if (typeof document === "undefined") return appleTheme;
  return document.documentElement.classList.contains("dark")
    ? appleDarkTheme
    : appleTheme;
}
