import type { TableRow } from "../../api/types";

export interface GeneModuleRow {
  networkId: string;
  moduleId: string;
  source: string;
  study: string;
}

const moduleIdCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base"
});

export function getGeneModuleRows(rows: TableRow[] | undefined): GeneModuleRow[] {
  const seen = new Set<string>();

  return (rows ?? []).flatMap((row) => {
    const networkId = String(row["PreSiBO Network ID"] ?? "").trim();
    const moduleId = String(row["Module ID"] ?? "").trim();
    const source = String(row["Omics Source"] ?? "").trim();
    const study = String(row["Discovery Study"] ?? "").trim();
    const key = `${networkId}\u0000${moduleId}\u0000${source}\u0000${study}`;
    if (!moduleId || seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [{ networkId, moduleId, source: source || "—", study: study || "—" }];
  }).sort((left, right) => moduleIdCollator.compare(left.moduleId, right.moduleId));
}

export function sortModuleIds(moduleIds: readonly string[]): string[] {
  return [...moduleIds].sort(moduleIdCollator.compare);
}

export function getFirstMatchingModuleId(
  moduleIds: readonly string[],
  matches: readonly GeneModuleRow[]
): string | null {
  const matchingModuleIds = new Set(matches.map((match) => match.moduleId));
  return sortModuleIds(moduleIds).find((moduleId) => matchingModuleIds.has(moduleId))
    ?? sortModuleIds(matches.map((match) => match.moduleId))[0]
    ?? null;
}
