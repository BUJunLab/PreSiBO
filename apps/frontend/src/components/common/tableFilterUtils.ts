import type { TableCell, TableRow } from "../../api/types";
import { parseNumericTableCell, parseNumericText } from "./tableNumberUtils";
import { getSortableCellText, isRichTableCell } from "./tableCellUtils";

export type TableFilterMode =
  | "text-contains"
  | "text-not-contains"
  | "text-equals"
  | "text-not-equals"
  | "text-starts-with"
  | "text-ends-with"
  | "is-empty"
  | "is-not-empty"
  | "text-select"
  | "number-compare"
  | "clinical-phase"
  | "clinical-condition"
  | "bioassay-source"
  | "bioassay-type"
  | "activity-gene"
  | "activity-type"
  | "activity-value";

export type NumberOperator = "lt" | "lte" | "eq" | "gte" | "gt";

export interface TableFilterDefinition {
  id: string;
  column: string;
  mode: TableFilterMode;
  value?: string;
  values?: string[];
  operator?: NumberOperator;
}

export interface TableFilterModeOption {
  mode: TableFilterMode;
  label: string;
}

export interface TableFilterColumnMetadata {
  column: string;
  kind: "text" | "numeric" | "clinical" | "bioassay" | "activity";
  modeOptions: TableFilterModeOption[];
}

const textFilterModeOptions: TableFilterModeOption[] = [
  { mode: "text-contains", label: "contains" },
  { mode: "text-not-contains", label: "does not contain" },
  { mode: "text-equals", label: "equals" },
  { mode: "text-not-equals", label: "does not equal" },
  { mode: "text-starts-with", label: "starts with" },
  { mode: "text-ends-with", label: "ends with" },
  { mode: "is-empty", label: "is empty" },
  { mode: "is-not-empty", label: "is not empty" },
  { mode: "text-select", label: "is any of" }
];

export function buildColumnMetadata(
  columns: readonly string[],
  rows: readonly TableRow[]
): TableFilterColumnMetadata[] {
  return columns.map((column) => {
    const kind = classifyColumn(column, rows);
    return {
      column,
      kind,
      modeOptions: buildModeOptions(kind)
    };
  });
}

export function getModeSelectionOptions(
  rows: readonly TableRow[],
  column: string,
  mode: TableFilterMode
): string[] {
  const values = new Set<string>();

  for (const row of rows) {
    const cell = row[column];
    for (const value of extractModeValues(cell, mode)) {
      values.add(value);
    }
  }

  return [...values].sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" })
  );
}

export function applyTableFilters(
  rows: readonly TableRow[],
  filters: readonly TableFilterDefinition[]
): TableRow[] {
  if (filters.length === 0) {
    return [...rows];
  }

  const filtersByColumn = new Map<string, TableFilterDefinition[]>();
  for (const filter of filters) {
    const current = filtersByColumn.get(filter.column) ?? [];
    current.push(filter);
    filtersByColumn.set(filter.column, current);
  }

  return rows.filter((row) => {
    for (const [column, columnFilters] of filtersByColumn) {
      if (!matchesColumnFilters(row[column], columnFilters)) {
        return false;
      }
    }
    return true;
  });
}

export function describeFilter(filter: TableFilterDefinition): string {
  const column = filter.column;
  const valueText = filter.values?.join(", ") ?? filter.value ?? "";

  switch (filter.mode) {
    case "text-contains":
      return `${column}: contains "${valueText}"`;
    case "text-not-contains":
      return `${column}: does not contain "${valueText}"`;
    case "text-equals":
      return `${column}: equals "${valueText}"`;
    case "text-not-equals":
      return `${column}: does not equal "${valueText}"`;
    case "text-starts-with":
      return `${column}: starts with "${valueText}"`;
    case "text-ends-with":
      return `${column}: ends with "${valueText}"`;
    case "is-empty":
      return `${column}: is empty`;
    case "is-not-empty":
      return `${column}: is not empty`;
    case "text-select":
      return `${column}: is any of [${valueText}]`;
    case "number-compare":
      return `${column}: ${operatorSymbol(filter.operator ?? "eq")} ${valueText}`;
    case "clinical-phase":
      return `${column} phase: in [${valueText}]`;
    case "clinical-condition":
      return `${column} condition: in [${valueText}]`;
    case "bioassay-source":
      return `${column} source: in [${valueText}]`;
    case "bioassay-type":
      return `${column} type: in [${valueText}]`;
    case "activity-gene":
      return `${column} gene: in [${valueText}]`;
    case "activity-type":
      return `${column} type: in [${valueText}]`;
    case "activity-value":
      return `${column} value: ${operatorSymbol(filter.operator ?? "eq")} ${valueText}`;
  }
}

