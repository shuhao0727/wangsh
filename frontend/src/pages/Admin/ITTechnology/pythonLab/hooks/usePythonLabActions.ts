import { useCallback, useMemo, type SetStateAction } from "react";
import type { FlowEdge, FlowNode, PortSide } from "../flow/model";
import type { FlowNodeTemplate } from "../types";
import { nodeSize } from "../flow/ports";
import { normalizeTitleForEditInput } from "../flow/titleSemantics";
import { FOR_TEACHING_EXAMPLE_DESCRIPTION } from "../forTeachingExample";
import type { VariableRow } from "../stores/UIStore";

export function usePythonLabActions(params: {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  nextId: (prefix: string) => string;
  codeMode: "auto" | "manual";
  setCodeMode: (v: "auto" | "manual") => void;
  variables: VariableRow[];
  setVariables: React.Dispatch<React.SetStateAction<VariableRow[]>>;
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<FlowEdge[]>>;
  selectedNodeId: string | null;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedEdgeId: string | null;
  setSelectedEdgeId: React.Dispatch<React.SetStateAction<string | null>>;
  setConnectMode: React.Dispatch<React.SetStateAction<boolean>>;
  setConnectFromId: React.Dispatch<React.SetStateAction<string | null>>;
  setConnectFromPort: React.Dispatch<React.SetStateAction<PortSide | null>>;
  offsetX: number;
  offsetY: number;
  scale: number;
}) {
  const {
    canvasRef,
    nextId,
    codeMode,
    setCodeMode,
    variables,
    setVariables,
    setNodes,
    setEdges,
    selectedNodeId,
    setSelectedNodeId,
    selectedEdgeId,
    setSelectedEdgeId,
    setConnectMode,
    setConnectFromId,
    setConnectFromPort,
    offsetX,
    offsetY,
    scale,
  } = params;

  const ensureAuto = useCallback(() => {
    if (codeMode !== "auto") setCodeMode("auto");
  }, [codeMode, setCodeMode]);

  const setNodesAuto = useCallback(
    (next: SetStateAction<FlowNode[]>) => {
      ensureAuto();
      setNodes(next);
    },
    [ensureAuto, setNodes]
  );

  const setEdgesAuto = useCallback(
    (next: SetStateAction<FlowEdge[]>) => {
      ensureAuto();
      setEdges(next);
    },
    [ensureAuto, setEdges]
  );

  const setNodesAndEdgesAuto = useCallback(
    (nextNodes: FlowNode[], nextEdges: FlowEdge[]) => {
      ensureAuto();
      setNodes(nextNodes);
      setEdges(nextEdges);
    },
    [ensureAuto, setEdges, setNodes]
  );

  const setFlowAuto = useCallback(
    (next: {
      nodes: FlowNode[];
      edges: FlowEdge[];
      resetSelection?: boolean;
      resetConnect?: boolean;
      resetVariables?: boolean;
    }) => {
      ensureAuto();
      setNodes(next.nodes);
      setEdges(next.edges);
      if (next.resetSelection) {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
      }
      if (next.resetConnect) {
        setConnectMode(false);
        setConnectFromId(null);
        setConnectFromPort(null);
      }
      if (next.resetVariables) setVariables([]);
    },
    [ensureAuto, setConnectFromId, setConnectFromPort, setConnectMode, setEdges, setNodes, setSelectedEdgeId, setSelectedNodeId, setVariables]
  );

  const addNode = (tpl: FlowNodeTemplate) => {
    ensureAuto();
    const rect = canvasRef.current?.getBoundingClientRect();
    const size = nodeSize(tpl.key);
    // 把屏幕中心转换为画布坐标系：canvasX = (screenCenter - offsetX) / scale
    const screenCenterX = rect ? rect.width / 2 : 400;
    const screenCenterY = rect ? rect.height / 2 : 300;
    const xBase = (screenCenterX - offsetX) / scale - size.w / 2;
    const yBase = (screenCenterY - offsetY) / scale - size.h / 2;
    const node: FlowNode = {
      id: nextId("node"),
      type: tpl.key === "note" ? "annotation" : "flow_element",
      shape: tpl.key,
      title: tpl.key === "note" ? "注释内容" : tpl.title,
      x: Math.max(0, xBase + Math.floor(Math.random() * 60) - 30),
      y: Math.max(0, yBase + Math.floor(Math.random() * 60) - 30),
      ...(tpl.key === "note"
        ? { style: { backgroundColor: "#FFF9C4", opacity: 1, dashed: true } }
        : {}),
    };
    setNodes((prev) => [...prev, node]);
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  };

  const removeSelected = useCallback(() => {
    ensureAuto();
    if (selectedEdgeId) {
      setEdges((prev) => prev.filter((e) => e.id !== selectedEdgeId));
      setSelectedEdgeId(null);
      return;
    }
    if (!selectedNodeId) return;
    setEdges((prev) => prev.filter((e) => e.from !== selectedNodeId && e.to !== selectedNodeId));
    setNodes((prev) => prev.filter((n) => n.id !== selectedNodeId));
    setSelectedNodeId(null);
  }, [ensureAuto, selectedEdgeId, selectedNodeId, setEdges, setNodes, setSelectedEdgeId, setSelectedNodeId]);

  const clearAll = () => {
    setFlowAuto({ nodes: [], edges: [], resetSelection: true, resetConnect: true, resetVariables: true });
  };

  const updateNodeTitle = useCallback(
    (nodeId: string, title: string) => {
      const normalized = normalizeTitleForEditInput(title);
      setNodesAuto((prev) => prev.map((n) => (n.id === nodeId ? { ...n, title: normalized } : n)));
    },
    [setNodesAuto]
  );

  const updateEdgeById = useCallback(
    (edgeId: string, patch: (e: FlowEdge) => FlowEdge) => {
      setEdgesAuto((prev) => prev.map((e) => (e.id === edgeId ? patch(e) : e)));
    },
    [setEdgesAuto]
  );

  const setEdgeStraight = useCallback(
    (edgeId: string) => {
      updateEdgeById(edgeId, (e) => ({ ...e, style: "straight", routeMode: "manual", anchor: null, anchors: undefined }));
    },
    [updateEdgeById]
  );

  const setEdgePolyline = useCallback(
    (edgeId: string) => {
      updateEdgeById(edgeId, (e) => ({ ...e, style: "polyline", routeMode: "manual", anchors: e.anchors ?? (e.anchor ? [e.anchor] : []), anchor: null }));
    },
    [updateEdgeById]
  );

  const clearEdgeAnchors = useCallback(
    (edgeId: string) => {
      updateEdgeById(edgeId, (e) => ({ ...e, style: "polyline", routeMode: "manual", anchors: [], anchor: null }));
    },
    [updateEdgeById]
  );

  const addEdgeAnchor = useCallback(
    (edgeId: string, p: { x: number; y: number }) => {
      updateEdgeById(edgeId, (e) => {
        const list = (e.anchors && e.anchors.length ? e.anchors : e.anchor ? [e.anchor] : []).slice();
        list.push({ x: p.x, y: p.y });
        return { ...e, style: "polyline", routeMode: "manual", anchors: list, anchor: null };
      });
    },
    [updateEdgeById]
  );

  const reverseEdge = useCallback(
    (edgeId: string) => {
      updateEdgeById(edgeId, (e) => ({
        ...e,
        routeMode: "manual",
        from: e.to,
        to: e.from,
        fromPort: e.toPort,
        toPort: e.fromPort,
        fromDir: e.toDir,
        toDir: e.fromDir,
        fromFree: e.toFree ?? null,
        toFree: e.fromFree ?? null,
        toEdge: undefined,
        toEdgeT: undefined,
      }));
    },
    [updateEdgeById]
  );

  const demoOptions = useMemo(
    () => [
      { key: "seq_basic", label: "顺序结构", description: "从上到下逐步执行" },
      { key: "if_basic", label: "if", description: "条件成立才执行" },
      { key: "if_else_basic", label: "if / else", description: "真与假两条路径" },
      { key: "if_elif_else", label: "if / elif / else", description: "多次条件判断" },
      { key: "for_sum_1_10", label: "for", description: FOR_TEACHING_EXAMPLE_DESCRIPTION },
      { key: "list_iter_sum", label: "列表", description: "遍历列表并求和" },
      { key: "dict_word_count", label: "字典", description: "统计每个单词出现次数" },
      { key: "while_sum_1_10", label: "while", description: "条件满足时重复执行" },
      { key: "func_sum_1_100", label: "自定义函数", description: "定义函数并调用函数" },
      { key: "fib_iter", label: "斐波那契", description: "循环更新前后两项" },
    ],
    []
  );

  const demoCodes: Record<string, string> = {
    seq_basic:
      "a = 3\nb = 5\nc = a + b\nprint(c)\n",
    if_basic:
      "x = 5\nif x > 0:\n    print('positive')\n",
    if_else_basic:
      "x = 7\nif x % 2 == 0:\n    msg = 'even'\nelse:\n    msg = 'odd'\nprint(msg)\n",
    if_elif_else:
      "score = 85\nif score >= 90:\n    grade = 'A'\nelif score >= 60:\n    grade = 'B'\nelse:\n    grade = 'C'\nprint(grade)\n",
    for_sum_1_10:
      "total = 0\nfor i in range(1, 10):\n    total += i\nprint(total)\n",
    list_iter_sum:
      "nums = [1, 2, 3, 4, 5]\ntotal = 0\nfor x in nums:\n    total += x\nprint(total)\n",
    dict_word_count:
      "text = \"a b a c b a\"\ncounter = {}\nfor w in text.split():\n    counter[w] = counter.get(w, 0) + 1\nprint(counter)\n",
    while_sum_1_10:
      "total = 0\ni = 1\nwhile i <= 10:\n    total += i\n    i += 1\nprint(total)\n",
    func_sum_1_100:
      "def sum_n(n):\n    total = 0\n    for i in range(1, n + 1):\n        total += i\n    return total\n\nans = sum_n(100)\nprint(ans)\n",
    fib_iter:
      "n = 10\na = 0\nb = 1\nfor i in range(n):\n    print(a)\n    a, b = b, a + b\n",
  };

  const getDemo = (key: string): { nodes: FlowNode[]; edges: FlowEdge[]; code?: string; codeMode?: "auto" | "manual" } => {
    const k = key || "seq_basic";
    const code = demoCodes[k] ?? demoCodes.seq_basic;
    return { nodes: [], edges: [], code, codeMode: "manual" };
  };

  const peekDemoFlow = (key?: string) => {
    return getDemo(key ?? "seq_basic");
  };

  const loadDemoFlow = (key?: string) => {
    const demo = getDemo(key ?? "seq_basic");
    if (demo.codeMode !== "manual") ensureAuto();
    setFlowAuto({ nodes: demo.nodes, edges: demo.edges, resetSelection: true, resetConnect: true, resetVariables: true });
    return { code: demo.code, codeMode: demo.codeMode, nodes: demo.nodes, edges: demo.edges };
  };

  const mockStep = () => {
    const key = nextId("var");
    const idx = variables.length + 1;
    const row: VariableRow = {
      key,
      name: idx === 1 ? "i" : idx === 2 ? "total" : `v${idx}`,
      value: idx === 1 ? "1" : idx === 2 ? "1" : String(idx * 2),
      type: "int",
    };
    setVariables((prev) => [...prev, row].slice(-12));
  };

  return {
    ensureAuto,
    setNodesAuto,
    setEdgesAuto,
    setNodesAndEdgesAuto,
    setFlowAuto,
    addNode,
    removeSelected,
    clearAll,
    updateNodeTitle,
    setEdgeStraight,
    setEdgePolyline,
    clearEdgeAnchors,
    addEdgeAnchor,
    reverseEdge,
    loadDemoFlow,
    peekDemoFlow,
    demoOptions,
    mockStep,
  };
}
