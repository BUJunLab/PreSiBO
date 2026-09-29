import { databaseName, queryRows } from "../lib/db.js";
import type {
  DrugRepurposingGraphActivity,
  DrugRepurposingGraph,
  DrugRepurposingGraphEdge,
  DrugRepurposingGraphNode,
  DrugRepurposingLegendSection
} from "../types.js";
import {
  loadDrugRepurposingRows,
  type DrugRepurposingRawRow
} from "./drugRepurposingService.js";
import { parseActivityText, splitPipeDelimitedText } from "../utils/drugRepurposingActivity.js";

const schema = `\`${databaseName}\``;

const compoundColor = "#2b6de0";
const targetColor = "#cf2f2f";
const defaultEdgeColor = "#b5bcc7";
const targetEdgeColor = "#151515";
const outerRadius = 2.7;
const innerRadius = 1.6;
const targetLinkCacheTtlMs = 60_000;

const targetLinkCache = new Map<
  string,
  { expiresAt: number; promise: Promise<TargetLinkRow[]> }
>();

interface PairActivityAggregate {
  values: number[];
}

interface TargetLinkRow {
  target1: string;
  target2: string;
  mean_score: number;
}

interface WeightedEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
}

interface PairActivitySummary {
  type: string;
  meanValue: number;
  dashRatio: number;
  color: string;
}

export async function searchDrugRepurposingGraph(query: string): Promise<DrugRepurposingGraph> {
  const rows = await loadDrugRepurposingRows(query);
  const targetNames = [...collectTargetNames(rows)];
  const targetLinks = await loadTargetLinks(targetNames);
  return buildDrugRepurposingGraph(rows, targetLinks, query.trim());
}

