import { describe, expect, it } from "vitest";

import type { DrugRepurposingGraph } from "../src/api/types";
import { applyDrugGraphVisibility } from "../src/components/charts/drugGraphVisibility";

const graph: DrugRepurposingGraph = {
  title: "Graph",
  nodes: [
    {
      id: "target:A",
      label: "A",
      kind: "target",
      color: "red",
      x: 0,
      y: 0,
      z: 0
    },
    {
      id: "target:B",
      label: "B",
      kind: "target",
      color: "red",
      x: 1,
      y: 0,
      z: 0
    },
    {
      id: "target:C",
      label: "C",
      kind: "target",
      color: "red",
      x: 2,
      y: 0,
      z: 0
    },
    {
      id: "compound:X",
      label: "X",
      kind: "compound",
      color: "blue",
      phase: "2",
      compoundCid: "1",
      x: 0,
      y: 1,
      z: 0
    },
    {
      id: "compound:Y",
      label: "Y",
      kind: "compound",
      color: "blue",
      phase: "3",
      compoundCid: "2",
      x: 1,
      y: 1,
      z: 0
    },
    {
      id: "compound:Z",
      label: "Z",
      kind: "compound",
      color: "blue",
      phase: "4",
      compoundCid: "3",
      x: 2,
      y: 1,
      z: 0
    }
  ],
  edges: [
    {
      id: "ct-a",
      source: "compound:X",
      target: "target:A",
      kind: "compound-target",
      legendKey: "compound-target-default",
      color: "rgba(0,0,0,0.5)",
      fadedColor: "rgba(0,0,0,0.1)",
      dashRatio: 0.5,
      hoverText: "X-A",
      weight: 1
    },
    {
      id: "ct-b",
      source: "compound:Y",
      target: "target:B",
      kind: "compound-target",
      legendKey: "compound-target-default",
      color: "rgba(0,0,0,0.5)",
      fadedColor: "rgba(0,0,0,0.1)",
      dashRatio: 0.5,
      hoverText: "Y-B",
      weight: 1
    },
    {
      id: "ct-xb",
      source: "compound:X",
      target: "target:B",
      kind: "compound-target",
      legendKey: "compound-target-default",
      color: "rgba(0,0,0,0.5)",
      fadedColor: "rgba(0,0,0,0.1)",
      dashRatio: 0.5,
      hoverText: "X-B",
      weight: 1
    },
    {
      id: "ct-c",
      source: "compound:Z",
      target: "target:C",
      kind: "compound-target",
      legendKey: "compound-target-default",
      color: "rgba(0,0,0,0.5)",
      fadedColor: "rgba(0,0,0,0.1)",
      dashRatio: 0.5,
      hoverText: "Z-C",
      weight: 1
    },
    {
      id: "tt-ab",
      source: "target:A",
      target: "target:B",
      kind: "target-target",
      legendKey: "target-target-string",
      color: "rgba(0,0,0,0.5)",
      fadedColor: "rgba(0,0,0,0.1)",
      dashRatio: 0.5,
      hoverText: "A-B",
      weight: 1
    },
    {
      id: "tt-bc",
      source: "target:B",
      target: "target:C",
      kind: "target-target",
      legendKey: "target-target-string",
      color: "rgba(0,0,0,0.5)",
      fadedColor: "rgba(0,0,0,0.1)",
      dashRatio: 0.5,
      hoverText: "B-C",
      weight: 1
    }
  ],
  legend: []
};

