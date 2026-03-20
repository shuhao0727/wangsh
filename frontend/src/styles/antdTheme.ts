import { ThemeConfig } from "antd";

export const antdTheme: ThemeConfig = {
  cssVar: { key: "ws" },
  token: {
    // 主色系 — Sky Blue
    colorPrimary: "#0EA5E9",
    colorInfo: "#0EA5E9",
    colorSuccess: "#10B981",
    colorWarning: "#F59E0B",
    colorError: "#EF4444",
    colorLink: "#0EA5E9",
    colorLinkHover: "#38BDF8",
    colorLinkActive: "#0284C7",

    // 文字
    colorText: "rgba(15, 23, 42, 0.88)",
    colorTextSecondary: "rgba(71, 85, 105, 0.78)",
    colorTextTertiary: "rgba(100, 116, 139, 0.55)",
    colorTextQuaternary: "rgba(148, 163, 184, 0.4)",

    // 边框 — 极淡，几乎不可见
    colorBorder: "transparent",
    colorBorderSecondary: "transparent",

    // 背景 — 统一白色，无层次割裂
    colorBgLayout: "#FFFFFF",
    colorBgSpotlight: "#FFFFFF",
    colorBgContainer: "#FFFFFF",
    colorBgElevated: "#FFFFFF",

    // 尺寸
    lineWidth: 0,
    controlHeight: 34,
    controlHeightLG: 42,
    controlHeightSM: 28,
    fontSize: 14,

    // 圆角
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,

    // 字体
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif',
  },
  components: {
    Button: {
      fontWeight: 500,
      controlHeight: 34,
      paddingContentHorizontal: 18,
      borderRadius: 8,
      primaryShadow: "none",
    },
    Card: {
      headerBg: "transparent",
      colorBgContainer: "transparent",
      paddingLG: 24,
      paddingSM: 16,
      boxShadow: "none",
      colorBorderSecondary: "transparent",
      borderRadius: 12,
    },
    Layout: {
      bodyBg: "#FFFFFF",
      headerBg: "#FFFFFF",
      headerPadding: "0 32px",
    },
    Menu: {
      itemSelectedBg: "rgba(14, 165, 233, 0.06)",
      itemSelectedColor: "#0EA5E9",
      itemBorderRadius: 8,
      itemMarginInline: 4,
      itemHoverBg: "rgba(14, 165, 233, 0.04)",
    },
    Modal: {
      paddingContentHorizontalLG: 28,
      paddingContentVerticalLG: 24,
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08)",
      borderRadiusLG: 12,
    },
    Table: {
      headerBg: "transparent",
      headerColor: "rgba(15, 23, 42, 0.65)",
      headerSplitColor: "transparent",
      borderColor: "transparent",
      cellPaddingInline: 16,
      cellPaddingBlock: 14,
      rowSelectedBg: "rgba(14, 165, 233, 0.04)",
      rowSelectedHoverBg: "rgba(14, 165, 233, 0.08)",
      rowHoverBg: "rgba(14, 165, 233, 0.02)",
    },
    Tooltip: {
      colorBgSpotlight: "rgba(15, 23, 42, 0.92)",
      colorTextLightSolid: "#ffffff",
      borderRadius: 8,
    },
    Tabs: {
      itemSelectedColor: "#0EA5E9",
      itemHoverColor: "#38BDF8",
      inkBarColor: "#0EA5E9",
    },
    Input: {
      controlHeight: 34,
      borderRadius: 8,
      activeBorderColor: "#0EA5E9",
      hoverBorderColor: "#7DD3FC",
      colorBgContainer: "#F8FAFC",
      hoverBg: "#F1F5F9",
      activeBg: "#FFFFFF",
    },
    Select: {
      controlHeight: 34,
      borderRadius: 8,
      colorBgContainer: "#F8FAFC",
      selectorBg: "#F8FAFC",
    },
    Tag: {
      borderRadiusSM: 6,
    },
    InputNumber: {
      controlHeight: 34,
      borderRadius: 8,
      colorBgContainer: "#F8FAFC",
      activeBorderColor: "#0EA5E9",
      hoverBorderColor: "#7DD3FC",
    },
    Pagination: {
      borderRadius: 8,
      itemActiveBg: "#0284C7",
      itemActiveColorDisabled: "rgba(255, 255, 255, 0.5)",
    },
    Drawer: {
      borderRadius: 12,
    },
  },
};