function buildDrugRepurposingGraph(
  rows: readonly DrugRepurposingRawRow[],
  targetLinks: readonly TargetLinkRow[],
  query: string
): DrugRepurposingGraph {
  const compounds = new Map<
    string,
    {
      label: string;
      color: string;
      phase: "2" | "3" | "4" | null;
      compoundCid: string;
    }
  >();
  const targets = new Set<string>();
  const pairTargets = new Map<string, { compoundId: string; compoundLabel: string; target: string }>();
  const activityByPair = new Map<string, Map<string, PairActivityAggregate>>();
  const activityTypeValues = new Map<string, number[]>();

  for (const row of rows) {
    const compoundCid = normalizeText(row.compound_cid);
    const compoundName = normalizeText(row.compound_name);
    if (!compoundCid || !compoundName) {
      continue;
    }

    const compoundId = `compound:${compoundCid}`;
    const phase = normalizePhaseValue(row.latest_clinical_trial_phase);
    compounds.set(compoundId, {
      label: compoundName,
      color: compoundColor,
      phase,
      compoundCid
    });

    const rowTargets = new Set(splitPipeDelimitedText(row.prioritized_targets_text));
    for (const target of rowTargets) {
      targets.add(target);
      pairTargets.set(buildPairKey(compoundId, target), {
        compoundId,
        compoundLabel: compoundName,
        target
      });
    }

    for (const activity of parseActivityText(row.activity_text)) {
      if (
        !activity.target ||
        !activity.type ||
        activity.numericValue === null ||
        !rowTargets.has(activity.target)
      ) {
        continue;
      }

      targets.add(activity.target);
      const pairKey = buildPairKey(compoundId, activity.target);
      if (!pairTargets.has(pairKey)) {
        pairTargets.set(pairKey, {
          compoundId,
          compoundLabel: compoundName,
          target: activity.target
        });
      }

      const pairTypes = activityByPair.get(pairKey) ?? new Map<string, PairActivityAggregate>();
      const aggregate = pairTypes.get(activity.type) ?? { values: [] };
      aggregate.values.push(activity.numericValue);
      pairTypes.set(activity.type, aggregate);
      activityByPair.set(pairKey, pairTypes);

      const typeValues = activityTypeValues.get(activity.type) ?? [];
      typeValues.push(activity.numericValue);
      activityTypeValues.set(activity.type, typeValues);
    }
  }

  const sortedActivityTypes = [...activityTypeValues.keys()].sort((left, right) => {
    return left.localeCompare(right, undefined, { sensitivity: "base" });
  });
  const activityTypeMeans = new Map(
    sortedActivityTypes.map((type) => [type, average(activityTypeValues.get(type) ?? [])])
  );
  const activityTypeColors = new Map(
    sortedActivityTypes.map((type, index) => [type, hsvColor(index, sortedActivityTypes.length)])
  );

  const edges: DrugRepurposingGraphEdge[] = [];

  for (const [pairKey, pair] of pairTargets) {
    const activities = activityByPair.get(pairKey);
    if (!activities || activities.size === 0) {
      edges.push(
        createEdge({
          id: `${pair.compoundId}->target:${pair.target}:default`,
          source: pair.compoundId,
          target: `target:${pair.target}`,
          kind: "compound-target",
          legendKey: "compound-target-default",
          color: defaultEdgeColor,
          dashRatio: 0.5,
          activeAlpha: 0.5,
          inactiveAlpha: 0.1,
          hoverText: `${pair.compoundLabel} ↔ ${pair.target}<br>No normalized activity value available`
        })
      );
      continue;
    }

    const summaries = [...activities.entries()].map(([type, aggregate]) => {
      const pairMean = average(aggregate.values);
      const typeMean = activityTypeMeans.get(type) ?? pairMean;
      return {
        type,
        meanValue: pairMean,
        dashRatio: computeDashRatio(pairMean, typeMean, isLowerBetter(type)),
        color: activityTypeColors.get(type) ?? defaultEdgeColor
      } satisfies PairActivitySummary;
    });

    edges.push(
      createEdge({
        id: `${pair.compoundId}->target:${pair.target}:activity`,
        source: pair.compoundId,
        target: `target:${pair.target}`,
        kind: "compound-target",
        legendKey: summaries.length === 1 ? `activity:${summaries[0].type}` : "activity:mixed",
        color: averageColor(summaries.map((summary) => summary.color)),
        dashRatio: average(summaries.map((summary) => summary.dashRatio)),
        activeAlpha: 0.5,
        inactiveAlpha: 0.1,
        hoverText: [
          `${pair.compoundLabel} ↔ ${pair.target}`,
          ...summaries.map((summary) => `${summary.type} = ${formatNumber(summary.meanValue)}`)
        ].join("<br>"),
        activities: summaries.map((summary) => ({
          type: summary.type,
          value: summary.meanValue,
          dashRatio: summary.dashRatio
        }))
      })
    );
  }

  const linkMean = average(targetLinks.map((row) => row.mean_score));
  for (const link of targetLinks) {
    if (!targets.has(link.target1) || !targets.has(link.target2)) {
      continue;
    }

    edges.push(
      createEdge({
        id: `target:${link.target1}->target:${link.target2}:string`,
        source: `target:${link.target1}`,
        target: `target:${link.target2}`,
        kind: "target-target",
        legendKey: "target-target-string",
        color: targetEdgeColor,
        dashRatio: computeDashRatio(link.mean_score, linkMean, false),
        activeAlpha: 0.5,
        inactiveAlpha: 0.1,
        hoverText: `${link.target1} ↔ ${link.target2}<br>combined_score = ${formatNumber(
          link.mean_score
        )}`
      })
    );
  }

  const nodes = buildGraphNodes(compounds, targets, edges);

  return {
    title: query ? `Drug Repurposing Interaction Graph: ${query}` : "Drug Repurposing Interaction Graph",
    nodes,
    edges,
    legend: buildLegend(sortedActivityTypes, activityTypeColors)
  };
}

async function loadTargetLinks(targetNames: readonly string[]): Promise<TargetLinkRow[]> {
  if (targetNames.length < 2) {
    return [];
  }

  const cacheKey = [...targetNames].sort().join("|");
  const cachedEntry = targetLinkCache.get(cacheKey);
  if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
    return cachedEntry.promise;
  }

  const promise = loadTargetLinksUncached(targetNames);
  targetLinkCache.set(cacheKey, {
    expiresAt: Date.now() + targetLinkCacheTtlMs,
    promise
  });

  try {
    return await promise;
  } catch (error) {
    targetLinkCache.delete(cacheKey);
    throw error;
  }
}