describe("applyDrugGraphVisibility", () => {
  it("keeps only the direct gene neighborhood and dims the one-step PPI branch", () => {
    const result = applyDrugGraphVisibility(graph, {
      highlightedNodeIds: new Set(["target:A"]),
      hiddenNodeIds: new Set(),
      ppiDepth: 1
    });

    expect(result?.nodes.map((node) => node.id).sort()).toEqual([
      "compound:X",
      "compound:Y",
      "target:A",
      "target:B"
    ]);
    expect(result?.nodeOpacityById.get("target:A")).toBe(1);
    expect(result?.nodeOpacityById.get("compound:X")).toBe(1);
    expect(result?.nodeOpacityById.get("target:B")).toBe(0.5);
    expect(result?.nodeOpacityById.get("compound:Y")).toBe(0.5);
    expect(result?.nodeOpacityById.has("target:C")).toBe(false);
    expect(result?.nodeOpacityById.has("compound:Z")).toBe(false);
    expect(result?.edgeOpacityById.get("ct-a")).toBe(1);
    expect(result?.edgeOpacityById.get("ct-xb")).toBe(0.5);
    expect(result?.edgeOpacityById.get("ct-b")).toBe(0.5);
    expect(result?.edgeOpacityById.get("tt-ab")).toBe(1);
    expect(result?.edgeOpacityById.has("tt-bc")).toBe(false);
  });

  it("keeps only the direct compound neighborhood and dims the one-step PPI branch", () => {
    const result = applyDrugGraphVisibility(graph, {
      highlightedNodeIds: new Set(["compound:X"]),
      hiddenNodeIds: new Set(),
      ppiDepth: 1
    });

    expect(result?.nodes.map((node) => node.id).sort()).toEqual([
      "compound:X",
      "compound:Z",
      "target:A",
      "target:B",
      "target:C"
    ]);
    expect(result?.nodeOpacityById.get("compound:X")).toBe(1);
    expect(result?.nodeOpacityById.get("target:A")).toBe(1);
    expect(result?.nodeOpacityById.get("target:B")).toBe(1);
    expect(result?.nodeOpacityById.get("target:C")).toBe(0.5);
    expect(result?.nodeOpacityById.get("compound:Z")).toBe(0.5);
    expect(result?.nodeOpacityById.has("compound:Y")).toBe(false);
    expect(result?.edgeOpacityById.get("ct-a")).toBe(1);
    expect(result?.edgeOpacityById.get("ct-xb")).toBe(1);
    expect(result?.edgeOpacityById.get("tt-ab")).toBe(1);
    expect(result?.edgeOpacityById.get("tt-bc")).toBe(1);
    expect(result?.edgeOpacityById.get("ct-c")).toBe(0.5);
    expect(result?.edgeOpacityById.has("ct-b")).toBe(false);
  });

  it("spreads opacity evenly across the selected PPI depth", () => {
    const result = applyDrugGraphVisibility(graph, {
      highlightedNodeIds: new Set(["target:A"]),
      hiddenNodeIds: new Set(),
      ppiDepth: 2
    });

    expect(result?.nodeOpacityById.get("target:B")).toBeCloseTo(0.75, 5);
    expect(result?.nodeOpacityById.get("compound:Y")).toBeCloseTo(0.75, 5);
    expect(result?.nodeOpacityById.get("target:C")).toBeCloseTo(0.5, 5);
    expect(result?.nodeOpacityById.get("compound:Z")).toBeCloseTo(0.5, 5);
    expect(result?.edgeOpacityById.get("tt-ab")).toBe(1);
    expect(result?.edgeOpacityById.get("tt-bc")).toBeCloseTo(0.75, 5);
    expect(result?.edgeOpacityById.get("ct-b")).toBeCloseTo(0.75, 5);
    expect(result?.edgeOpacityById.get("ct-c")).toBeCloseTo(0.5, 5);
  });

  it("removes hidden nodes and prunes isolated leftovers", () => {
    const result = applyDrugGraphVisibility(graph, {
      highlightedNodeIds: new Set(),
      hiddenNodeIds: new Set(["target:A", "target:B", "compound:Y", "target:C"]),
      ppiDepth: 0
    });

    expect(result?.nodes.map((node) => node.id)).toEqual([]);
    expect(result?.edges).toEqual([]);
  });
});
