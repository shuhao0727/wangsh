/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{tsx,ts,jsx,js}",
  ],
  corePlugins: {
    preflight: true,
  },
  theme: {
    extend: {
      // ========== 项目原有设计 token ==========
      colors: {
        // 项目自定义色彩（保留兼容）
        primary: {
          DEFAULT: "var(--ws-color-primary)",
          hover: "var(--ws-color-primary-hover)",
          active: "var(--ws-color-primary-active)",
          soft: "var(--ws-color-primary-soft)",
          foreground: "#FFFFFF",
        },
        success: {
          DEFAULT: "var(--ws-color-success)",
          soft: "var(--ws-color-success-soft)",
        },
        warning: {
          DEFAULT: "var(--ws-color-warning)",
          soft: "var(--ws-color-warning-soft)",
        },
        error: {
          DEFAULT: "var(--ws-color-error)",
          soft: "var(--ws-color-error-soft)",
        },
        purple: {
          DEFAULT: "var(--ws-color-purple)",
          hover: "var(--ws-color-purple-hover)",
          soft: "var(--ws-color-purple-soft)",
        },
        "text-base": "var(--ws-color-text)",
        "text-secondary": "var(--ws-color-text-secondary)",
        "text-tertiary": "var(--ws-color-text-tertiary)",
        surface: {
          DEFAULT: "var(--ws-color-surface)",
          2: "var(--ws-color-surface-2)",
        },
        "code-bg": "var(--ws-color-code-bg)",
        "code-text": "var(--ws-color-code-text)",

        // ========== shadcn/ui 语义色（直接映射到项目 CSS 变量，统一颜色系统）==========
        border: "var(--ws-color-border)",
        input: "var(--ws-color-border)",
        ring: "var(--ws-color-focus-ring)",
        background: "var(--ws-color-surface)",
        foreground: "var(--ws-color-text)",
        secondary: {
          DEFAULT: "var(--ws-color-surface-2)",
          foreground: "var(--ws-color-text)",
        },
        destructive: {
          DEFAULT: "var(--ws-color-error)",
          foreground: "#FFFFFF",
        },
        muted: {
          DEFAULT: "var(--ws-color-surface-2)",
          foreground: "var(--ws-color-text-secondary)",
        },
        accent: {
          DEFAULT: "var(--ws-color-hover-bg)",
          foreground: "var(--ws-color-text)",
        },
        popover: {
          DEFAULT: "var(--ws-color-surface)",
          foreground: "var(--ws-color-text)",
        },
        card: {
          DEFAULT: "var(--ws-color-surface)",
          foreground: "var(--ws-color-text)",
        },
      },
      borderRadius: {
        // 项目原有
        sm: "var(--ws-radius-sm)",
        DEFAULT: "var(--ws-radius-md)",
        md: "var(--ws-radius-md)",
        lg: "var(--ws-radius-lg)",
        xl: "var(--ws-radius-xl)",
      },
      fontFamily: {
        sans: "var(--ws-font-family)",
        mono: "var(--ws-font-mono)",
      },
      fontSize: {
        xs: "var(--ws-text-xs)",
        sm: "var(--ws-text-sm)",
        base: "var(--ws-text-md)",
        lg: "var(--ws-text-lg)",
        xl: "var(--ws-text-xl)",
        "2xl": "var(--ws-text-2xl)",
      },
      boxShadow: {
        lg: "var(--ws-shadow-lg)",
        xl: "var(--ws-shadow-xl)",
      },
      zIndex: {
        header: "var(--ws-z-header)",
        dropdown: "var(--ws-z-dropdown)",
        sticky: "var(--ws-z-sticky)",
        overlay: "var(--ws-z-overlay)",
        modal: "var(--ws-z-modal)",
        toast: "var(--ws-z-toast)",
        tooltip: "var(--ws-z-tooltip)",
      },
      transitionTimingFunction: {
        ws: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      // shadcn/ui 动画关键帧
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
