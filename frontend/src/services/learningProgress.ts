export type LearningProgressEnvelope = {
  data: Record<string, unknown>;
  version: string | null;
};

export function readLearningProgressEnvelope(
  value: unknown,
): LearningProgressEnvelope {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid learning progress response");
  }
  const response = value as Record<string, unknown>;
  if (
    !response.data ||
    typeof response.data !== "object" ||
    Array.isArray(response.data)
  ) {
    throw new Error("Invalid learning progress payload");
  }
  // Only an explicit missing-record response can authorize a first write.
  // A legacy response without a version is not a safe write baseline.
  if (
    !(
      (typeof response.version === "string" && response.version.length >= 8) ||
      (response.version === null && response.id === null)
    )
  ) {
    throw new Error("Invalid learning progress version; reload required");
  }
  return {
    data: response.data as Record<string, unknown>,
    version: typeof response.version === "string" ? response.version : null,
  };
}

export function withLearningProgressVersion(
  payload: Record<string, unknown>,
  version: string | null,
): Record<string, unknown> {
  return { ...payload, version };
}

export function isLearningProgressVersionConflict(error: unknown): boolean {
  const response = (error as { response?: { status?: unknown } } | null)
    ?.response;
  return response?.status === 409;
}
