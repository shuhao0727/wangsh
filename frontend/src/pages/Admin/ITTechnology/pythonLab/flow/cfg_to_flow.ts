import type { FlowEdge, FlowNode } from "./model";
import type { PythonLabCfgResponse, PythonLabFlowResponse } from "../services/pythonlabCodeApi";
import type { FlowNodeShape } from "../types";
import { isTruncatedFlowTitle, normalizeTitleForMapping } from "./titleSemantics";

type SourceRange = {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
};

export function cfgToFlow(cfg: PythonLabCfgResponse | PythonLabFlowResponse): { nodes: (FlowNode & { sourceRange?: SourceRange })[]; edges: FlowEdge[] } {
  const inferCollectionShape = (title: string): FlowNodeShape | null => {
    const t = normalizeTitleForMapping(title);
    if (!t) return null;
    const low = t.toLowerCase();
    if (/=\s*\{[^}]*\}\s*$/.test(t)) return "dict_op";
    if (/=\s*\[[^\]]*\]\s*$/.test(t)) return "list_op";
    if (/=\s*dict\s*\(/.test(low)) return "dict_op";
    if (/=\s*list\s*\(/.test(low)) return "list_op";
    if (/\.\s*(append|extend|insert|remove|clear|sort|reverse|pop)\s*\(/.test(low)) return "list_op";
    if (/\.\s*(get|setdefault|update|keys|values|items|popitem)\s*\(/.test(low)) return "dict_op";
    if (/^[a-z_][a-z0-9_]*\s*\[\s*(['"]).*?\1\s*\]\s*=/.test(low)) return "dict_op";
    if (/^[a-z_][a-z0-9_]*\s*\[[^\]]+\]\s*=/.test(low)) return "list_op";
    if (/^[a-z_][a-z0-9_]*\s*\[\s*(['"]).*?\1\s*\]\s*$/.test(low)) return "dict_op";
    if (/\.\s*(split|strip|lstrip|rstrip|upper|lower|replace|join|find|rfind|startswith|endswith|format|count|index|title|capitalize|swapcase|center|ljust|rjust|zfill|encode|decode)\s*\(/.test(low)) return "str_op";
    return null;
  };
  const inferShapeByTitle = (title: string): FlowNodeShape | null => {
    const t = normalizeTitleForMapping(title);
    const low = t.toLowerCase();
    if (low.startsWith("print(") || low.includes("input(") || low.startsWith("read(") || low.startsWith("write(")) return "io";
    if (/^[A-Za-z_][A-Za-z0-9_]*\s*=\s*input\s*\(/.test(t)) return "io";
    const collectionShape = inferCollectionShape(t);
    if (collectionShape) return collectionShape;
    const rhs = low.replace(/^[a-z_][a-z0-9_]*\s*=\s*/i, "");
    if (/^[a-z_][a-z0-9_]*\s*\(.*\)$/.test(rhs) && !rhs.startsWith("print(") && !rhs.startsWith("input(")) return "subroutine";
    if (/^[a-z_][a-z0-9_]*\s*\(.*\)$/.test(low) && !low.startsWith("print(") && !low.startsWith("input(")) return "subroutine";
    return null;
  };
  const kindToShape = (kind: string, title: string): FlowNodeShape => {
    const k = (kind || "").toLowerCase();
    if (k === "module") return "start_end";
    if (k === "if" || k === "elif" || k === "while" || k === "for" || k === "foreach") return "decision";
    if (k === "function") return "start_end";
    if (k === "functionend") return "start_end";
    if (k === "moduleend") return "start_end";
    if (k === "break" || k === "continue" || k === "return") return "jump";
    if (k === "list_op") return "list_op";
    if (k === "dict_op") return "dict_op";
    if (k === "str_op") return "str_op";
    if (k === "output" || k === "input") return "io";
    const fromTitle = inferShapeByTitle(title);
    if (fromTitle) return fromTitle;
    return "process";
  };
  const kindToSourceRole = (kind: string, title: string): string | undefined => {
    const k = (kind || "").toLowerCase();
    if (k === "forinit") return "for_init";
    if (k === "for") return "for_check";
    if (k === "forstep") return "for_inc";
    if (k === "while") return "while_check";
    if (k === "foreach") return "for_in_next";
    if (k === "foreachnext") return "for_in_bind";
    if (k === "augassign") return "aug_assign";
    if (k === "return") return "return_stmt";
    const normalizedTitle = normalizeTitleForMapping(title);
    if (inferCollectionShape(normalizedTitle)) return undefined;
    const low = normalizedTitle.toLowerCase();
    if (/^[a-z_][a-z0-9_]*\s*\(.*\)$/.test(low) && !low.startsWith("print(") && !low.startsWith("input(")) return "call_site";
    return undefined;
  };

  // The code generator reads title, while fullTitle is only a tooltip and has its own limit.
  const writebackBlocked = (
    cfg.diagnostics?.some((d) => d.level === "error") ||
    ("stats" in cfg && cfg.stats?.truncated) ||
    cfg.nodes.some((n) => n.kind === "Fallback" || isTruncatedFlowTitle(n.title))
  ) || undefined;

  const moduleIds = new Set(cfg.nodes.filter((n) => n.kind === "Module").map((n) => n.id));
  const startId = "__cfg_start__";
  const endId = "__cfg_end__";
  const entryTarget = cfg.entryNodeId ?? (cfg.edges.find((e) => e.kind === "Entry")?.to ?? null);

  const nodes: (FlowNode & { sourceRange?: SourceRange })[] = cfg.nodes
    .filter((n) => !moduleIds.has(n.id))
    .map((n) => {
      const title = (n.title || "").trim() || n.kind;
      const shape = kindToShape(n.kind, title);
      const tooltip = (n.fullTitle || n.title || "").trim() || undefined;
      const sourceLine = Number.isFinite(n.range?.startLine) ? n.range.startLine : undefined;
      const sourceRole = kindToSourceRole(n.kind, title);
      return {
        id: n.id,
        type: "flow_element",
        shape,
        title,
        tooltip,
        writebackBlocked,
        x: 0,
        y: 0,
        sourceLine,
        sourceRole,
        sourceRange: n.range,
      };
    });

  const edges: FlowEdge[] = [];
  for (const e of cfg.edges) {
    if (e.kind === "Entry" && moduleIds.has(e.from)) continue;
    if (moduleIds.has(e.from) || moduleIds.has(e.to)) continue;
    const label = e.kind === "True" ? "是" : e.kind === "False" ? "否" : e.label;
    const isBack = e.kind === "Back";
    edges.push({ id: e.id, from: e.from, to: e.to, style: "straight", label, fromPort: isBack ? "left" : undefined, toPort: isBack ? "left" : undefined });
  }

  // Keep the restriction if a truncated or fallback node is renamed or deleted.
  nodes.unshift({ type: "flow_element", id: startId, shape: "start_end", title: "开始", x: 0, y: 0, writebackBlocked, sourceLine: undefined, sourceRole: undefined });
  nodes.push({ type: "flow_element", id: endId, shape: "start_end", title: "结束", x: 0, y: 0, writebackBlocked, sourceLine: undefined, sourceRole: undefined });

  if (entryTarget && !moduleIds.has(entryTarget)) {
    edges.unshift({ id: `${startId}__entry`, from: startId, to: entryTarget, style: "straight" });
  }

  const exitEdges = (cfg.exitEdges ?? []).filter((e) => nodes.some((n) => n.id === e.from));
  if (exitEdges.length) {
    exitEdges.forEach((e, idx) =>
      edges.push({ id: `${e.from}__to_end__${e.kind}_${idx}`, from: e.from, to: endId, style: "straight", label: e.kind === "False" ? "否" : e.label })
    );
  } else {
    const exits = (cfg.exitNodeIds ?? []).filter((id) => nodes.some((n) => n.id === id));
    if (exits.length) {
      exits.forEach((id) => edges.push({ id: `${id}__to_end`, from: id, to: endId, style: "straight" }));
      return { nodes, edges };
    }
    const reachable = (() => {
      if (!entryTarget) return new Set<string>();
      const set = new Set<string>();
      const adj = new Map<string, string[]>();
      for (const n of nodes) adj.set(n.id, []);
      for (const e of edges) {
        if (!adj.has(e.from)) continue;
        adj.get(e.from)!.push(e.to);
      }
      const q: string[] = [entryTarget];
      set.add(entryTarget);
      while (q.length) {
        const u = q.shift()!;
        const outs = adj.get(u) || [];
        for (const v of outs) {
          if (!set.has(v)) {
            set.add(v);
            q.push(v);
          }
        }
      }
      return set;
    })();

    const outDeg = new Map<string, number>();
    for (const n of nodes) outDeg.set(n.id, 0);
    for (const e of edges) {
      if (!reachable.size || (reachable.has(e.from) && reachable.has(e.to))) {
        outDeg.set(e.from, (outDeg.get(e.from) || 0) + 1);
      }
    }
    const tailNodes = nodes.filter(
      (n) => n.id !== endId && n.id !== startId && (!reachable.size || reachable.has(n.id)) && (outDeg.get(n.id) || 0) === 0
    );
    if (tailNodes.length) {
      for (const n of tailNodes) {
        edges.push({ id: `${n.id}__to_end`, from: n.id, to: endId, style: "straight" });
      }
    } else {
      edges.push({ id: `${startId}__to_end_fallback`, from: startId, to: endId, style: "straight" });
    }
  }

  return { nodes, edges };
}
