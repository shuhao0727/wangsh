import { describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({ api: {} }));

import { isPlanNotFoundError } from "./classroomPlan";

describe("isPlanNotFoundError", () => {
  it("recognizes 404 responses for the selected plan and its actions", () => {
    expect(isPlanNotFoundError({
      response: { status: 404 },
      config: { url: "/classroom/plans/admin/3/start" },
    }, 3)).toBe(true);
  });

  it("does not treat activity 404 responses as a missing plan", () => {
    expect(isPlanNotFoundError({
      response: { status: 404 },
      config: { url: "/classroom/activities/admin/10" },
    }, 3)).toBe(false);
  });

  it("leaves plan validation errors visible instead of closing the console", () => {
    expect(isPlanNotFoundError({
      response: { status: 400 },
      config: { url: "/classroom/plans/admin/3/start" },
    }, 3)).toBe(false);
  });
});