function classifyColumn(column: string, rows: readonly TableRow[]) {
  if (column === "Clinical Trials") {
    return "clinical";
  }

  if (column === "Bioassays") {
    return "bioassay";
  }

  if (column === "Activity") {
    return "activity";
  }

  const samples = rows
    .map((row) => row[column])
    .filter((value) => value !== null && value !== undefined);
  const numericSamples = samples.filter((value) => parseNumericTableCell(value) !== null);

  if (samples.length > 0 && numericSamples.length / samples.length >= 0.85) {
    return "numeric";
  }

  return "text";
}

function buildModeOptions(kind: TableFilterColumnMetadata["kind"]): TableFilterModeOption[] {
  if (kind === "numeric") {
    return [
      ...textFilterModeOptions,
      { mode: "number-compare", label: "compare number" }
    ];
  }

  if (kind === "clinical") {
    return [
      ...textFilterModeOptions,
      { mode: "clinical-phase", label: "Phase is one of" },
      { mode: "clinical-condition", label: "Condition is one of" }
    ];
  }

  if (kind === "bioassay") {
    return [
      ...textFilterModeOptions,
      { mode: "bioassay-source", label: "Source is one of" },
      { mode: "bioassay-type", label: "Type is one of" }
    ];
  }

  if (kind === "activity") {
    return [
      ...textFilterModeOptions,
      { mode: "activity-gene", label: "Gene is one of" },
      { mode: "activity-type", label: "Activity type is one of" },
      { mode: "activity-value", label: "Activity value compares to" }
    ];
  }

  return textFilterModeOptions;
}

function extractModeValues(cell: TableCell | undefined, mode: TableFilterMode): string[] {
  switch (mode) {
    case "text-select":
      return extractCellLines(cell);
    case "clinical-phase":
      return parseClinicalEntries(cell)
        .map((entry) => entry.phase)
        .filter((value): value is string => Boolean(value));
    case "clinical-condition":
      return parseClinicalEntries(cell)
        .map((entry) => entry.condition)
        .filter((value): value is string => Boolean(value));
    case "bioassay-source":
      return parseBioassayEntries(cell)
        .map((entry) => entry.source)
        .filter((value): value is string => Boolean(value));
    case "bioassay-type":
      return parseBioassayEntries(cell)
        .map((entry) => entry.type)
        .filter((value): value is string => Boolean(value));
    case "activity-gene":
      return parseActivityEntries(cell)
        .map((entry) => entry.gene)
        .filter((value): value is string => Boolean(value));
    case "activity-type":
      return parseActivityEntries(cell)
        .map((entry) => entry.type)
        .filter((value): value is string => Boolean(value));
    default:
      return [];
  }
}