async function loadTargetLinksUncached(
  targetNames: readonly string[]
): Promise<TargetLinkRow[]> {
  const placeholders = targetNames.map(() => "?").join(", ");
  const rows = await queryRows(
    `
      SELECT
        LEAST(info1.preferred_name, info2.preferred_name) AS target1,
        GREATEST(info1.preferred_name, info2.preferred_name) AS target2,
        AVG(links.combined_score) AS mean_score
      FROM ${schema}.\`human_protein_links\` AS links
      JOIN ${schema}.\`human_protein_info\` AS info1
        ON info1.string_protein_id = links.protein1
      JOIN ${schema}.\`human_protein_info\` AS info2
        ON info2.string_protein_id = links.protein2
      WHERE info1.preferred_name IN (${placeholders})
        AND info2.preferred_name IN (${placeholders})
        AND info1.preferred_name <> info2.preferred_name
      GROUP BY
        LEAST(info1.preferred_name, info2.preferred_name),
        GREATEST(info1.preferred_name, info2.preferred_name)
    `,
    [...targetNames, ...targetNames]
  );

  return rows as unknown as TargetLinkRow[];
}

function buildGraphNodes(
  compounds: ReadonlyMap<
    string,
    { label: string; color: string; phase: "2" | "3" | "4" | null; compoundCid: string }
  >,
  targets: ReadonlySet<string>,
  edges: readonly DrugRepurposingGraphEdge[]
): DrugRepurposingGraphNode[] {
  const compoundIds = [...compounds.keys()].sort(sortByWeightedDegree(edges));
  const targetIds = [...targets]
    .map((target) => `target:${target}`)
    .sort(sortByWeightedDegree(edges));

  const positions = new Map<string, Point3D>();
  assignInitialPositions(compoundIds, buildSpherePoints(compoundIds.length, outerRadius), positions);
  assignInitialPositions(targetIds, buildSpherePoints(targetIds.length, innerRadius), positions);

  const adjacency = buildAdjacency(edges);
  optimizeGroup(compoundIds, positions, adjacency, edges);
  optimizeGroup(targetIds, positions, adjacency, edges);

  const nodes: DrugRepurposingGraphNode[] = [];

  for (const [id, compound] of compounds) {
    const point = positions.get(id) ?? { x: 0, y: 0, z: 0 };
    nodes.push({
      id,
      label: compound.label,
      kind: "compound",
      color: compound.color,
      phase: compound.phase,
      compoundCid: compound.compoundCid,
      x: point.x,
      y: point.y,
      z: point.z
    });
  }

  for (const target of targets) {
    const id = `target:${target}`;
    const point = positions.get(id) ?? { x: 0, y: 0, z: 0 };
    nodes.push({
      id,
      label: target,
      kind: "target",
      color: targetColor,
      phase: null,
      compoundCid: null,
      x: point.x,
      y: point.y,
      z: point.z
    });
  }

  return nodes;
}

function buildLegend(
  activityTypes: readonly string[],
  activityTypeColors: ReadonlyMap<string, string>
): DrugRepurposingLegendSection[] {
  return [
    {
      title: "Points",
      items: [
        {
          key: "phase-2",
          label: "Compound: Phase 2",
          color: compoundColor,
          shape: "circle"
        },
        {
          key: "phase-3",
          label: "Compound: Phase 3",
          color: compoundColor,
          shape: "triangle"
        },
        {
          key: "phase-4",
          label: "Compound: Phase 4",
          color: compoundColor,
          shape: "square"
        },
        { key: "target", label: "Prioritized Target", color: targetColor }
      ]
    },
    {
      title: "Compound-target lines",
      items: [
        {
          key: "compound-target-default",
          label: "Known interaction without typed activity",
          color: rgba(defaultEdgeColor, 0.5),
          fadedColor: rgba(defaultEdgeColor, 0.1),
          dashRatio: 0.5
        },
        ...activityTypes.map((type) => ({
          key: `activity:${type}`,
          label: type,
          color: rgba(activityTypeColors.get(type) ?? defaultEdgeColor, 0.5),
          fadedColor: rgba(activityTypeColors.get(type) ?? defaultEdgeColor, 0.1),
          dashRatio: 0.5
        }))
      ]
    },
    {
      title: "Target-target lines",
      items: [
        {
          key: "target-target-string",
          label: "STRING combined score",
          color: rgba(targetEdgeColor, 0.5),
          fadedColor: rgba(targetEdgeColor, 0.1),
          dashRatio: 0.5
        }
      ]
    }
  ];
}

function buildAdjacency(
  edges: readonly WeightedEdge[]
): Map<string, WeightedEdge[]> {
  const adjacency = new Map<string, WeightedEdge[]>();
  for (const edge of edges) {
    const sourceEdges = adjacency.get(edge.source) ?? [];
    sourceEdges.push(edge);
    adjacency.set(edge.source, sourceEdges);

    const targetEdges = adjacency.get(edge.target) ?? [];
    targetEdges.push(edge);
    adjacency.set(edge.target, targetEdges);
  }

  return adjacency;
}

