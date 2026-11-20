import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { FlowEdge, FlowNode } from "../../flow/model";
import { usePythonFlowSync } from "../../hooks/usePythonFlowSync";
import { usePythonLabActions } from "../../hooks/usePythonLabActions";
import { pythonlabFlowApi, type PythonLabFlowResponse } from "../../services/pythonlabCodeApi";
import { CodeCtxProvider } from "../../stores/CodeContext";
import { RightPanel } from "./RightPanelView";

vi.mock("../../services/pythonlabCodeApi", () => ({
  pythonlabFlowApi: { parseFlow: vi.fn(), generateCode: vi.fn() },
  pythonlabSyntaxApi: { checkSyntax: vi.fn().mockResolvedValue({ ok: true }) },
}));
vi.mock("../../flow/beautify", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../flow/beautify")>(),
  computeBeautify: async (nodes: FlowNode[], edges: FlowEdge[]) => ({ layout: { nodes, edges } }),
}));
vi.mock("../../stores/FlowContext", () => ({ useFlow: () => ({ nodes: [], edges: [] }) }));
vi.mock("../../stores/UIContext", () => ({ useUI: () => ({}), VARIABLE_COLUMNS: [] }));
vi.mock("../../stores/RunnerActionsContext", () => ({
  useRunnerActions: () => ({ runner: { status: "idle", breakpoints: [] }, activeRunnerKind: "pyodide" }),
}));
vi.mock("../../hooks/useWsAccessToken", () => ({ useWsAccessToken: () => ({ status: "idle" }) }));
vi.mock("../XtermTerminal", () => ({ default: () => null }));
vi.mock("../PyodideTerminal", () => ({ default: () => null }));
vi.mock("../LazyMonacoPythonEditor", () => ({
  LazyMonacoPythonEditor: ({ value }: { value: string }) => <textarea aria-label="Python 源码" value={value} readOnly />,
}));

const noop = () => {};
const canvasRef = { current: null };

function Workspace({ source }: { source: string }) {
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const graph = {
    canvasRef, setNodes, setEdges,
    setSelectedNodeId: noop, setSelectedEdgeId: noop, setConnectFromId: noop, setConnectFromPort: noop,
  };
  const sync = usePythonFlowSync({
    ...graph, nodes, edges, starterCode: source, preferBackendCfg: true, autoLayout: false,
    setScale: noop, setOffsetX: noop, setOffsetY: noop,
  });
  const { updateNodeTitle } = usePythonLabActions({
    ...graph, codeMode: sync.codeMode, setCodeMode: sync.setCodeMode,
    nextId: (prefix) => prefix, variables: [], setVariables: noop,
    selectedNodeId: null, selectedEdgeId: null, setConnectMode: noop, offsetX: 0, offsetY: 0, scale: 1,
  });
  const node = nodes.find(({ id }) => id === "statement");
  return (
    <CodeCtxProvider value={sync}>
      <output aria-label="同步模式">{sync.codeMode}</output>
      {node && <input aria-label="节点标题" value={node.title} onChange={(e) => updateNodeTitle(node.id, e.target.value)} />}
      <RightPanel />
    </CodeCtxProvider>
  );
}

const shortSource = "n = 1\n";
const longSource = `text = '${"a".repeat(600)}'\n`;
const truncatedTitle = `${longSource.slice(0, 512)}…`;
const timeoutTitle = "解析超时，已回退到稳定展示";

function flowResponse(source: string, title: string, kind: "Stmt" | "Fallback"): PythonLabFlowResponse {
  const range = { startLine: 1, startCol: 1, endLine: 1, endCol: kind === "Fallback" ? 1 : source.trimEnd().length + 1 };
  return {
    version: "test", parserVersion: "test", codeSha256: "source-hash",
    entryNodeId: "statement", exitNodeIds: ["statement"], exitEdges: [{ from: "statement", kind: "Next" }],
    nodes: [
      { id: "module", kind: "Module", title: "main.py", range: { ...range, endCol: 1 }, parentId: null },
      { id: "statement", kind, title, range, parentId: "module", ...(title === truncatedTitle ? { fullTitle: source.trimEnd() } : {}) },
    ],
    edges: [{ id: "entry", from: "module", to: "statement", kind: "Entry" }],
    diagnostics: kind === "Fallback" ? [{ level: "error", code: "E_PARSE_TIMEOUT", message: "解析超时，已中止" }] : [],
    stats: { truncated: false },
  };
}

async function renderParsed(source: string, title: string, kind: "Stmt" | "Fallback" = "Stmt") {
  vi.mocked(pythonlabFlowApi.parseFlow).mockResolvedValueOnce(flowResponse(source, title, kind));
  render(<Workspace source={source} />);
  await act(() => vi.advanceTimersByTimeAsync(600));
  expect(pythonlabFlowApi.parseFlow).toHaveBeenCalledWith(source, expect.any(Object), expect.any(Object));
  const nodeTitle = screen.getByRole("textbox", { name: "节点标题" });
  const editor = screen.getByRole("textbox", { name: "Python 源码" });
  const syncButton = screen.getByRole("button", { name: "从流程图同步" });
  expect(nodeTitle).toHaveValue(title);
  expect(editor).toHaveValue(source);
  return { nodeTitle, editor, syncButton };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.mocked(pythonlabFlowApi.generateCode).mockResolvedValue({ code: "n = 999\n" });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

test.each([
  { label: "截断标题", source: longSource, title: truncatedTitle, kind: "Stmt" },
  { label: "超时占位图", source: "n = 7\n", title: timeoutTitle, kind: "Fallback" },
] as const)("$label：同步按钮保留原稿与画布", async ({ source, title, kind }) => {
  const { editor, nodeTitle, syncButton } = await renderParsed(source, title, kind);
  fireEvent.click(syncButton);
  expect(editor).toHaveValue(source);
  expect(nodeTitle).toHaveValue(title);
  expect(syncButton).toBeDisabled();
});

test.each([
  { label: "截断标题", source: longSource, title: truncatedTitle, kind: "Stmt" },
  { label: "超时占位图", source: "n = 7\n", title: timeoutTitle, kind: "Fallback" },
] as const)("$label：画布编辑触发自动模式仍保留原稿", async ({ source, title, kind }) => {
  const { editor, nodeTitle } = await renderParsed(source, title, kind);
  fireEvent.change(nodeTitle, { target: { value: "n = 2" } });
  await act(() => vi.advanceTimersByTimeAsync(600));
  expect(screen.getByRole("status", { name: "同步模式" })).toHaveTextContent("auto");
  expect(nodeTitle).toHaveValue("n = 2");
  expect(editor).toHaveValue(source);
  expect(pythonlabFlowApi.generateCode).not.toHaveBeenCalled();
});

test.each(["同步按钮", "画布编辑"])("短赋值经%s仍可往返并回写画布修改", async (entry) => {
  const { editor, nodeTitle, syncButton } = await renderParsed(shortSource, shortSource.trimEnd());
  expect(syncButton).toBeEnabled();
  if (entry === "同步按钮") {
    fireEvent.click(syncButton);
    expect(editor).toHaveValue(shortSource);
  }
  fireEvent.change(nodeTitle, { target: { value: "n = 2" } });
  expect(editor).toHaveValue("n = 2\n");
});
