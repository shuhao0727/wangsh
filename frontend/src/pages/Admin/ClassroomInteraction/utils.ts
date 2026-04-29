import React from "react";
import { Badge } from "@/components/ui/badge";
import type { OptionItem } from "@services/classroom";

export const ANALYSIS_STATUS_MAP: Record<string, { variant: React.ComponentProps<typeof Badge>["variant"]; text: string }> = {
  pending: { variant: "neutral", text: "待分析" },
  running: { variant: "info", text: "分析中" },
  success: { variant: "success", text: "分析完成" },
  failed: { variant: "danger", text: "分析失败" },
  skipped: { variant: "warning", text: "已跳过" },
  not_applicable: { variant: "neutral", text: "不适用" },
};

export const parseBlankAnswers = (raw?: string | null): string[] => {
  const text = String(raw || "").trim();
  if (!text) return [];
  if (!text.startsWith("[") && !text.startsWith("{")) return [text];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map((v) => String(v ?? "").trim());
    if (parsed && typeof parsed === "object") {
      return Object.keys(parsed)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => String((parsed as any)[k] ?? "").trim());
    }
  } catch {}
  return [text];
};

export const toFillBlankPayload = (values: { blank_answers: string[] }): string | undefined => {
  const blanks = (values.blank_answers || [])
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  if (blanks.length === 0) return undefined;
  if (blanks.length === 1) return blanks[0];
  return JSON.stringify(blanks);
};

export const countBlanksInCode = (code: string): number => (code.match(/___/g) || []).length;

export const extractCodeTemplate = (options: OptionItem[] | null): string => {
  if (!Array.isArray(options)) return "";
  const codeOpt = options.find((o) => o.key === "__code__");
  return codeOpt?.text || "";
};

export const packCodeTemplate = (code: string): OptionItem[] => [{ key: "__code__", text: code }];

export const parseErrorMessage = (error: any): string =>
  String(error?.response?.data?.detail || error?.message || "操作失败");
