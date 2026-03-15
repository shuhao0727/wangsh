import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FlowNodesLayer } from "./FlowNodesLayer";
import type { FlowNode } from "../flow/model";
import { nodeSizeForTitle, wrapNodeTitle } from "../flow/ports";

test("FlowNodesLayer 长标题自动换行并随行数增高节点", () => {
  const title =
    "result_identifier_with_many_segments_equals_alpha_beta_gamma_delta_epsilon_zeta_eta_theta_iota_kappa_lambda";
  const nodes: FlowNode[] = [
    {
      id: "n1",
      type: "flow_element",
      shape: "process",
      title,
      x: 120,
      y: 80,
    },
  ];
  const lines = wrapNodeTitle(title, "process");
  const size = nodeSizeForTitle("process", title);
  const markup = renderToStaticMarkup(
    <FlowNodesLayer
      nodes={nodes}
      scale={1}
      offsetX={0}
      offsetY={0}
      selectedNodeId={null}
      selectedEdgeId={null}
      selectedEdge={null}
      connectMode={false}
      connectFromId={null}
      connectFromPort={null}
      onNodePointerDown={() => {}}
      onNodeClick={() => {}}
      onPortClick={() => {}}
    />
  );

  expect(lines.length).toBeGreaterThanOrEqual(3);
  expect(lines.some((line) => line.includes("…"))).toBe(false);
  for (const line of lines) {
    expect(markup).toContain(line);
  }
  expect(size.h).toBeGreaterThan(45);
  expect(markup).toContain(`height:${size.h}px`);
});