function matchesColumnFilters(
  cell: TableCell | undefined,
  filters: readonly TableFilterDefinition[]
): boolean {
  const textFilters = filters.filter((filter) => filterModeUsesTextInput(filter.mode));
  const emptyFilters = filters.filter((filter) => filterModeUsesNoValue(filter.mode));
  const selectFilters = filters.filter((filter) => filter.mode === "text-select");
  const numericFilters = filters.filter((filter) => filter.mode === "number-compare");
  const clinicalFilters = filters.filter((filter) =>
    filter.mode === "clinical-phase" || filter.mode === "clinical-condition"
  );
  const bioassayFilters = filters.filter((filter) =>
    filter.mode === "bioassay-source" || filter.mode === "bioassay-type"
  );
  const activityFilters = filters.filter((filter) =>
    filter.mode === "activity-gene" ||
    filter.mode === "activity-type" ||
    filter.mode === "activity-value"
  );

  for (const filter of textFilters) {
    if (!matchesTextFilter(cell, filter)) {
      return false;
    }
  }

  for (const filter of emptyFilters) {
    const isEmpty = cellIsEmpty(cell);
    if (filter.mode === "is-empty" && !isEmpty) {
      return false;
    }
    if (filter.mode === "is-not-empty" && isEmpty) {
      return false;
    }
  }

  if (selectFilters.length > 0) {
    const lines = new Set(extractCellLines(cell));
    for (const filter of selectFilters) {
      const values = filter.values ?? [];
      if (values.length > 0 && !values.some((value) => lines.has(value))) {
        return false;
      }
    }
  }

  if (numericFilters.length > 0) {
    const numericValue = parseNumericTableCell(cell);
    if (numericValue === null) {
      return false;
    }
    for (const filter of numericFilters) {
      const target = parseNumericText(String(filter.value ?? ""));
      if (target === null || !matchesNumberFilter(numericValue, filter.operator ?? "eq", target)) {
        return false;
      }
    }
  }

  if (clinicalFilters.length > 0 && !matchesClinicalFilters(parseClinicalEntries(cell), clinicalFilters)) {
    return false;
  }

  if (bioassayFilters.length > 0 && !matchesBioassayFilters(parseBioassayEntries(cell), bioassayFilters)) {
    return false;
  }

  if (activityFilters.length > 0 && !matchesActivityFilters(parseActivityEntries(cell), activityFilters)) {
    return false;
  }

  return true;
}

export function filterModeUsesTextInput(mode: TableFilterMode | "") {
  return (
    mode === "text-contains" ||
    mode === "text-not-contains" ||
    mode === "text-equals" ||
    mode === "text-not-equals" ||
    mode === "text-starts-with" ||
    mode === "text-ends-with"
  );
}

export function filterModeUsesNumberInput(mode: TableFilterMode | "") {
  return mode === "number-compare" || mode === "activity-value";
}

export function filterModeUsesSelection(mode: TableFilterMode | "") {
  return (
    mode === "text-select" ||
    mode === "clinical-phase" ||
    mode === "clinical-condition" ||
    mode === "bioassay-source" ||
    mode === "bioassay-type" ||
    mode === "activity-gene" ||
    mode === "activity-type"
  );
}

export function filterModeUsesNoValue(mode: TableFilterMode | "") {
  return mode === "is-empty" || mode === "is-not-empty";
}

function matchesTextFilter(cell: TableCell | undefined, filter: TableFilterDefinition) {
  const cellText = getSortableCellText(cell).trim().toLowerCase();
  const query = String(filter.value ?? "").trim().toLowerCase();
  if (!query) {
    return true;
  }

  switch (filter.mode) {
    case "text-not-contains":
      return !cellText.includes(query);
    case "text-equals":
      return cellText === query;
    case "text-not-equals":
      return cellText !== query;
    case "text-starts-with":
      return cellText.startsWith(query);
    case "text-ends-with":
      return cellText.endsWith(query);
    default:
      return cellText.includes(query);
  }
}

function cellIsEmpty(cell: TableCell | undefined) {
  return getSortableCellText(cell).trim() === "" && extractCellLines(cell).length === 0;
}

function matchesClinicalFilters(
  entries: readonly { phase: string | null; condition: string | null }[],
  filters: readonly TableFilterDefinition[]
) {
  if (entries.length === 0) {
    return false;
  }

  return entries.some((entry) =>
    filters.every((filter) => {
      if (filter.mode === "clinical-phase") {
        return (filter.values ?? []).includes(entry.phase ?? "");
      }
      if (filter.mode === "clinical-condition") {
        return (filter.values ?? []).includes(entry.condition ?? "");
      }
      return true;
    })
  );
}

