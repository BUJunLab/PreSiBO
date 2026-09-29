import type { TableRow } from "../../api/types";
import { getSortableCellText, toDisplayRichCell } from "../../components/common/tableCellUtils";

export type ScopeMode = "disease-area" | "prioritized-target";
export type ActivityCountMode = "compound" | "interaction";

export interface DonutSliceDetail {
  label: string;
  value: number;
  color?: string;
  hoverDetail?: string;
}

export interface DonutFigureData {
  slices: DonutSliceDetail[];
  emptyMessage: string;
}

export interface SunburstNodeData {
  id: string;
  label: string;
  parent: string;
  value: number;
  color: string;
}

export interface SunburstFigureData {
  nodes: SunburstNodeData[];
  emptyMessage: string;
}

export interface ParsedRepurposingActivity {
  target: string | null;
  type: string | null;
  displayText: string;
}

export interface ParsedClinicalTrial {
  condition: string | null;
  phase: string | null;
  displayText: string;
}

export interface ParsedRepurposingRow {
  compoundCid: string | null;
  compoundName: string | null;
  latestPhase: string | null;
  bbbStatus: string | null;
  prioritizedTargets: string[];
  diseaseAreas: string[];
  diseaseIndications: string[];
  mechanisms: string[];
  activities: ParsedRepurposingActivity[];
  clinicalTrials: ParsedClinicalTrial[];
}

const phaseColors: Record<string, string> = {
  "Phase 2": "#5f6ad8",
  "Phase 3": "#2f8de4",
  "Phase 4": "#2e9f66",
  Unknown: "#b1b6bf"
};

const overviewPalette = [
  "#1f5f94",
  "#3a7fb1",
  "#5b9bc5",
  "#7cb6d1",
  "#d97a3a",
  "#b1b6bf"
];

const phaseOrder = ["Phase 2", "Phase 3", "Phase 4", "Unknown"];

export function parseRepurposingRows(rows: readonly TableRow[]): ParsedRepurposingRow[] {
  return rows.map((row) => ({
    compoundCid: normalizeText(getSortableCellText(row["Compound CID"])),
    compoundName: normalizeText(getSortableCellText(row["Compound Name"])),
    latestPhase: normalizePhase(getSortableCellText(row["Latest Clinical Trial Phase"])),
    bbbStatus: normalizeBbb(getSortableCellText(row["Blood-Brain Barrier Permeability"])),
    prioritizedTargets: getCellLines(row["Prioritized Targets"]),
    diseaseAreas: getCellLines(row["Disease Area"]),
    diseaseIndications: getCellLines(row["Disease Indication"]),
    mechanisms: getCellLines(row["Mechanism of Action"]),
    activities: getCellLines(row["Activity"]).map(parseActivityLine),
    clinicalTrials: getCellLines(row["Clinical Trials"]).map(parseClinicalTrialLine)
  }));
}

export function getPrioritizedTargetOptions(rows: readonly ParsedRepurposingRow[]): string[] {
  return [...new Set(rows.flatMap((row) => row.prioritizedTargets))].sort(sortText);
}

export function getDiseaseAreaOptions(rows: readonly ParsedRepurposingRow[]): string[] {
  return uniqueLines(rows.flatMap((row) => row.diseaseAreas)).sort(sortText);
}

export function buildMaxPhaseFigure(rows: readonly ParsedRepurposingRow[]): DonutFigureData {
  return buildSimpleCountFigure(
    rows.map((row) => row.latestPhase ?? "Unknown"),
    "No phase values are available for the current rows.",
    phaseOrder
  );
}

export function buildBbbFigure(rows: readonly ParsedRepurposingRow[]): DonutFigureData {
  return buildSimpleCountFigure(
    rows.map((row) => row.bbbStatus ?? "Unknown"),
    "No BBB values are available for the current rows.",
    ["BBB+", "BBB-", "Unknown"]
  );
}

