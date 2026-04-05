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
          foreground: "hsl(var(--primary-foreground))",
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

        // ========== shadcn/ui 语义色（映射到项目 token）==========
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        // 项目原有
        sm: "var(--ws-radius-sm)",
        DEFAULT: "var(--ws-radius-md)",
        md: "var(--ws-radius-md)",
        lg: "var(--radius)",
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
