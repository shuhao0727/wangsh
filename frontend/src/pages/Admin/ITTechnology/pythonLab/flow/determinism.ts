import type { FlowEdge, FlowNode } from "./model";

function stableSortBy<T>(arr: readonly T[], cmp: (a: T, b: T) => number): T[] {
  return arr
    .map((v, i) => ({ v, i }))
    .sort((a, b) => cmp(a.v, b.v) || a.i - b.i)
    .map((x) => x.v);
}

function cmpStr(a: string, b: string) {
  return a.localeCompare(b);
}

export function sortFlowNodesStable(nodes: readonly FlowNode[]): FlowNode[] {
  return stableSortBy(nodes, (a, b) => cmpStr(a.id, b.id));
}

export function sortFlowEdgesStable(edges: readonly FlowEdge[]): FlowEdge[] {
  return stableSortBy(
    edges,
    (a, b) =>
      cmpStr(a.id, b.id) ||
      cmpStr(a.from, b.from) ||
      cmpStr(a.to, b.to) ||
      cmpStr(a.label ?? "", b.label ?? "")
  );
}

export function sortFlowGraphStable(input: { nodes: readonly FlowNode[]; edges: readonly FlowEdge[] }): { nodes: FlowNode[]; edges: FlowEdge[] } {
  return { nodes: sortFlowNodesStable(input.nodes), edges: sortFlowEdgesStable(input.edges) };
}
