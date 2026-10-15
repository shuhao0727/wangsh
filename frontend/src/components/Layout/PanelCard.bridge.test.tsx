import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PanelCard from "./PanelCard";

describe("PanelCard article CSS bridge", () => {
  it("applies article scope to the outer card and preserves existing content/padding without it", () => {
    const { container, rerender } = render(<PanelCard title="文章列表" bodyPadding="16px" className="articles-panel-card">列表内容</PanelCard>);
    expect(container.firstElementChild).toHaveClass("informatics-card", "overflow-hidden", "articles-panel-card");
    const body = screen.getByText("列表内容");
    expect(body).toHaveClass("panel-card-body");
    expect(body).not.toHaveClass("articles-panel-card");
    expect(body).toHaveStyle({ padding: "16px" });
    rerender(<PanelCard title="文章列表">列表内容</PanelCard>);
    expect(container.firstElementChild).toHaveClass("informatics-card", "overflow-hidden");
    expect(container.firstElementChild).not.toHaveClass("articles-panel-card");
    expect(screen.getByText("文章列表")).toBeInTheDocument();
    expect(screen.getByText("列表内容")).toHaveStyle({ padding: "12px" });
  });
});
