import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import EditorPage from "@/pages/Admin/Assessment/EditorPage";

vi.mock("@/lib/toast", () => ({
  showMessage: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@services/assessment", () => ({
  assessmentConfigApi: {
    create: vi.fn(),
  },
}));

vi.mock("@services/agents", () => ({
  aiAgentsApi: {
    getAgents: vi.fn().mockResolvedValue({
      success: true,
      data: { items: [] },
    }),
  },
}));

describe("assessment editor routes", () => {
  it("renders the creation form for the static new route", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/assessment/editor/new"]}>
        <Routes>
          <Route path="/admin/assessment/editor/new" element={<EditorPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("textbox", { name: "测评标题" })).toBeInTheDocument();
  });
});