export function buildDiseaseAreaFigure(rows: readonly ParsedRepurposingRow[]): DonutFigureData {
  return buildOccurrenceCountFigure(
    rows,
    (row) => row.diseaseAreas,
    "No disease-area values are available for the current rows."
  );
}

export function buildScopedFieldFigure(
  rows: readonly ParsedRepurposingRow[],
  scopeMode: ScopeMode,
  scopeValue: string | null,
  field: "diseaseIndications" | "mechanisms"
): DonutFigureData {
  const scopedRows = filterRowsByScope(rows, scopeMode, scopeValue);
  const label =
    field === "diseaseIndications" ? "disease-indication" : "mechanism-of-action";

  return buildOccurrenceCountFigure(
    scopedRows,
    (row) => row[field],
    `No ${label} values are available for the selected subset.`
  );
}

export function buildActivityTypeFigure(
  rows: readonly ParsedRepurposingRow[],
  target: string | null,
  mode: ActivityCountMode
): DonutFigureData {
  if (!target) {
    return {
      slices: [],
      emptyMessage: "Select a prioritized target to view activity-type ratios."
    };
  }

  const matchingRows = rows.filter((row) => row.prioritizedTargets.includes(target));
  if (matchingRows.length === 0) {
    return {
      slices: [],
      emptyMessage: "No visible rows contain the selected prioritized target."
    };
  }

  const totals = new Map<string, number>();
  const hoverMap = new Map<string, string[]>();

  for (const row of matchingRows) {
    const compoundName = row.compoundName ?? row.compoundCid ?? "Unknown compound";
    const activities = row.activities.filter(
      (activity) => activity.target === target && activity.type && activity.displayText
    );

    if (mode === "interaction") {
      if (activities.length === 0) {
        incrementMap(totals, "Unknown", 1);
        appendHover(hoverMap, "Unknown", compoundName);
        continue;
      }

      for (const activity of activities) {
        incrementMap(totals, activity.type as string, 1);
        appendHover(
          hoverMap,
          activity.type as string,
          `${compoundName} (${stripTargetPrefix(activity.displayText)})`
        );
      }
      continue;
    }

    const grouped = new Map<string, string[]>();
    for (const activity of activities) {
      const activityType = activity.type as string;
      const entries = grouped.get(activityType) ?? [];
      entries.push(stripTargetPrefix(activity.displayText));
      grouped.set(activityType, entries);
    }

    if (grouped.size === 0) {
      incrementMap(totals, "Unknown", 1);
      appendHover(hoverMap, "Unknown", compoundName);
      continue;
    }

    for (const [activityType, values] of grouped) {
      incrementMap(totals, activityType, 1);
      appendHover(hoverMap, activityType, `${compoundName} (${values.join(", ")})`);
    }
  }

  const slices = sortEntries(totals).map(([label, value], index) => ({
    label,
    value,
    color: label === "Unknown" ? "#b1b6bf" : overviewPalette[index % overviewPalette.length],
    hoverDetail: uniqueLines(hoverMap.get(label) ?? []).join("<br>")
  }));

  return {
    slices,
    emptyMessage: "No activity values are available for the selected prioritized target."
  };
}

