import { useCallback, useMemo } from "react";
import type { FlowEdge, FlowNode, PortSide } from "../flow/model";
import type { FlowNodeTemplate } from "../types";
import { nodeSize } from "../flow/ports";

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

  const addNode = (tpl: FlowNodeTemplate) => {
    ensureAuto();
    const rect = canvasRef.current?.getBoundingClientRect();
    const size = nodeSize(tpl.key);
    const xBase = rect ? Math.max(16, (rect.width - size.w) / 2) : 120;
    const yBase = rect ? Math.max(16, (rect.height - size.h) / 2) : 120;
    const node: FlowNode = {
      id: nextId("node"),
      shape: tpl.key,
      title: tpl.title,
      x: xBase + Math.floor(Math.random() * 80) - 40,
      y: yBase + Math.floor(Math.random() * 80) - 40,
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
    ensureAuto();
    setNodes([]);
    setSelectedNodeId(null);
    setVariables([]);
    setEdges([]);
    setSelectedEdgeId(null);
    setConnectFromId(null);
    setConnectFromPort(null);
  };

  const demoOptions = useMemo(
    () => [
      { key: "seq_basic", label: "顺序结构", description: "按顺序执行多步计算与输出" },
      { key: "if_else_basic", label: "if / else", description: "分支判断与汇合" },
      { key: "while_sum_1_10", label: "while 求和", description: "1..10 累加并输出" },
      { key: "for_sum_1_10", label: "for 求和", description: "for 循环风格的流程图表达" },
      { key: "fib_iter", label: "斐波那契", description: "迭代计算前 N 项" },
      { key: "func_sum_1_100", label: "自定义函数", description: "定义函数并求 1..100" },
      { key: "code_fib_for", label: "斐波那契（代码）", description: "for + 多赋值：后端解析生成流程图" },
      { key: "code_binary_search", label: "二分查找（代码）", description: "while + if/elif + return：后端解析生成流程图" },
      { key: "code_break_continue", label: "break/continue（代码）", description: "循环控制语义：break 跳出、continue 回边" },
      { key: "code_nested_if", label: "嵌套分支（代码）", description: "if/else 组合：后端解析生成流程图" },
    ],
    []
  );

  const getDemo = (key: string): { nodes: FlowNode[]; edges: FlowEdge[]; code?: string; codeMode?: "auto" | "manual" } => {
    const k = key || "while_sum_1_10";
    const id = (name: string) => `demo_${k}_${name}`;

    if (k === "code_fib_for") {
      return {
        nodes: [],
        edges: [],
        code: "n = 10\na = 0\nb = 1\nfor i in range(n):\n    a, b = b, a + b\n    print(a)\n",
        codeMode: "manual",
      };
    }
    if (k === "code_binary_search") {
      return {
        nodes: [],
        edges: [],
        code:
          "def binary_search(arr, target):\n    left, right = 0, len(arr) - 1\n    while left <= right:\n        mid = (left + right) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1\n\nsorted_list = [1, 3, 5, 7, 9, 11, 13, 15]\ntarget_value = 7\nresult_index = binary_search(sorted_list, target_value)\nprint(f\"目标值 {target_value} 在列表中的索引: {result_index}\")\n",
        codeMode: "manual",
      };
    }
    if (k === "code_break_continue") {
      return {
        nodes: [],
        edges: [],
        code:
          "i = 0\ns = 0\nwhile i < 10:\n    i += 1\n    if i % 2 == 0:\n        continue\n    if i > 7:\n        break\n    s += i\nprint(s)\n",
        codeMode: "manual",
      };
    }
    if (k === "code_nested_if") {
      return {
        nodes: [],
        edges: [],
        code: "score = 83\nif score >= 90:\n    grade = \"A\"\nelse:\n    if score >= 60:\n        grade = \"B\"\n    else:\n        grade = \"C\"\nprint(grade)\n",
        codeMode: "manual",
      };
    }

    if (k === "seq_basic") {
      const nodes: FlowNode[] = [
        { id: id("start"), shape: "start_end", title: "开始", x: 320, y: 60 },
        { id: id("a"), shape: "process", title: "a = 3", x: 320, y: 160 },
        { id: id("b"), shape: "process", title: "b = 5", x: 320, y: 260 },
        { id: id("c"), shape: "process", title: "c = a + b", x: 320, y: 360 },
        { id: id("out"), shape: "io", title: "print(c)", x: 320, y: 460 },
        { id: id("end"), shape: "start_end", title: "结束", x: 320, y: 560 },
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

    if (k === "if_else_basic") {
      const nodes: FlowNode[] = [
        { id: id("start"), shape: "start_end", title: "开始", x: 320, y: 60 },
        { id: id("x"), shape: "process", title: "x = 7", x: 320, y: 160 },
        { id: id("cond"), shape: "decision", title: "x % 2 == 0 ?", x: 320, y: 260 },
        { id: id("even"), shape: "process", title: "msg = 'even'", x: 320, y: 380 },
        { id: id("odd"), shape: "process", title: "msg = 'odd'", x: 680, y: 260 },
        { id: id("out"), shape: "io", title: "print(msg)", x: 320, y: 500 },
        { id: id("end"), shape: "start_end", title: "结束", x: 320, y: 600 },
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

    if (k === "for_sum_1_10") {
      const nodes: FlowNode[] = [
        { id: id("start"), shape: "start_end", title: "开始", x: 320, y: 60 },
        { id: id("total0"), shape: "process", title: "total = 0", x: 320, y: 160 },
        { id: id("i1"), shape: "process", title: "i = 1", x: 320, y: 260 },
        { id: id("cond"), shape: "decision", title: "i <= 10 ?", x: 320, y: 360 },
        { id: id("add"), shape: "process", title: "total += i", x: 320, y: 480 },
        { id: id("inc"), shape: "process", title: "i += 1", x: 320, y: 580 },
        { id: id("out"), shape: "io", title: "print(total)", x: 680, y: 360 },
        { id: id("end"), shape: "start_end", title: "结束", x: 680, y: 460 },
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
      return { nodes, edges };
    }

    if (k === "fib_iter") {
      const nodes: FlowNode[] = [
        { id: id("start"), shape: "start_end", title: "开始", x: 320, y: 60 },
        { id: id("n"), shape: "process", title: "n = 10", x: 320, y: 160 },
        { id: id("a0"), shape: "process", title: "a = 0", x: 320, y: 260 },
        { id: id("b1"), shape: "process", title: "b = 1", x: 320, y: 360 },
        { id: id("i0"), shape: "process", title: "i = 0", x: 320, y: 460 },
        { id: id("cond"), shape: "decision", title: "i < n ?", x: 320, y: 560 },
        { id: id("out"), shape: "io", title: "print(a)", x: 320, y: 680 },
        { id: id("step1"), shape: "process", title: "a, b = b, a + b", x: 320, y: 780 },
        { id: id("step2"), shape: "process", title: "i += 1", x: 320, y: 880 },
        { id: id("end"), shape: "start_end", title: "结束", x: 680, y: 560 },
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
        { id: id("fn_start"), shape: "start_end", title: "sum_n(n)", x: 260, y: 60 },
        { id: id("fn_total0"), shape: "process", title: "total = 0", x: 260, y: 160 },
        { id: id("fn_i1"), shape: "process", title: "i = 1", x: 260, y: 260 },
        { id: id("fn_cond"), shape: "decision", title: "i <= n ?", x: 260, y: 360 },
        { id: id("fn_add"), shape: "process", title: "total += i", x: 260, y: 480 },
        { id: id("fn_inc"), shape: "process", title: "i += 1", x: 260, y: 580 },
        { id: id("fn_ret"), shape: "process", title: "return total", x: 600, y: 360 },
        { id: id("fn_end"), shape: "start_end", title: "返回", x: 600, y: 460 },
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
        { id: id("main_start"), shape: "start_end", title: "开始", x: 260, y: 760 },
        { id: id("main_call"), shape: "subroutine", title: "ans = sum_n(100)", x: 260, y: 860 },
        { id: id("main_out"), shape: "io", title: "print(ans)", x: 260, y: 980 },
        { id: id("main_end"), shape: "start_end", title: "结束", x: 260, y: 1080 },
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
      { id: id("start"), shape: "start_end", title: "开始", x: 320, y: 60 },
      { id: id("total0"), shape: "process", title: "total = 0", x: 320, y: 160 },
      { id: id("i10"), shape: "process", title: "i = 10", x: 320, y: 260 },
      { id: id("decision"), shape: "decision", title: "i >= 1 ?", x: 320, y: 360 },
      { id: id("add"), shape: "process", title: "total += i", x: 320, y: 480 },
      { id: id("dec"), shape: "process", title: "i -= 1", x: 320, y: 580 },
      { id: id("print"), shape: "io", title: "print(total)", x: 680, y: 360 },
      { id: id("end"), shape: "start_end", title: "结束", x: 680, y: 460 },
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

  const loadDemoFlow = (key?: string) => {
    const demo = getDemo(key ?? "while_sum_1_10");
    if (demo.codeMode !== "manual") ensureAuto();
    setNodes(demo.nodes);
    setEdges(demo.edges);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setConnectMode(false);
    setConnectFromId(null);
    setConnectFromPort(null);
    setVariables([]);
    return { code: demo.code, codeMode: demo.codeMode };
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

  return { addNode, removeSelected, clearAll, loadDemoFlow, demoOptions, mockStep, variableColumns };
}
