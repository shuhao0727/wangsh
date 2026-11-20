export function parseBlankAnswers(raw?: string | null): string[] {
  const text = (raw ?? "").trim();
  if (!text) return [];
  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map((value) => String(value ?? "").trim());
      if (parsed && typeof parsed === "object") {
        const slots = parsed as Record<string, unknown>;
        return Object.keys(slots)
          .sort((a, b) => Number(a) - Number(b))
          .map((key) => String(slots[key] ?? "").trim());
      }
    } catch {
      // Old answers may be literal text (including a bracket as the first character).
    }
  }
  return [text];
}

export function formatBlankAnswers(raw?: string | null): string {
  const blanks = parseBlankAnswers(raw);
  if (blanks.length <= 1) return raw ?? "";
  return blanks.map((value, index) => `(${index + 1}) ${value}`).join("；");
}
