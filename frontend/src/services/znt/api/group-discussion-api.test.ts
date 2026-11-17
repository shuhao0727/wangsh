import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../../api";
import { groupDiscussionApi } from "./group-discussion-api";

vi.mock("../../api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock("../../logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockedGet = vi.mocked(api.get);

describe("groupDiscussionApi.listMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks a 403 as forbidden", async () => {
    mockedGet.mockRejectedValueOnce({
      response: { status: 403, data: { detail: "not a member" } },
    });

    const result = await groupDiscussionApi.listMessages({ sessionId: 1 });

    expect(result.success).toBe(false);
    expect(result.forbidden).toBe(true);
  });

  it("does not mark other failures as forbidden", async () => {
    mockedGet.mockRejectedValueOnce({
      response: { status: 500, data: { detail: "server error" } },
    });

    const result = await groupDiscussionApi.listMessages({ sessionId: 1 });

    expect(result.success).toBe(false);
    expect(result.forbidden).toBe(false);
  });
});
