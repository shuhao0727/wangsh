export function detectSourceMismatch(params: { sessionCodeSha?: string | null; debugMapCodeSha?: string | null }) {
  const sessionCodeSha = String(params.sessionCodeSha || "").trim();
  const debugMapCodeSha = String(params.debugMapCodeSha || "").trim();
  if (!sessionCodeSha || !debugMapCodeSha) return { mismatch: false, message: null as string | null };
  if (sessionCodeSha === debugMapCodeSha) return { mismatch: false, message: null as string | null };
  return { mismatch: true, message: "流程图与运行代码版本不一致，已暂停节点强调，请先重新生成流程图" };
}
