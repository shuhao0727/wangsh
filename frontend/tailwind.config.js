/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{tsx,ts,jsx,js}",
  ],
  corePlugins: {
    preflight: false, // 禁用，避免与 antd reset.css 冲突
  },
  theme: {
    extend: {
      colors: {
        primary: "var(--ws-color-primary)",
        "primary-hover": "var(--ws-color-primary-hover)",
        "primary-active": "var(--ws-color-primary-active)",
        "primary-soft": "var(--ws-color-primary-soft)",
        success: "var(--ws-color-success)",
        "success-soft": "var(--ws-color-success-soft)",
        warning: "var(--ws-color-warning)",
        "warning-soft": "var(--ws-color-warning-soft)",
        error: "var(--ws-color-error)",
        "error-soft": "var(--ws-color-error-soft)",
        purple: "var(--ws-color-purple)",
        "purple-hover": "var(--ws-color-purple-hover)",
        "purple-soft": "var(--ws-color-purple-soft)",
        "text-base": "var(--ws-color-text)",
        "text-secondary": "var(--ws-color-text-secondary)",
        "text-tertiary": "var(--ws-color-text-tertiary)",
        surface: "var(--ws-color-surface)",
        "surface-2": "var(--ws-color-surface-2)",
        "code-bg": "var(--ws-color-code-bg)",
        "code-text": "var(--ws-color-code-text)",
      },
      borderRadius: {
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
      },
      boxShadow: {
        lg: "var(--ws-shadow-lg)",
        xl: "var(--ws-shadow-xl)",
      },
      transitionTimingFunction: {
        ws: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};