export function buildClinicalTrialSunburst(
  rows: readonly ParsedRepurposingRow[],
  scopeMode: ScopeMode,
  scopeValue: string | null
): SunburstFigureData {
  const scopedRows = filterRowsByScope(rows, scopeMode, scopeValue);
  const phaseTotals = new Map<string, number>();
  const conditionTotals = new Map<string, number>();

  for (const row of scopedRows) {
    const trials = row.clinicalTrials
      .map(resolveClinicalTrialParts)
      .filter((trial) => trial.condition || trial.phase);
    if (trials.length === 0) {
      incrementMap(phaseTotals, "Unknown", 1);
      incrementMap(conditionTotals, "Unknown|||Unknown", 1);
      continue;
    }

    for (const trial of trials) {
      const phase = trial.phase ?? "Unknown";
      const condition = trial.condition ?? "Unknown";
      incrementMap(phaseTotals, phase, 1);
      incrementMap(conditionTotals, `${phase}|||${condition}`, 1);
    }
  }

  const nodes: SunburstNodeData[] = [];
  const orderedPhases = [
    ...phaseOrder.filter((phase) => phaseTotals.has(phase)),
    ...sortEntries(phaseTotals)
      .map(([phase]) => phase)
      .filter((phase) => !phaseOrder.includes(phase))
  ];

  for (const phase of orderedPhases) {
    const value = phaseTotals.get(phase) ?? 0;
    if (value <= 0) {
      continue;
    }

    nodes.push({
      id: phase,
      label: phase,
      parent: "",
      value,
      color: phaseColors[phase] ?? "#b1b6bf"
    });
  }

  for (const [key, value] of conditionTotals) {
    const [phase, condition] = key.split("|||");
    nodes.push({
      id: `${phase}|||${condition}`,
      label: condition,
      parent: phase,
      value,
      color: phaseColors[phase] ?? "#b1b6bf"
    });
  }

  return {
    nodes,
    emptyMessage: "No clinical-trial records are available for the selected subset."
  };
}

function buildSimpleCountFigure(
  values: readonly string[],
  emptyMessage: string,
  preferredOrder: readonly string[]
): DonutFigureData {
  const totals = new Map<string, number>();

  for (const value of values) {
    incrementMap(totals, value || "Unknown", 1);
  }

  const ordered = [
    ...preferredOrder.filter((label) => totals.has(label)).map((label) => [label, totals.get(label) ?? 0] as const),
    ...sortEntries(totals).filter(([label]) => !preferredOrder.includes(label))
  ];

  return {
    slices: ordered.map(([label, value], index) => ({
      label,
      value,
      color: phaseColors[label] ?? overviewPalette[index % overviewPalette.length]
    })),
    emptyMessage
  };
}

function buildOccurrenceCountFigure(
  rows: readonly ParsedRepurposingRow[],
  selector: (row: ParsedRepurposingRow) => readonly string[],
  emptyMessage: string
): DonutFigureData {
  const totals = new Map<string, { label: string; value: number }>();

  for (const row of rows) {
    const values = uniqueLines(selector(row));
    if (values.length === 0) {
      incrementNormalizedTotal(totals, "Unknown");
      continue;
    }

    for (const value of values) {
      incrementNormalizedTotal(totals, value);
    }
  }

  return {
    slices: [...totals.values()]
      .sort((left, right) =>
        right.value - left.value || left.label.localeCompare(right.label, undefined, { sensitivity: "base" })
      )
      .map(({ label, value }, index) => ({
        label,
        value,
        color: label === "Unknown" ? "#b1b6bf" : overviewPalette[index % overviewPalette.length]
      })),
    emptyMessage
  };
}

function filterRowsByScope(
  rows: readonly ParsedRepurposingRow[],
  scopeMode: ScopeMode,
  scopeValue: string | null
): ParsedRepurposingRow[] {
  if (!scopeValue) {
    return [];
  }

  return rows.filter((row) =>
    scopeMode === "disease-area"
      ? row.diseaseAreas.some((value) => normalizedLabelKey(value) === normalizedLabelKey(scopeValue))
      : row.prioritizedTargets.some(
          (value) => normalizedLabelKey(value) === normalizedLabelKey(scopeValue)
        )
  );
}

function parseActivityLine(value: string): ParsedRepurposingActivity {
  const match = value.match(/^(.*?)\s*\((.+)\)$/);
  if (!match) {
    return {
      target: null,
      type: null,
      displayText: value
    };
  }

  const target = normalizeText(match[1]);
  const descriptor = normalizeText(match[2]);
  if (!target || !descriptor) {
    return {
      target,
      type: null,
      displayText: value
    };
  }

  const compact = descriptor.replace(/\s+/g, "");
  const typeMatch = compact.match(/^(AC50|Activity|EC50|fIC50|GI50|IC50|INH|Kd|Ki|Km|Potency)/i);

  return {
    target,
    type: typeMatch ? normalizeActivityType(typeMatch[1]) : null,
    displayText: `${target} (${descriptor})`
  };
}

