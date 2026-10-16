import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import ArticleEditorSidebar from "@/pages/Admin/Articles/components/ArticleEditorSidebar";
import LineNumberedMarkdownTextArea from "@/pages/Admin/Articles/LineNumberedMarkdownTextArea";
import ArticlePreviewContent from "@/pages/Admin/Articles/components/ArticlePreviewContent";

function FormHarness({ onSave }: { onSave: (values: unknown) => void }) {
  const form = useForm({ defaultValues: { title: "草稿", summary: "", published: false, category_id: "" } });
  return <FormProvider {...form}><form onSubmit={form.handleSubmit(onSave)}>
    <ArticleEditorSidebar categories={[]} loading={false} styleOptions={[]} styleKey={null} onStyleKeyChange={() => undefined} onOpenStyleManager={() => undefined} />
    <button type="submit">保存</button>
  </form></FormProvider>;
}

describe("article editor controls and preview", () => {
  it("submits the edited title, summary and publishing state through the form", async () => {
    const user = userEvent.setup(); const save = vi.fn();
    render(<FormHarness onSave={save} />);
    await user.clear(screen.getByLabelText("文章标题"));
    await user.type(screen.getByLabelText("文章标题"), "编辑后的标题");
    await user.type(screen.getByLabelText("文章摘要"), "内容摘要");
    await user.click(screen.getByLabelText("发布状态"));
    await user.click(screen.getByRole("button", { name: /^保存$/ }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ title: "编辑后的标题", summary: "内容摘要", published: true }), expect.anything());
  });

  it("exposes the body control and forwards entered Markdown", async () => {
    const change = vi.fn(); const user = userEvent.setup();
    render(<LineNumberedMarkdownTextArea value="" onChange={change} />);
    await user.type(screen.getByRole("textbox", { name: "文章正文" }), "#");
    expect(change).toHaveBeenCalledWith("#");
  });

  it("renders GFM content and keeps raw HTML inert", () => {
    const { container } = render(<ArticlePreviewContent scopeId="direct" content={"# 标题\n\n| 名称 | 值 |\n| --- | --- |\n| 条目 | 1 |\n\n<script>alert(1)</script>"} />);
    expect(screen.getByRole("heading", { name: "标题" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
  });
});
