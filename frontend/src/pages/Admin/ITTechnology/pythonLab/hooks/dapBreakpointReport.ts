export type DapBreakpointReport = {
  requested: number;
  verified: number;
  unverified: number;
  sourcePath: string;
  unverifiedLines: number[];
  unverifiedMessages: string[];
} | null;

export function summarizeDapBreakpointReport(params: { requested: number; sourcePath: string; resp: any }): DapBreakpointReport {
  const requested = Number(params.requested || 0);
  if (requested <= 0) return null;
  const items = Array.isArray(params.resp?.body?.breakpoints) ? params.resp.body.breakpoints : [];
  const verified = items.filter((x: any) => !!x?.verified).length;
  const unverifiedItems = items.filter((x: any) => !x?.verified);
  const unverifiedLines = unverifiedItems
    .map((x: any) => Number(x?.line))
    .filter((line: number) => Number.isFinite(line) && line >= 1);
  const unverifiedMessages = Array.from(
    new Set<string>(
      unverifiedItems
        .map((x: any) => String(x?.message || "").trim())
        .filter((message: string) => message.length > 0)
    )
  );
  return {
    requested,
    verified,
    unverified: Math.max(0, requested - verified),
    sourcePath: String(params.sourcePath || ""),
    unverifiedLines,
    unverifiedMessages,
  };
}