function optimizeGroup(
  nodeIds: readonly string[],
  positions: Map<string, Point3D>,
  adjacency: ReadonlyMap<string, WeightedEdge[]>,
  edges: readonly WeightedEdge[]
): void {
  if (nodeIds.length < 2) {
    return;
  }

  const edgeLookup = new Map(edges.map((edge) => [edge.id, edge]));
  const order = [...nodeIds];

  for (let pass = 0; pass < 2; pass += 1) {
    let changed = false;

    for (let index = 0; index < order.length - 1; index += 1) {
      for (let nextIndex = index + 1; nextIndex < order.length; nextIndex += 1) {
        const leftId = order[index];
        const rightId = order[nextIndex];
        const leftPoint = positions.get(leftId);
        const rightPoint = positions.get(rightId);
        if (!leftPoint || !rightPoint) {
          continue;
        }

        const affectedEdges = new Set<string>([
          ...(adjacency.get(leftId) ?? []).map((edge) => edge.id),
          ...(adjacency.get(rightId) ?? []).map((edge) => edge.id)
        ]);

        let delta = 0;
        for (const edgeId of affectedEdges) {
          const edge = edgeLookup.get(edgeId);
          if (!edge) {
            continue;
          }

          delta +=
            edge.weight *
            (edgeDistance(edge, positions, leftId, rightPoint, rightId, leftPoint) -
              edgeDistance(edge, positions));
        }

        if (delta < -1e-6) {
          positions.set(leftId, rightPoint);
          positions.set(rightId, leftPoint);
          [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
          changed = true;
        }
      }
    }

    if (!changed) {
      break;
    }
  }
}

function assignInitialPositions(
  nodeIds: readonly string[],
  points: readonly Point3D[],
  positions: Map<string, Point3D>
): void {
  for (let index = 0; index < nodeIds.length; index += 1) {
    positions.set(nodeIds[index], points[index] ?? { x: 0, y: 0, z: 0 });
  }
}

function sortByWeightedDegree(edges: readonly DrugRepurposingGraphEdge[]) {
  const degree = new Map<string, number>();
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + edge.weight);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + edge.weight);
  }

  return (left: string, right: string) => {
    const difference = (degree.get(right) ?? 0) - (degree.get(left) ?? 0);
    return difference || left.localeCompare(right);
  };
}

function createEdge(input: {
  id: string;
  source: string;
  target: string;
  kind: "compound-target" | "target-target";
  legendKey: string;
  color: string;
  dashRatio: number;
  activeAlpha: number;
  inactiveAlpha: number;
  hoverText: string;
  activities?: DrugRepurposingGraphActivity[];
}): DrugRepurposingGraphEdge {
  return {
    id: input.id,
    source: input.source,
    target: input.target,
    kind: input.kind,
    legendKey: input.legendKey,
    color: rgba(input.color, input.activeAlpha),
    fadedColor: rgba(input.color, input.inactiveAlpha),
    dashRatio: input.dashRatio,
    hoverText: input.hoverText,
    weight: input.activeAlpha + input.inactiveAlpha,
    activities: input.activities
  };
}

function computeDashRatio(
  value: number,
  mean: number,
  lowerIsBetter: boolean
): number {
  if (!Number.isFinite(value) || !Number.isFinite(mean) || mean <= 0 || value <= 0) {
    return 0.5;
  }

  const effectiveness = lowerIsBetter ? mean / value : value / mean;
  const normalized = Math.tanh(Math.log(effectiveness));
  return clamp(0.5 + normalized * 0.3, 0.2, 0.8);
}

function buildSpherePoints(count: number, radius: number): Point3D[] {
  if (count === 0) {
    return [];
  }

  if (count === 1) {
    return [{ x: 0, y: radius, z: 0 }];
  }

  const points: Point3D[] = [];
  const offset = 2 / count;
  const increment = Math.PI * (3 - Math.sqrt(5));

  for (let index = 0; index < count; index += 1) {
    const y = index * offset - 1 + offset / 2;
    const radial = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = index * increment;

    points.push({
      x: Math.cos(angle) * radial * radius,
      y: y * radius,
      z: Math.sin(angle) * radial * radius
    });
  }

  return points;
}

