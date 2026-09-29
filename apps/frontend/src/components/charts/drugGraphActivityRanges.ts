import type {
  DrugRepurposingGraph,
  DrugRepurposingGraphActivity
} from "../../api/types";

export interface DrugGraphActivityRange {
  min: number;
  max: number;
}

export type DrugGraphActivityRanges = ReadonlyMap<string, DrugGraphActivityRange>;

export function buildDrugGraphActivityDomains(
  graph: DrugRepurposingGraph | null
): Map<string, DrugGraphActivityRange> {
  const domains = new Map<string, DrugGraphActivityRange>();

  for (const edge of graph?.edges ?? []) {
    for (const activity of edge.activities ?? []) {
      if (!Number.isFinite(activity.value)) {
        continue;
      }

      const current = domains.get(activity.type);
      domains.set(activity.type, {
        min: current ? Math.min(current.min, activity.value) : activity.value,
        max: current ? Math.max(current.max, activity.value) : activity.value
      });
    }
  }

  return domains;
}

export function activityIsWithinRange(
  activity: DrugRepurposingGraphActivity,
  ranges: DrugGraphActivityRanges
) {
  const range = ranges.get(activity.type);
  return !range || (activity.value >= range.min && activity.value <= range.max);
}
