import type { PythonLabRuleSetV1 } from "./rules";
import { sha256Hex } from "./rules";

export type PythonLabPipelineRecordV1 = {
  version: 1;
  id: string;
  createdAt: number;
  experimentId: string;
  ruleSetHash: string;
  tidy?: unknown;
  beautify?: unknown;
};

export const pythonLabPipelineRecordsKey = "python_lab_pipeline_records";
export const pythonLabPipelineRecordsKeyV1 = "python_lab_pipeline_records_v1";

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function loadPipelineRecords(): PythonLabPipelineRecordV1[] {
  try {
    const raw = localStorage.getItem(pythonLabPipelineRecordsKey) ?? localStorage.getItem(pythonLabPipelineRecordsKeyV1);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => {
        if (!isObj(x) || x.version !== 1) return null;
        const id = typeof x.id === "string" ? x.id : "";
        const createdAt = typeof x.createdAt === "number" ? x.createdAt : 0;
        const experimentId = typeof x.experimentId === "string" ? x.experimentId : "";
        const ruleSetHash = typeof x.ruleSetHash === "string" ? x.ruleSetHash : "";
        if (!id || !createdAt || !experimentId || !ruleSetHash) return null;
        return { version: 1 as const, id, createdAt, experimentId, ruleSetHash, tidy: x.tidy, beautify: x.beautify };
      })
      .filter(Boolean) as PythonLabPipelineRecordV1[];
  } catch {
    return [];
  }
}

export function savePipelineRecords(items: PythonLabPipelineRecordV1[]) {
  localStorage.setItem(pythonLabPipelineRecordsKey, JSON.stringify(items));
  localStorage.setItem(pythonLabPipelineRecordsKeyV1, JSON.stringify(items));
}

export async function createRecord(input: { experimentId: string; ruleSet: PythonLabRuleSetV1; tidy?: unknown; beautify?: unknown }): Promise<PythonLabPipelineRecordV1> {
  const ruleSetHash = await sha256Hex(JSON.stringify(input.ruleSet));
  const id = await sha256Hex(`${Date.now()}|${Math.random()}|${input.experimentId}`);
  return { version: 1, id, createdAt: Date.now(), experimentId: input.experimentId, ruleSetHash, tidy: input.tidy, beautify: input.beautify };
}
