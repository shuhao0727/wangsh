/** @type {import('tailwindcss').Config} */
module.exports = {
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
        // ========== WangSh semantic color bridge ==========
        // CSS variables in index.css are the source of truth. RGB projections
        // keep Tailwind / shadcn opacity modifiers working without hardcoded hex.
        page: "var(--ws-color-page)",
        bg: "var(--ws-color-bg)",
        overlay: "var(--ws-color-overlay)",
        text: {
          DEFAULT: "rgb(var(--ws-color-text-rgb) / <alpha-value>)",
          secondary: "rgb(var(--ws-color-text-secondary-rgb) / <alpha-value>)",
          tertiary: "rgb(var(--ws-color-text-tertiary-rgb) / <alpha-value>)",
          placeholder: "rgb(var(--ws-color-text-placeholder-rgb) / <alpha-value>)",
          inverse: "rgb(var(--ws-color-text-inverse-rgb) / <alpha-value>)",
        },
        surface: {
          DEFAULT: "rgb(var(--ws-color-surface-rgb) / <alpha-value>)",
          2: "rgb(var(--ws-color-surface-2-rgb) / <alpha-value>)",
          overlay: "var(--ws-color-overlay)",
        },
        border: {
          DEFAULT: "var(--ws-color-border)",
          subtle: "var(--ws-color-border-subtle)",
          control: "var(--ws-color-border-control)",
          strong: "var(--ws-color-border-strong)",
          secondary: "var(--ws-color-border-secondary)",
        },

        primary: {
          DEFAULT: "rgb(var(--ws-color-primary-fill-rgb) / <alpha-value>)",
          fill: "rgb(var(--ws-color-primary-fill-rgb) / <alpha-value>)",
          text: "rgb(var(--ws-color-primary-text-rgb) / <alpha-value>)",
          border: "var(--ws-color-primary-border)",
          hover: "var(--ws-color-primary-hover)",
          active: "var(--ws-color-primary-active)",
          soft: "var(--ws-color-primary-soft)",
          muted: "rgb(var(--ws-color-primary-muted-rgb) / <alpha-value>)",
          foreground: "var(--primary-foreground)",
        },
        "brand-accent": {
          DEFAULT: "rgb(var(--ws-color-brand-accent-rgb) / <alpha-value>)",
          fill: "rgb(var(--ws-color-brand-accent-rgb) / <alpha-value>)",
          text: "var(--ws-color-brand-accent-text)",
          border: "var(--ws-color-brand-accent-border)",
          hover: "var(--ws-color-brand-accent-hover)",
          active: "var(--ws-color-brand-accent-active)",
          soft: "var(--ws-color-brand-accent-soft)",
        },
        interaction: {
          hover: "var(--ws-color-interaction-hover)",
          focus: "var(--ws-color-interaction-focus)",
          selected: "var(--ws-color-interaction-selected)",
          disabled: "var(--ws-color-interaction-disabled)",
          "disabled-text": "var(--ws-color-interaction-disabled-text)",
          loading: "var(--ws-color-interaction-loading)",
        },

        success: {
          DEFAULT: "rgb(var(--ws-color-success-fill-rgb) / <alpha-value>)",
          fill: "rgb(var(--ws-color-success-fill-rgb) / <alpha-value>)",
          text: "var(--ws-color-success-text)",
          border: "var(--ws-color-success-border)",
          soft: "var(--ws-color-success-soft)",
          hover: "var(--ws-color-success-hover)",
          active: "var(--ws-color-success-active)",
        },
        warning: {
          DEFAULT: "rgb(var(--ws-color-warning-fill-rgb) / <alpha-value>)",
          fill: "rgb(var(--ws-color-warning-fill-rgb) / <alpha-value>)",
          text: "var(--ws-color-warning-text)",
          border: "var(--ws-color-warning-border)",
          soft: "var(--ws-color-warning-soft)",
          hover: "var(--ws-color-warning-hover)",
          active: "var(--ws-color-warning-active)",
        },
        error: {
          DEFAULT: "rgb(var(--ws-color-error-fill-rgb) / <alpha-value>)",
          fill: "rgb(var(--ws-color-error-fill-rgb) / <alpha-value>)",
          text: "var(--ws-color-error-text)",
          border: "var(--ws-color-error-border)",
          soft: "var(--ws-color-error-soft)",
          hover: "var(--ws-color-error-hover)",
          active: "var(--ws-color-error-active)",
        },
        danger: {
          DEFAULT: "rgb(var(--ws-color-error-fill-rgb) / <alpha-value>)",
          fill: "rgb(var(--ws-color-error-fill-rgb) / <alpha-value>)",
          text: "var(--ws-color-error-text)",
          border: "var(--ws-color-error-border)",
          soft: "var(--ws-color-error-soft)",
          hover: "var(--ws-color-error-hover)",
          active: "var(--ws-color-error-active)",
        },
        info: {
          DEFAULT: "rgb(var(--ws-color-info-fill-rgb) / <alpha-value>)",
          fill: "rgb(var(--ws-color-info-fill-rgb) / <alpha-value>)",
          text: "var(--ws-color-info-text)",
          border: "var(--ws-color-info-border)",
          soft: "var(--ws-color-info-soft)",
          hover: "var(--ws-color-info-hover)",
          active: "var(--ws-color-info-active)",
        },

        chart: {
          1: "var(--ws-color-chart-1)",
          2: "var(--ws-color-chart-2)",
          3: "var(--ws-color-chart-3)",
          4: "var(--ws-color-chart-4)",
          5: "var(--ws-color-chart-5)",
          6: "var(--ws-color-chart-6)",
          7: "var(--ws-color-chart-7)",
          8: "var(--ws-color-chart-8)",
          axis: "var(--ws-color-chart-axis)",
          grid: "var(--ws-color-chart-grid)",
          surface: "var(--ws-color-chart-surface)",
          tooltip: "var(--ws-color-chart-tooltip)",
          "tooltip-text": "var(--ws-color-chart-tooltip-text)",
        },
        "module-shell": {
          DEFAULT: "var(--ws-color-module-shell)",
          surface: "var(--ws-color-module-shell-surface)",
          "surface-2": "var(--ws-color-module-shell-surface-2)",
          border: "var(--ws-color-module-shell-border)",
          text: "var(--ws-color-module-shell-text)",
          muted: "var(--ws-color-module-shell-muted)",
          accent: "var(--ws-color-module-shell-accent)",
          focus: "var(--ws-color-module-shell-focus)",
          hover: "var(--ws-color-module-shell-hover)",
          selected: "var(--ws-color-module-shell-selected)",
          input: "var(--ws-color-module-shell-input)",
          canvas: "var(--ws-color-module-shell-canvas)",
          code: "var(--ws-color-module-shell-code)",
          "code-text": "var(--ws-color-module-shell-code-text)",
        },

        // ========== Legacy aliases ==========
        purple: {
          DEFAULT: "var(--ws-color-purple)",
          hover: "var(--ws-color-purple-hover)",
          active: "var(--ws-color-purple-active)",
          soft: "var(--ws-color-purple-soft)",
        },
        skeleton: "var(--ws-color-border)",
        scrollbar: "var(--ws-color-scrollbar)",
        "text-base": "rgb(var(--ws-color-text-rgb) / <alpha-value>)",
        "text-secondary": "rgb(var(--ws-color-text-secondary-rgb) / <alpha-value>)",
        "text-tertiary": "rgb(var(--ws-color-text-tertiary-rgb) / <alpha-value>)",
        "code-bg": "var(--ws-color-code-bg)",
        "code-text": "var(--ws-color-code-text)",

        // ========== shadcn/ui semantic aliases ==========
        background: "var(--background)",
        foreground: "var(--foreground)",
        input: "var(--ws-color-border-control)",
        ring: "var(--ring)",
        secondary: {
          DEFAULT: "rgb(var(--ws-color-surface-2-rgb) / <alpha-value>)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "rgb(var(--destructive-rgb) / <alpha-value>)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "rgb(var(--ws-color-surface-2-rgb) / <alpha-value>)",
          foreground: "rgb(var(--ws-color-text-secondary-rgb) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "var(--ws-color-interaction-hover)",
          foreground: "var(--accent-foreground)",
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
        // Dense metadata only; existing root tokens, not body text.
        "3xs": "var(--ws-text-3xs)",
        "2xs": "var(--ws-text-2xs)",
        xs: "var(--ws-text-xs)",
        sm: "var(--ws-text-sm)",
        base: "var(--ws-text-md)",
        lg: "var(--ws-text-lg)",
        xl: "var(--ws-text-xl)",
        "2xl": "var(--ws-text-2xl)",
      },
      boxShadow: {
        sm: "var(--ws-shadow-sm)",
        md: "var(--ws-shadow-sm)",
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
      // 动画关键帧
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "ws-fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "ws-fade-in-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "ws-fade-in": "ws-fade-in 0.2s ease-out",
        "ws-fade-in-up": "ws-fade-in-up 0.25s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
