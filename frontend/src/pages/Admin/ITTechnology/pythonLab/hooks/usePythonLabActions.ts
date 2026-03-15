import { useCallback, useMemo, type SetStateAction } from "react";
import type { FlowEdge, FlowNode, PortSide } from "../flow/model";
import type { FlowNodeTemplate } from "../types";
import { nodeSize } from "../flow/ports";
import { normalizeTitleForEditInput } from "../flow/titleSemantics";
import { FOR_TEACHING_EXAMPLE_CODE, FOR_TEACHING_EXAMPLE_DESCRIPTION } from "../forTeachingExample";

type VariableRow = {
  key: string;
  name: string;
  value: string;
  type: string;
};

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
    const xBase = rect ? Math.max(16, (rect.width - size.w) / 2) : 120;
    const yBase = rect ? Math.max(16, (rect.height - size.h) / 2) : 120;
    const node: FlowNode = {
      id: nextId("node"),
      type: tpl.key === "note" ? "annotation" : "flow_element",
      shape: tpl.key,
      title: tpl.key === "note" ? "注释内容" : tpl.title,
      x: xBase + Math.floor(Math.random() * 80) - 40,
      y: yBase + Math.floor(Math.random() * 80) - 40,
      ...(tpl.key === "note"
        ? {
          style: { backgroundColor: "#FFF9C4", opacity: 1, dashed: true },
        }
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

  const getDemo = (key: string): { nodes: FlowNode[]; edges: FlowEdge[]; code?: string; codeMode?: "auto" | "manual" } => {
    const k = key || "seq_basic";
    const id = (name: string) => `demo_${k}_${name}`;

    if (k === "seq_basic") {
      const nodes: FlowNode[] = [
        { type: "flow_element", id: id("start"), shape: "start_end", title: "开始", x: 320, y: 60 },
        { type: "flow_element", id: id("a"), shape: "process", title: "a = 3", x: 320, y: 160, sourceLine: 1 },
        { type: "flow_element", id: id("b"), shape: "process", title: "b = 5", x: 320, y: 260, sourceLine: 2 },
        { type: "flow_element", id: id("c"), shape: "process", title: "c = a + b", x: 320, y: 360, sourceLine: 3 },
        { type: "flow_element", id: id("out"), shape: "io", title: "print(c)", x: 320, y: 460, sourceLine: 4 },
        { type: "flow_element", id: id("end"), shape: "start_end", title: "结束", x: 320, y: 560 },
      ];
      const edges: FlowEdge[] = [
        { id: id("e1"), from: nodes[0].id, to: nodes[1].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("e2"), from: nodes[1].id, to: nodes[2].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("e3"), from: nodes[2].id, to: nodes[3].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("e4"), from: nodes[3].id, to: nodes[4].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("e5"), from: nodes[4].id, to: nodes[5].id, style: "straight", routeMode: "auto", anchor: null },
      ];
      return { nodes, edges };
    }

    if (k === "list_iter_sum") {
      return {
        nodes: [],
        edges: [],
        code: "nums = [1, 2, 3, 4, 5]\ntotal = 0\nfor x in nums:\n    total += x\nprint(total)\n",
        codeMode: "manual",
      };
    }

    if (k === "dict_word_count") {
      return {
        nodes: [],
        edges: [],
        code: "text = \"a b a c b a\"\ncounter = {}\nfor w in text.split():\n    counter[w] = counter.get(w, 0) + 1\nprint(counter)\n",
        codeMode: "manual",
      };
    }

    if (k === "if_basic") {
      const nodes: FlowNode[] = [
        { type: "flow_element", id: id("start"), shape: "start_end", title: "开始", x: 320, y: 60 },
        { type: "flow_element", id: id("x"), shape: "process", title: "x = 5", x: 320, y: 160, sourceLine: 1 },
        { type: "flow_element", id: id("cond"), shape: "decision", title: "x > 0 ?", x: 320, y: 260, sourceLine: 2 },
        { type: "flow_element", id: id("pos"), shape: "io", title: "print('positive')", x: 320, y: 380, sourceLine: 3 },
        { type: "flow_element", id: id("end"), shape: "start_end", title: "结束", x: 320, y: 500 },
      ];
      const edges: FlowEdge[] = [
        { id: id("e1"), from: nodes[0].id, to: nodes[1].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("e2"), from: nodes[1].id, to: nodes[2].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("e3"), from: nodes[2].id, to: nodes[3].id, style: "straight", routeMode: "auto", anchor: null, label: "是", fromPort: "bottom" },
        { id: id("e4"), from: nodes[3].id, to: nodes[4].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("e5"), from: nodes[2].id, to: nodes[4].id, style: "straight", routeMode: "auto", anchor: null, label: "否", fromPort: "right" },
      ];
      return { nodes, edges };
    }

    if (k === "if_else_basic") {
      const nodes: FlowNode[] = [
        { type: "flow_element", id: id("start"), shape: "start_end", title: "开始", x: 320, y: 60 },
        { type: "flow_element", id: id("x"), shape: "process", title: "x = 7", x: 320, y: 160, sourceLine: 1 },
        { type: "flow_element", id: id("cond"), shape: "decision", title: "x % 2 == 0 ?", x: 320, y: 260, sourceLine: 2 },
        { type: "flow_element", id: id("even"), shape: "process", title: "msg = 'even'", x: 320, y: 380, sourceLine: 3 },
        { type: "flow_element", id: id("odd"), shape: "process", title: "msg = 'odd'", x: 680, y: 260, sourceLine: 5 },
        { type: "flow_element", id: id("out"), shape: "io", title: "print(msg)", x: 320, y: 500, sourceLine: 6 },
        { type: "flow_element", id: id("end"), shape: "start_end", title: "结束", x: 320, y: 600 },
      ];
      const edges: FlowEdge[] = [
        { id: id("e1"), from: nodes[0].id, to: nodes[1].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("e2"), from: nodes[1].id, to: nodes[2].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("e3"), from: nodes[2].id, to: nodes[3].id, style: "straight", routeMode: "auto", anchor: null, label: "是", fromPort: "bottom" },
        { id: id("e4"), from: nodes[2].id, to: nodes[4].id, style: "straight", routeMode: "auto", anchor: null, label: "否", fromPort: "right" },
        { id: id("e5"), from: nodes[3].id, to: nodes[5].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("e6"), from: nodes[4].id, to: nodes[5].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("e7"), from: nodes[5].id, to: nodes[6].id, style: "straight", routeMode: "auto", anchor: null },
      ];
      return { nodes, edges };
    }

    if (k === "if_elif_else") {
      const nodes: FlowNode[] = [
        { type: "flow_element", id: id("start"), shape: "start_end", title: "开始", x: 320, y: 60 },
        { type: "flow_element", id: id("score"), shape: "process", title: "score = 85", x: 320, y: 160, sourceLine: 1 },
        { type: "flow_element", id: id("cond1"), shape: "decision", title: "score >= 90 ?", x: 320, y: 260, sourceLine: 2 },
        { type: "flow_element", id: id("gradeA"), shape: "process", title: "grade = 'A'", x: 320, y: 380, sourceLine: 3 },
        { type: "flow_element", id: id("cond2"), shape: "decision", title: "score >= 60 ?", x: 600, y: 260, sourceLine: 4 },
        { type: "flow_element", id: id("gradeB"), shape: "process", title: "grade = 'B'", x: 600, y: 380, sourceLine: 5 },
        { type: "flow_element", id: id("gradeC"), shape: "process", title: "grade = 'C'", x: 880, y: 260, sourceLine: 7 },
        { type: "flow_element", id: id("out"), shape: "io", title: "print(grade)", x: 320, y: 500, sourceLine: 8 },
        { type: "flow_element", id: id("end"), shape: "start_end", title: "结束", x: 320, y: 600 },
      ];
      const edges: FlowEdge[] = [
        { id: id("e1"), from: nodes[0].id, to: nodes[1].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("e2"), from: nodes[1].id, to: nodes[2].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("e3"), from: nodes[2].id, to: nodes[3].id, style: "straight", routeMode: "auto", anchor: null, label: "是", fromPort: "bottom" },
        { id: id("e4"), from: nodes[2].id, to: nodes[4].id, style: "straight", routeMode: "auto", anchor: null, label: "否", fromPort: "right" },
        { id: id("e5"), from: nodes[4].id, to: nodes[5].id, style: "straight", routeMode: "auto", anchor: null, label: "是", fromPort: "bottom" },
        { id: id("e6"), from: nodes[4].id, to: nodes[6].id, style: "straight", routeMode: "auto", anchor: null, label: "否", fromPort: "right" },
        { id: id("e7"), from: nodes[3].id, to: nodes[7].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("e8"), from: nodes[5].id, to: nodes[7].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("e9"), from: nodes[6].id, to: nodes[7].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("e10"), from: nodes[7].id, to: nodes[8].id, style: "straight", routeMode: "auto", anchor: null },
      ];
      return { nodes, edges };
    }

    if (k === "while_sum_1_10") {
      const nodes: FlowNode[] = [
        { type: "flow_element", id: id("start"), shape: "start_end", title: "开始", x: 320, y: 60 },
        { type: "flow_element", id: id("total0"), shape: "process", title: "total = 0", x: 320, y: 160, sourceLine: 1 },
        { type: "flow_element", id: id("i1"), shape: "process", title: "i = 1", x: 320, y: 260, sourceLine: 2 },
        { type: "flow_element", id: id("cond"), shape: "decision", title: "i <= 10 ?", x: 320, y: 360, sourceLine: 3 },
        { type: "flow_element", id: id("add"), shape: "process", title: "total += i", x: 320, y: 480, sourceLine: 4 },
        { type: "flow_element", id: id("inc"), shape: "process", title: "i += 1", x: 320, y: 580, sourceLine: 5 },
        { type: "flow_element", id: id("out"), shape: "io", title: "print(total)", x: 680, y: 360, sourceLine: 6 },
        { type: "flow_element", id: id("end"), shape: "start_end", title: "结束", x: 680, y: 460 },
      ];
      const edges: FlowEdge[] = [
        { id: id("e1"), from: nodes[0].id, to: nodes[1].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("e2"), from: nodes[1].id, to: nodes[2].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("e3"), from: nodes[2].id, to: nodes[3].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("e4"), from: nodes[3].id, to: nodes[4].id, style: "straight", routeMode: "auto", anchor: null, label: "是", fromPort: "bottom" },
        { id: id("e5"), from: nodes[4].id, to: nodes[5].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("e6"), from: nodes[5].id, to: nodes[3].id, style: "straight", routeMode: "auto", anchor: null, fromPort: "left", toPort: "left" },
        { id: id("e7"), from: nodes[3].id, to: nodes[6].id, style: "straight", routeMode: "auto", anchor: null, label: "否", fromPort: "right" },
        { id: id("e8"), from: nodes[6].id, to: nodes[7].id, style: "straight", routeMode: "auto", anchor: null },
      ];
      const code =
        "total = 0\n" +
        "i = 1\n" +
        "while i <= 10:\n" +
        "  total += i\n" +
        "  i += 1\n" +
        "print(total)\n";
      return { nodes, edges, code, codeMode: "manual" };
    }

    if (k === "for_sum_1_10") {
      return { nodes: [], edges: [], code: FOR_TEACHING_EXAMPLE_CODE, codeMode: "manual" };
    }

    if (k === "fib_iter") {
      const nodes: FlowNode[] = [
        { type: "flow_element", id: id("start"), shape: "start_end", title: "开始", x: 320, y: 60 },
        { type: "flow_element", id: id("n"), shape: "process", title: "n = 10", x: 320, y: 160, sourceLine: 1 },
        { type: "flow_element", id: id("a0"), shape: "process", title: "a = 0", x: 320, y: 260, sourceLine: 2 },
        { type: "flow_element", id: id("b1"), shape: "process", title: "b = 1", x: 320, y: 360, sourceLine: 3 },
        { type: "flow_element", id: id("i0"), shape: "process", title: "i = 0", x: 320, y: 460, sourceLine: 4 },
        { type: "flow_element", id: id("cond"), shape: "decision", title: "i < n ?", x: 320, y: 560, sourceLine: 5 },
        { type: "flow_element", id: id("out"), shape: "io", title: "print(a)", x: 320, y: 680, sourceLine: 6 },
        { type: "flow_element", id: id("step1"), shape: "process", title: "a, b = b, a + b", x: 320, y: 780, sourceLine: 7 },
        { type: "flow_element", id: id("step2"), shape: "process", title: "i += 1", x: 320, y: 880, sourceLine: 8 },
        { type: "flow_element", id: id("end"), shape: "start_end", title: "结束", x: 680, y: 560 },
      ];
      const edges: FlowEdge[] = [
        { id: id("e1"), from: nodes[0].id, to: nodes[1].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("e2"), from: nodes[1].id, to: nodes[2].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("e3"), from: nodes[2].id, to: nodes[3].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("e4"), from: nodes[3].id, to: nodes[4].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("e5"), from: nodes[4].id, to: nodes[5].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("e6"), from: nodes[5].id, to: nodes[6].id, style: "straight", routeMode: "auto", anchor: null, label: "是", fromPort: "bottom" },
        { id: id("e7"), from: nodes[6].id, to: nodes[7].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("e8"), from: nodes[7].id, to: nodes[8].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("e9"), from: nodes[8].id, to: nodes[5].id, style: "straight", routeMode: "auto", anchor: null, fromPort: "left", toPort: "left" },
        { id: id("e10"), from: nodes[5].id, to: nodes[9].id, style: "straight", routeMode: "auto", anchor: null, label: "否", fromPort: "right" },
      ];
      return { nodes, edges };
    }

    if (k === "func_sum_1_100") {
      const fnNodes: FlowNode[] = [
        { type: "flow_element", id: id("fn_start"), shape: "start_end", title: "sum_n(n)", x: 260, y: 60, sourceLine: 1 },
        { type: "flow_element", id: id("fn_total0"), shape: "process", title: "total = 0", x: 260, y: 160, sourceLine: 2 },
        { type: "flow_element", id: id("fn_i1"), shape: "process", title: "i = 1", x: 260, y: 260, sourceLine: 3, sourceRole: "for_init" },
        { type: "flow_element", id: id("fn_cond"), shape: "decision", title: "i <= n ?", x: 260, y: 360, sourceLine: 3, sourceRole: "for_check" },
        { type: "flow_element", id: id("fn_add"), shape: "process", title: "total += i", x: 260, y: 480, sourceLine: 4 },
        { type: "flow_element", id: id("fn_inc"), shape: "process", title: "i += 1", x: 260, y: 580, sourceLine: 3, sourceRole: "for_inc" },
        { type: "flow_element", id: id("fn_ret"), shape: "process", title: "return total", x: 600, y: 360, sourceLine: 5 },
        { type: "flow_element", id: id("fn_end"), shape: "start_end", title: "返回", x: 600, y: 460 },
      ];
      const fnEdges: FlowEdge[] = [
        { id: id("fe1"), from: fnNodes[0].id, to: fnNodes[1].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("fe2"), from: fnNodes[1].id, to: fnNodes[2].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("fe3"), from: fnNodes[2].id, to: fnNodes[3].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("fe4"), from: fnNodes[3].id, to: fnNodes[4].id, style: "straight", routeMode: "auto", anchor: null, label: "是", fromPort: "bottom" },
        { id: id("fe5"), from: fnNodes[4].id, to: fnNodes[5].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("fe6"), from: fnNodes[5].id, to: fnNodes[3].id, style: "straight", routeMode: "auto", anchor: null, fromPort: "left", toPort: "left" },
        { id: id("fe7"), from: fnNodes[3].id, to: fnNodes[6].id, style: "straight", routeMode: "auto", anchor: null, label: "否", fromPort: "right" },
        { id: id("fe8"), from: fnNodes[6].id, to: fnNodes[7].id, style: "straight", routeMode: "auto", anchor: null },
      ];

      const mainNodes: FlowNode[] = [
        { type: "flow_element", id: id("main_start"), shape: "start_end", title: "开始", x: 260, y: 760 },
        { type: "flow_element", id: id("main_call"), shape: "subroutine", title: "ans = sum_n(100)", x: 260, y: 860, sourceLine: 7 },
        { type: "flow_element", id: id("main_out"), shape: "io", title: "print(ans)", x: 260, y: 980, sourceLine: 8 },
        { type: "flow_element", id: id("main_end"), shape: "start_end", title: "结束", x: 260, y: 1080 },
      ];
      const mainEdges: FlowEdge[] = [
        { id: id("me1"), from: mainNodes[0].id, to: mainNodes[1].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("me2"), from: mainNodes[1].id, to: mainNodes[2].id, style: "straight", routeMode: "auto", anchor: null },
        { id: id("me3"), from: mainNodes[2].id, to: mainNodes[3].id, style: "straight", routeMode: "auto", anchor: null },
      ];

      const code =
        "def sum_n(n):\n" +
        "  total = 0\n" +
        "  for i in range(1, n + 1):\n" +
        "    total += i\n" +
        "  return total\n" +
        "\n" +
        "ans = sum_n(100)\n" +
        "print(ans)\n";

      return { nodes: [...fnNodes, ...mainNodes], edges: [...fnEdges, ...mainEdges], code, codeMode: "manual" };
    }

    const nodes: FlowNode[] = [
      { type: "flow_element", id: id("start"), shape: "start_end", title: "开始", x: 320, y: 60 },
      { type: "flow_element", id: id("total0"), shape: "process", title: "total = 0", x: 320, y: 160 },
      { type: "flow_element", id: id("i10"), shape: "process", title: "i = 10", x: 320, y: 260 },
      { type: "flow_element", id: id("decision"), shape: "decision", title: "i >= 1 ?", x: 320, y: 360 },
      { type: "flow_element", id: id("add"), shape: "process", title: "total += i", x: 320, y: 480 },
      { type: "flow_element", id: id("dec"), shape: "process", title: "i -= 1", x: 320, y: 580 },
      { type: "flow_element", id: id("print"), shape: "io", title: "print(total)", x: 680, y: 360 },
      { type: "flow_element", id: id("end"), shape: "start_end", title: "结束", x: 680, y: 460 },
    ];
    const edges: FlowEdge[] = [
      { id: id("e1"), from: nodes[0].id, to: nodes[1].id, style: "straight", routeMode: "auto", anchor: null },
      { id: id("e2"), from: nodes[1].id, to: nodes[2].id, style: "straight", routeMode: "auto", anchor: null },
      { id: id("e3"), from: nodes[2].id, to: nodes[3].id, style: "straight", routeMode: "auto", anchor: null },
      { id: id("e4"), from: nodes[3].id, to: nodes[4].id, style: "straight", routeMode: "auto", anchor: null, fromPort: "bottom", label: "是" },
      { id: id("e5"), from: nodes[4].id, to: nodes[5].id, style: "straight", routeMode: "auto", anchor: null },
      { id: id("e6"), from: nodes[5].id, to: nodes[3].id, style: "straight", routeMode: "auto", anchor: null, fromPort: "left", toPort: "left" },
      { id: id("e7"), from: nodes[3].id, to: nodes[6].id, style: "straight", routeMode: "auto", anchor: null, fromPort: "right", label: "否" },
      { id: id("e8"), from: nodes[6].id, to: nodes[7].id, style: "straight", routeMode: "auto", anchor: null },
    ];
    return { nodes, edges };
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

  const variableColumns = useMemo(
    () => [
      { title: "变量", dataIndex: "name", key: "name", width: 120 },
      { title: "值", dataIndex: "value", key: "value" },
      { title: "类型", dataIndex: "type", key: "type", width: 120 },
    ],
    []
  );

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
    variableColumns,
  };
}