function matchesBioassayFilters(
  entries: readonly { source: string | null; type: string | null }[],
  filters: readonly TableFilterDefinition[]
) {
  if (entries.length === 0) {
    return false;
  }

  return entries.some((entry) =>
    filters.every((filter) => {
      if (filter.mode === "bioassay-source") {
        return (filter.values ?? []).includes(entry.source ?? "");
      }
      if (filter.mode === "bioassay-type") {
        return (filter.values ?? []).includes(entry.type ?? "");
      }
      return true;
    })
  );
}

function matchesActivityFilters(
  entries: readonly { gene: string | null; type: string | null; numericValue: number | null }[],
  filters: readonly TableFilterDefinition[]
) {
  if (entries.length === 0) {
    return false;
  }

  return entries.some((entry) =>
    filters.every((filter) => {
      if (filter.mode === "activity-gene") {
        return (filter.values ?? []).includes(entry.gene ?? "");
      }
      if (filter.mode === "activity-type") {
        return (filter.values ?? []).includes(entry.type ?? "");
      }
      if (filter.mode === "activity-value") {
        const target = parseNumericText(String(filter.value ?? ""));
        return (
          entry.numericValue !== null &&
          target !== null &&
          matchesNumberFilter(entry.numericValue, filter.operator ?? "eq", target)
        );
      }
      return true;
    })
  );
}

function matchesNumberFilter(value: number, operator: NumberOperator, target: number) {
  switch (operator) {
    case "lt":
      return value < target;
    case "lte":
      return value <= target;
    case "gte":
      return value >= target;
    case "gt":
      return value > target;
    default:
      return value === target;
  }
}

function extractCellLines(cell: TableCell | undefined): string[] {
  if (cell === null || cell === undefined) {
    return [];
  }

  if (isRichTableCell(cell)) {
    return cell.lines
      .map((line) => line.text.trim())
      .filter(Boolean);
  }

  return getSortableCellText(cell)
    .split(/\n|\|/g)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseClinicalEntries(cell: TableCell | undefined) {
  return extractCellLines(cell).map((line) => {
    const match = line.match(/^(.*?)(?:\s*\(\s*Phase\s*(.+?)\))?$/i);
    return {
      condition: normalizeText(match?.[1] ?? line),
      phase: normalizeText(match?.[2] ?? null)
    };
  });
}

function parseBioassayEntries(cell: TableCell | undefined) {
  return extractCellLines(cell).map((line) => {
    const sourceMatch = line.match(/\((.*?)\)/);
    const typeMatch = line.match(/:\s*(.+)$/);
    return {
      source: normalizeText(sourceMatch?.[1] ?? null),
      type: normalizeText(typeMatch?.[1] ?? null)
    };
  });
}

function parseActivityEntries(cell: TableCell | undefined) {
  return extractCellLines(cell).map((line) => {
    const match = line.match(/^(.*?)\s*\((.+)\)$/);
    const gene = normalizeText(match?.[1] ?? null);
    const descriptor = normalizeText(match?.[2] ?? null);
    const typeMatch = descriptor?.replace(/\s+/g, "").match(
      /^(AC50|Activity|EC50|fIC50|GI50|IC50|INH|Kd|Ki|Km|Potency)/i
    );
    const remainder = typeMatch
      ? descriptor?.replace(/\s+/g, "").slice(typeMatch[1].length)
      : null;

    return {
      gene,
      type: normalizeText(typeMatch?.[1] ?? null),
      numericValue: remainder ? parseNumericText(remainder) : null
    };
  });
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

export function operatorSymbol(operator: NumberOperator) {
  switch (operator) {
    case "lt":
      return "<";
    case "lte":
      return "<=";
    case "gte":
      return ">=";
    case "gt":
      return ">";
    default:
      return "=";
  }
}
