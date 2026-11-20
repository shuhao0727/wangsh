import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TypstNoteEditor from "@pages/Admin/Informatics/TypstNoteEditor";
import { showMessage } from "@/lib/toast";
import { typstNotesApi, type TypstNote } from "@services";

vi.mock("@services", () => ({
  publicTypstNotesApi: { listStyles: vi.fn(async () => ["my_style"]) },
  typstCategoriesApi: { list: vi.fn(async () => []) },
  typstStylesApi: { list: vi.fn(async () => []) },
  typstNotesApi: {
    create: vi.fn(),
    update: vi.fn(),
    compilePdf: vi.fn(),
    listAssets: vi.fn(async () => []),
  },
}));
vi.mock("@/lib/toast", () => ({
  showMessage: { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));
vi.mock("@components/Pdf/PdfCanvasVirtualViewer", () => ({
  default: ({ data }: { data?: Uint8Array | null }) => <output aria-label="预览 PDF 字节">{data?.length ?? 0}</output>,
}));

const note: TypstNote = {
  id: 19,
  title: "合成课件",
  published: true,
  entry_path: "handout.typ",
  files: {
    "handout.typ": '#import "layout.typ": layout\n#show: layout\n= 原笔记',
    "layout.typ": "#let layout(body) = body",
  },
  content_typst: "旧正文缓存",
  created_at: "2030-01-01",
  updated_at: "2030-01-01",
};

function openEditor(saved: TypstNote | null) {
  return render(<TypstNoteEditor note={saved} isCreateMode={!saved} onBack={vi.fn()} onCreated={vi.fn()} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("matchMedia", vi.fn((media: string) => ({
    matches: true, media, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })));
  vi.mocked(typstNotesApi.create).mockResolvedValue(note);
  vi.mocked(typstNotesApi.update).mockResolvedValue(note);
  vi.mocked(typstNotesApi.compilePdf).mockRejectedValue(new Error("合成编译失败"));
});

afterEach(() => vi.unstubAllGlobals());

describe("Typst preview and explicit save", () => {
  it("keeps the new draft in the editor and asks to save before either preview mode", async () => {
    openEditor(null);
    const editor = screen.getByPlaceholderText("输入 Typst 内容…");
    fireEvent.change(editor, { target: { value: "= 合成草稿" } });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "预览" }));
    await user.click(screen.getByRole("button", { name: "分屏" }));
    expect(showMessage.info).toHaveBeenCalledTimes(2);
    expect(screen.getByPlaceholderText("输入 Typst 内容…")).toHaveValue("= 合成草稿");
    expect(typstNotesApi.create).not.toHaveBeenCalled();
    expect(typstNotesApi.compilePdf).not.toHaveBeenCalled();
  });

  it("compiles the saved note without sending draft content or publication fields", async () => {
    openEditor(note);
    const user = userEvent.setup();
    await screen.findByText("合成编译失败");
    await user.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByPlaceholderText("输入 Typst 内容…"), { target: { value: "= 未提交正文" } });
    await user.click(screen.getByRole("button", { name: "预览" }));
    await screen.findByText("合成编译失败");
    expect(vi.mocked(typstNotesApi.compilePdf).mock.calls.map(([id]) => id)).toEqual([19, 19]);
    expect(typstNotesApi.update).not.toHaveBeenCalled();
    expect(typstNotesApi.create).not.toHaveBeenCalled();
  });

  it("keeps the rendered PDF when the same note is fetched again after creation", async () => {
    vi.mocked(typstNotesApi.compilePdf).mockResolvedValue({
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    } as Blob);
    const { rerender } = openEditor(note);
    const bytes = screen.getByLabelText("预览 PDF 字节");
    await waitFor(() => expect(bytes).toHaveTextContent("3"));
    rerender(<TypstNoteEditor note={{ ...note }} isCreateMode={false} onBack={vi.fn()} onCreated={vi.fn()} />);
    expect(bytes).toHaveTextContent("3");
    expect(typstNotesApi.compilePdf).toHaveBeenCalledOnce();
  });

  it("edits the stored entry and preserves other project files on save", async () => {
    openEditor(note);
    const user = userEvent.setup();
    const editor = screen.getByPlaceholderText("输入 Typst 内容…");
    expect(editor).toHaveValue(note.files?.["handout.typ"]);
    const edited = '#import "layout.typ": layout\n#show: layout\n= 显式保存';
    fireEvent.change(editor, { target: { value: edited } });
    await user.click(screen.getAllByRole("button", { name: "保存" }).at(-1)!);
    await waitFor(() => expect(typstNotesApi.update).toHaveBeenCalledExactlyOnceWith(19, expect.objectContaining({
      entry_path: "handout.typ",
      files: { ...note.files, "handout.typ": edited },
      content_typst: edited,
      published: true,
    })));
  });
});