function parseClinicalTrialLine(value: string): ParsedClinicalTrial {
  const resolved = resolveClinicalTrialParts({
    condition: null,
    phase: null,
    displayText: value
  });

  return {
    condition: resolved.condition,
    phase: resolved.phase,
    displayText: value
  };
}

function resolveClinicalTrialParts(trial: ParsedClinicalTrial): ParsedClinicalTrial {
  const directCondition = normalizeText(trial.condition);
  const directPhase = normalizePhase(trial.phase);
  if (directCondition && directPhase) {
    return {
      ...trial,
      condition: directCondition,
      phase: directPhase
    };
  }

  const text = normalizeText(trial.displayText);
  if (!text) {
    return {
      ...trial,
      condition: directCondition,
      phase: directPhase
    };
  }

  const explicitPhaseMatch = text.match(/^(.*?)\s*\(\s*phase\s*([^)]+?)\s*\)\s*$/i);
  if (explicitPhaseMatch) {
    return {
      ...trial,
      condition: normalizeText(explicitPhaseMatch[1]),
      phase: normalizePhase(explicitPhaseMatch[2])
    };
  }

  const phaseAnywhereMatch = text.match(/\(\s*phase\s*([^)]+?)\s*\)\s*$/i);
  return {
    ...trial,
    condition: normalizeText(text.replace(/\(\s*phase\s*([^)]+?)\s*\)\s*$/i, "")) ?? directCondition,
    phase: normalizePhase(phaseAnywhereMatch?.[1] ?? directPhase)
  };
}

function getCellLines(value: TableRow[keyof TableRow]): string[] {
  const richCell = toDisplayRichCell(value);
  if (richCell) {
    return richCell.lines
      .map((line) => line.text.trim())
      .filter(Boolean);
  }

  return getSortableCellText(value)
    .split(/\n|\|/g)
    .map((line) => line.trim())
    .filter(Boolean);
}

function incrementMap(map: Map<string, number>, key: string, amount: number) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function incrementNormalizedTotal(
  map: Map<string, { label: string; value: number }>,
  label: string
) {
  const key = normalizedLabelKey(label);
  const current = map.get(key);
  map.set(key, {
    label: current?.label ?? label,
    value: (current?.value ?? 0) + 1
  });
}

function appendHover(map: Map<string, string[]>, key: string, line: string) {
  const lines = map.get(key) ?? [];
  lines.push(line);
  map.set(key, lines);
}

function sortEntries(map: ReadonlyMap<string, number>): Array<[string, number]> {
  return [...map.entries()].sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0], undefined, { sensitivity: "base" });
  });
}

function sortText(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

function uniqueLines(values: readonly string[]): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const trimmed = value.trim();
    const key = normalizedLabelKey(trimmed);
    if (!trimmed || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(trimmed);
  }

  return unique;
}

function normalizedLabelKey(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function stripTargetPrefix(value: string): string {
  const match = value.match(/^[^(]+\((.+)\)$/);
  return match ? match[1] : value;
}

function normalizePhase(value: string | null): string | null {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  const normalized = text.replace(/^phase\s*/i, "");
  if (normalized === "2" || normalized === "3" || normalized === "4") {
    return `Phase ${normalized}`;
  }

  return text;
}

function normalizeBbb(value: string): string | null {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  if (text.includes("+")) {
    return "BBB+";
  }

  if (text.includes("-")) {
    return "BBB-";
  }

  return "Unknown";
}

function normalizeActivityType(value: string): string {
  const knownTypes = ["AC50", "Activity", "EC50", "fIC50", "GI50", "IC50", "INH", "Kd", "Ki", "Km", "Potency"];
  const match = knownTypes.find((item) => item.toLowerCase() === value.toLowerCase());
  return match ?? value;
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}
