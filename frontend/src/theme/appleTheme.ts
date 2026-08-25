import type { ThemeConfig } from "antd";

/**
 * Apple Design System — Ant Design Theme Configuration
 *
 * This config deeply customizes Ant Design v5 tokens to match Apple's
 * visual language: SF-style typography, generous spacing, soft shadows,
 * rounded corners, and a muted-but-confident blue accent.
 */
export const appleTheme: ThemeConfig = {
  token: {
    // Colors
    colorPrimary: "#0071e3",
    colorSuccess: "#34c759",
    colorWarning: "#ff9f0a",
    colorError: "#ff3b30",
    colorInfo: "#0071e3",
    colorLink: "#0071e3",
    colorTextBase: "#1d1d1f",
    colorBgBase: "#ffffff",
    colorBgLayout: "#f5f5f7",
    colorBgContainer: "#ffffff",
    colorBgElevated: "#ffffff",
    colorBorder: "rgba(0, 0, 0, 0.08)",
    colorBorderSecondary: "rgba(0, 0, 0, 0.06)",
    colorTextSecondary: "#86868b",
    colorSplit: "rgba(0, 0, 0, 0.06)",

    // Typography
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
    lineHeightHeading1: 1.2,
    lineHeightHeading2: 1.25,
    lineHeightHeading3: 1.3,
    lineHeightHeading4: 1.35,
    lineHeightHeading5: 1.4,

    // Borders & Radius
    borderRadius: 10,
    borderRadiusLG: 16,
    borderRadiusSM: 8,
    borderRadiusXS: 6,

    // Spacing
    padding: 12,
    paddingLG: 16,
    paddingSM: 8,
    paddingXS: 4,
    margin: 8,
    marginLG: 12,
    marginSM: 8,
    marginXS: 4,

    // Shadows — soft, Apple-style
    boxShadow:
      "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)",
    boxShadowSecondary:
      "0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",

    // Animation
    motionDurationFast: "0.15s",
    motionDurationMid: "0.25s",
    motionDurationSlow: "0.35s",
    motionEaseInOut: "cubic-bezier(0.25, 0.1, 0.25, 1)",
    motionEaseOut: "cubic-bezier(0.25, 0.1, 0.25, 1)",

    // Control sizes
    controlHeight: 36,
    controlHeightLG: 44,
    controlHeightSM: 28,
  },
  components: {
    Layout: {
      bodyBg: "#f5f5f7",
      headerBg: "transparent",
      siderBg: "transparent",
      headerHeight: 56,
      headerPadding: "0 24px",
    },
    Menu: {
      itemBg: "transparent",
      itemSelectedBg: "rgba(0, 113, 227, 0.08)",
      itemSelectedColor: "#0071e3",
      itemHoverBg: "rgba(0, 0, 0, 0.03)",
      itemBorderRadius: 8,
      itemMarginInline: 8,
      itemHeight: 38,
      subMenuItemBg: "transparent",
    },
    Card: {
      borderRadiusLG: 16,
      boxShadowTertiary:
        "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)",
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
      activeShadow: "0 0 0 3px rgba(0, 113, 227, 0.12)",
    },
    Modal: {
      borderRadiusLG: 20,
    },
    Drawer: {
      borderRadiusLG: 20,
    },
    Table: {
      borderRadius: 12,
      headerBg: "#f5f5f7",
      rowHoverBg: "rgba(0, 0, 0, 0.02)",
    },
    Tag: {
      borderRadiusSM: 6,
    },
    Segmented: {
      borderRadius: 8,
      itemSelectedBg: "#ffffff",
      itemHoverColor: "#0071e3",
    },
    Tabs: {
      horizontalItemPadding: "8px 0",
      horizontalMargin: "0 24px 0 0",
      inkBarColor: "#0071e3",
      itemSelectedColor: "#0071e3",
      itemHoverColor: "#0071e3",
    },
    Dropdown: {
      borderRadiusLG: 12,
    },
    Popover: {
      borderRadiusLG: 12,
    },
    Tooltip: {
      borderRadius: 8,
    },
    Empty: {},
    Statistic: {
      contentFontSize: 28,
    },
    Avatar: {
      borderRadius: 50,
    },
    Badge: {
      colorBgContainer: "#ff3b30",
    },
    Steps: {
      colorPrimary: "#0071e3",
    },
    Timeline: {
      dotBg: "#0071e3",
    },
    Skeleton: {
      borderRadius: 8,
    },
    Form: {
      labelColor: "#1d1d1f",
      itemMarginBottom: 20,
    },
    Select: {
      borderRadius: 10,
    },
    Checkbox: {
      colorPrimary: "#0071e3",
    },
    Radio: {
      colorPrimary: "#0071e3",
    },
    Switch: {
      colorPrimary: "#34c759",
    },
    Alert: {
      borderRadiusLG: 12,
    },
    Result: {
      iconFontSize: 56,
    },
  },
};
