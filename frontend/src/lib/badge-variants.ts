const STATUS_BADGE_MAP = {
  emerald: "border-[color-mix(in_srgb,var(--ws-color-success),transparent_80%)] bg-success-soft text-success hover:bg-success-soft",
  amber: "border-[color-mix(in_srgb,var(--ws-color-warning),transparent_80%)] bg-warning-soft text-warning hover:bg-warning-soft",
  red: "border-[color-mix(in_srgb,var(--ws-color-error),transparent_80%)] bg-error-soft text-error hover:bg-error-soft",
  blue: "border-[color-mix(in_srgb,var(--ws-color-primary),transparent_80%)] bg-primary-soft text-primary hover:bg-primary-soft",
  sky: "border-[color-mix(in_srgb,var(--ws-color-primary),transparent_80%)] bg-primary-soft text-primary hover:bg-primary-soft",
  violet: "border-[color-mix(in_srgb,var(--ws-color-purple),transparent_80%)] bg-purple-soft text-purple hover:bg-purple-soft",
  cyan: "border-[color-mix(in_srgb,var(--ws-color-accent),transparent_80%)] bg-[color-mix(in_srgb,var(--ws-color-accent),transparent_90%)] text-[var(--ws-color-accent)] hover:bg-[color-mix(in_srgb,var(--ws-color-accent),transparent_90%)]",
  slate: "border-[color-mix(in_srgb,var(--ws-color-text-secondary),transparent_80%)] bg-[color-mix(in_srgb,var(--ws-color-text-secondary),transparent_90%)] text-text-secondary hover:bg-[color-mix(in_srgb,var(--ws-color-text-secondary),transparent_90%)]",
  rose: "border-[color-mix(in_srgb,var(--ws-color-error),transparent_80%)] bg-error-soft text-error hover:bg-error-soft",
  primary: "border-[color-mix(in_srgb,var(--ws-color-primary),transparent_80%)] bg-primary-soft text-primary hover:bg-primary-soft",
} as const;

type StatusBadgeColor = keyof typeof STATUS_BADGE_MAP;

/** @deprecated Use statusVariant() instead. */
export const statusBadge = (color: StatusBadgeColor) =>
  STATUS_BADGE_MAP[color] ?? STATUS_BADGE_MAP.slate;

export const STATUS_VARIANT_MAP = {
  emerald: "success",
  amber: "warning",
  red: "danger",
  blue: "info",
  sky: "info",
  violet: "purple",
  cyan: "cyan",
  slate: "neutral",
  rose: "danger",
  primary: "info",
} as const;

type StatusVariantColor = keyof typeof STATUS_VARIANT_MAP;

export const statusVariant = (color: StatusVariantColor) =>
  STATUS_VARIANT_MAP[color] ?? "neutral";
