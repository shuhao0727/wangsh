import { ThemeConfig } from "antd";

export const antdTheme: ThemeConfig = {
  cssVar: { key: "ws" },
  token: {
    colorPrimary: "#1677ff", // Ant Design Default Blue
    colorInfo: "#1677ff",
    colorSuccess: "#52c41a",
    colorWarning: "#faad14",
    colorError: "#ff4d4f",
    colorLink: "#1677ff",
    colorLinkHover: "#4096ff",
    colorLinkActive: "#0958d9",
    colorText: "rgba(0, 0, 0, 0.88)",
    colorTextSecondary: "rgba(0, 0, 0, 0.65)",
    colorTextTertiary: "rgba(0, 0, 0, 0.45)",
    colorTextQuaternary: "rgba(0, 0, 0, 0.25)",
    colorBorder: "#d9d9d9",
    colorBorderSecondary: "#f0f0f0",
    colorBgLayout: "#ffffff", // Restore original
    colorBgSpotlight: "#ffffff", // Restore original
    colorBgContainer: "#ffffff", // Restore original
    colorBgElevated: "#ffffff", // Restore original
    lineWidth: 1,
    controlHeight: 32,
    controlHeightLG: 40,
    controlHeightSM: 24,
    fontSize: 14,
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
  },
  components: {
    Button: {
      fontWeight: 400,
      controlHeight: 32,
      paddingContentHorizontal: 15,
      borderRadius: 6,
    },
    Card: {
      headerBg: "#ffffff", // Restore original
      colorBgContainer: "#ffffff", // Restore original
      paddingLG: 24,
      paddingSM: 12,
      boxShadow: "none", // Restore original
      colorBorderSecondary: "transparent", // Restore original
      borderRadius: 8,
    },
    Layout: {
      bodyBg: "#ffffff", // Restore original
      headerBg: "#ffffff", // Restore original
      headerPadding: "0 32px", // Restore original
    },
    Menu: {
      itemSelectedBg: "#e6f4ff",
      itemSelectedColor: "#1677ff",
      itemBorderRadius: 8,
      itemMarginInline: 4,
    },
    Modal: {
      paddingContentHorizontalLG: 24,
      paddingContentVerticalLG: 24,
      boxShadow: "0 6px 16px rgba(0,0,0,0.08)", // Restore original (softer)
      borderRadiusLG: 8,
    },
    Table: {
      headerBg: "#ffffff", // Restore original
      headerColor: "rgba(0, 0, 0, 0.88)",
      headerSplitColor: "transparent", // Restore original
      borderColor: "transparent", // Restore original
      cellPaddingInline: 16,
      cellPaddingBlock: 16,
      rowSelectedBg: "#e6f4ff",
      rowSelectedHoverBg: "#bae0ff",
      rowHoverBg: "#f8fafc", // Restore original
    },
    Tooltip: {
      colorBgSpotlight: "rgba(15, 23, 42, 0.9)", // Restore original (slate)
      colorTextLightSolid: "#ffffff",
      borderRadius: 6,
    },
    Tabs: {
      itemSelectedColor: "#1677ff",
      itemHoverColor: "#4096ff",
      inkBarColor: "#1677ff",
    },
    Input: {
      controlHeight: 32,
      borderRadius: 6,
    },
    Select: {
      controlHeight: 32,
      borderRadius: 6,
    },
  },
};
