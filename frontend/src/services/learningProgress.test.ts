import {
  isLearningProgressVersionConflict,
  readLearningProgressEnvelope,
  withLearningProgressVersion,
} from "./learningProgress";

describe("learning progress transport contract", () => {
  it("requires a structured data object and reads the opaque version token", () => {
    expect(
      readLearningProgressEnvelope({
        id: null,
        data: { overall_percent: 20 },
        version: "version-1",
      }),
    ).toEqual({
      data: { overall_percent: 20 },
      version: "version-1",
    });
    expect(() => readLearningProgressEnvelope({ data: null })).toThrow();
    expect(() =>
      readLearningProgressEnvelope({ data: { overall_percent: 20 } }),
    ).toThrow(/version/);
  });

  it("does not send a fake version for a missing record", () => {
    expect(withLearningProgressVersion({ overall_percent: 0 }, null)).toEqual({
      overall_percent: 0,
      version: null,
    });
    expect(withLearningProgressVersion({ overall_percent: 20 }, "v2")).toEqual({
      overall_percent: 20,
      version: "v2",
    });
  });

  it("recognizes stale-tab conflicts without treating other failures as conflicts", () => {
    expect(
      isLearningProgressVersionConflict({ response: { status: 409 } }),
    ).toBe(true);
    expect(
      isLearningProgressVersionConflict({ response: { status: 500 } }),
    ).toBe(false);
  });
});