function edgeDistance(
  edge: WeightedEdge,
  positions: ReadonlyMap<string, Point3D>,
  swapLeftId?: string,
  swapLeftPoint?: Point3D,
  swapRightId?: string,
  swapRightPoint?: Point3D
): number {
  const source =
    edge.source === swapLeftId
      ? swapLeftPoint
      : edge.source === swapRightId
        ? swapRightPoint
        : positions.get(edge.source);
  const target =
    edge.target === swapLeftId
      ? swapLeftPoint
      : edge.target === swapRightId
        ? swapRightPoint
        : positions.get(edge.target);

  if (!source || !target) {
    return 0;
  }

  return Math.sqrt(
    (source.x - target.x) ** 2 + (source.y - target.y) ** 2 + (source.z - target.z) ** 2
  );
}

function collectTargetNames(rows: readonly DrugRepurposingRawRow[]): Set<string> {
  const targets = new Set<string>();
  for (const row of rows) {
    for (const target of splitPipeDelimitedText(row.prioritized_targets_text)) {
      targets.add(target);
    }
  }

  return targets;
}

function buildPairKey(compoundId: string, target: string): string {
  return `${compoundId}::${target}`;
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function hsvColor(index: number, count: number): string {
  if (count <= 1) {
    return "#d96b28";
  }

  const hue = (index / count) * 360;
  const sector = hue / 60;
  const chroma = 0.82;
  const secondary = chroma * (1 - Math.abs((sector % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;

  if (sector >= 0 && sector < 1) {
    red = chroma;
    green = secondary;
  } else if (sector < 2) {
    red = secondary;
    green = chroma;
  } else if (sector < 3) {
    green = chroma;
    blue = secondary;
  } else if (sector < 4) {
    green = secondary;
    blue = chroma;
  } else if (sector < 5) {
    red = secondary;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondary;
  }

  const match = 0.18;
  return rgb(
    Math.round((red + match) * 255),
    Math.round((green + match) * 255),
    Math.round((blue + match) * 255)
  );
}

function isLowerBetter(type: string): boolean {
  return !["Activity", "INH", "Potency"].includes(type);
}

function rgb(red: number, green: number, blue: number): string {
  return `rgb(${red}, ${green}, ${blue})`;
}

function averageColor(colors: readonly string[]): string {
  const channels = colors
    .map(parseRgbChannels)
    .filter((value): value is [number, number, number] => value !== null);

  if (channels.length === 0) {
    return defaultEdgeColor;
  }

  return rgb(
    Math.round(average(channels.map((value) => value[0]))),
    Math.round(average(channels.map((value) => value[1]))),
    Math.round(average(channels.map((value) => value[2])))
  );
}

function parseRgbChannels(color: string): [number, number, number] | null {
  const hexMatch = color.match(/^#([0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    return [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16)
    ];
  }

  const match = color.match(/\d+/g);
  if (!match || match.length < 3) {
    return null;
  }

  return [
    Number.parseInt(match[0], 10),
    Number.parseInt(match[1], 10),
    Number.parseInt(match[2], 10)
  ];
}

function rgba(color: string, alpha: number): string {
  const hexMatch = color.match(/^#([0-9a-f]{6})$/i);
  if (hexMatch) {
    const channels = parseRgbChannels(color);
    if (channels) {
      return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
    }
  }

  const channels = parseRgbChannels(color);
  if (!channels) {
    return color;
  }

  return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }

  const normalized = Number(value.toPrecision(4));
  const text = normalized.toString();
  if (!/[eE]/.test(text)) {
    return text;
  }

  const scientific = normalized.toExponential(4);
  const [mantissaText, exponentText] = scientific.split("e");
  const mantissa = mantissaText.replace(/\.?0+$/, "");
  const exponent = Number(exponentText);
  return `${mantissa} x 10${toSuperscript(exponent)}`;
}

function toSuperscript(value: number) {
  return String(value)
    .replace(/-/g, "\u207b")
    .replace(/0/g, "\u2070")
    .replace(/1/g, "\u00b9")
    .replace(/2/g, "\u00b2")
    .replace(/3/g, "\u00b3")
    .replace(/4/g, "\u2074")
    .replace(/5/g, "\u2075")
    .replace(/6/g, "\u2076")
    .replace(/7/g, "\u2077")
    .replace(/8/g, "\u2078")
    .replace(/9/g, "\u2079");
}

function normalizePhaseValue(value: unknown): "2" | "3" | "4" | null {
  const text = normalizeText(value);
  if (text === "2" || text === "3" || text === "4") {
    return text;
  }

  return null;
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}
