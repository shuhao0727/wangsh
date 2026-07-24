import { render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MindMapEditor from "@/pages/Admin/ITTechnology/learning/MindMapEditor";

vi.mock("react-router-dom", () => ({
  useParams: () => ({ moduleKey: "ml" }),
}));

vi.mock("@/lib/toast", () => ({
  showMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const response = (status: number, data: unknown = null) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(data),
  }) as unknown as Response;

describe("MindMapEditor async loading", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response(200, [
          {
            section_key: "mindmap",
            item_key: "overview",
            title: "机器学习导图",
            content: { markdown: "# 机器学习" },
          },
        ]),
      ),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not abort the initial module request during StrictMode effect replay", async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, "abort");

    render(
      <StrictMode>
        <MindMapEditor />
      </StrictMode>,
    );

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(abortSpy).not.toHaveBeenCalled();
  });
});
