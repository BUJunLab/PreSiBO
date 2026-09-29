import { describe, expect, it } from "vitest";

import type { DrugRepurposingGraph } from "../src/api/types";
import {
  activityIsWithinRange,
  buildDrugGraphActivityDomains
} from "../src/components/charts/drugGraphActivityRanges";

const graph = {
  title: "Activity ranges",
  nodes: [],
  edges: [
    {
      id: "edge-1",
      source: "compound:1",
      target: "target:1",
      kind: "compound-target",
      legendKey: "compound-target-default",
      color: "black",
      fadedColor: "gray",
      dashRatio: 0.5,
      hoverText: "edge",
      weight: 1,
      activities: [
        { type: "Binding", value: 1, dashRatio: 0.25 },
        { type: "Inhibition", value: 10, dashRatio: 0.75 }
      ]
    },
    {
      id: "edge-2",
      source: "compound:2",
      target: "target:2",
      kind: "compound-target",
      legendKey: "compound-target-default",
      color: "black",
      fadedColor: "gray",
      dashRatio: 0.5,
      hoverText: "edge",
      weight: 1,
      activities: [{ type: "Binding", value: 5, dashRatio: 0.25 }]
    }
  ],
  legend: []
} satisfies DrugRepurposingGraph;

describe("drug graph activity ranges", () => {
  it("derives independent minimum and maximum values for each activity", () => {
    expect([...buildDrugGraphActivityDomains(graph)]).toEqual([
      ["Binding", { min: 1, max: 5 }],
      ["Inhibition", { min: 10, max: 10 }]
    ]);
  });

  it("uses inclusive activity ranges without affecting other activity types", () => {
    const ranges = new Map([
      ["Binding", { min: 2, max: 5 }],
      ["Inhibition", { min: 10, max: 20 }]
    ]);

    expect(
      activityIsWithinRange({ type: "Binding", value: 1, dashRatio: 0.25 }, ranges)
    ).toBe(false);
    expect(
      activityIsWithinRange({ type: "Inhibition", value: 10, dashRatio: 0.75 }, ranges)
    ).toBe(true);
  });
});
