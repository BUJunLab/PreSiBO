import { databaseName, queryRows } from "../lib/db.js";
import type {
  RichTableCell,
  RichTableCellLine,
  TableCell,
  TableCellAction,
  TableResult,
  TableRow
} from "../types.js";

const schema = `\`${databaseName}\``;

const geneIdColumns = new Set([
  "Gene",
  "Gene ID",
  "Gene Left",
  "Gene Right",
  "Gene Target",
  "Prioritized Targets"
]);
const ensgidColumns = new Set(["ENSGID"]);
const snpIdColumns = new Set(["SNP ID"]);

interface GeneLinkMaps {
  geneIdToUniprotIds: Map<string, string[]>;
  ensgidToUniprotIds: Map<string, string[]>;
}

export async function enrichTableResult(table: TableResult): Promise<TableResult> {
  const linkMaps = await loadGeneLinkMaps(table.rows);

  return {
    ...table,
    rows: table.rows.map((row) => enrichRow(row, linkMaps))
  };
}

function enrichRow(row: TableRow, linkMaps: GeneLinkMaps): TableRow {
  const output: TableRow = { ...row };

  for (const [column, value] of Object.entries(row)) {
    if (snpIdColumns.has(column)) {
      output[column] = createLinkedScalarCell(value, (snpId) => ({
        href: `https://www.ncbi.nlm.nih.gov/snp/${encodeURIComponent(snpId)}`
      }));
      continue;
    }

    if (geneIdColumns.has(column)) {
      output[column] = createGeneLinkedCell(value, {
        kind: "geneId",
        linkMaps,
        includeSearchActions: true
      });
      continue;
    }

    if (ensgidColumns.has(column)) {
      output[column] = createGeneLinkedCell(value, {
        kind: "ensgid",
        linkMaps,
        includeSearchActions: false
      });
    }
  }

  return output;
}

async function loadGeneLinkMaps(rows: readonly TableRow[]): Promise<GeneLinkMaps> {
  const geneIds = new Set<string>();
  const ensgids = new Set<string>();

  for (const row of rows) {
    for (const [column, value] of Object.entries(row)) {
      if (geneIdColumns.has(column)) {
        collectCellTexts(value).forEach((text) => geneIds.add(text));
      } else if (ensgidColumns.has(column)) {
        collectCellTexts(value).forEach((text) => ensgids.add(text));
      }
    }
  }

  if (geneIds.size === 0 && ensgids.size === 0) {
    return {
      geneIdToUniprotIds: new Map(),
      ensgidToUniprotIds: new Map()
    };
  }

  const whereParts: string[] = [];
  const params: string[] = [];

  if (geneIds.size > 0) {
    whereParts.push(
      `source_gene.gene_id IN (${[...geneIds].map(() => "?").join(", ")})`
    );
    params.push(...geneIds);
  }

  if (ensgids.size > 0) {
    whereParts.push(
      `source_gene.ensgid IN (${[...ensgids].map(() => "?").join(", ")})`
    );
    params.push(...ensgids);
  }

  const rowsWithLinks = await queryRows(
    `
      SELECT DISTINCT
        source_gene.gene_id,
        source_gene.ensgid,
        gene_uniprot.uniprot_id
      FROM ${schema}.\`presibo_lite_source_gene\` AS source_gene
      LEFT JOIN ${schema}.\`presibo_lite_gene_uniprot\` AS gene_uniprot
        ON gene_uniprot.source_gene_id = source_gene.source_gene_id
      WHERE ${whereParts.join(" OR ")}
    `,
    params
  );

  const geneIdToUniprotIds = new Map<string, Set<string>>();
  const ensgidToUniprotIds = new Map<string, Set<string>>();

  for (const row of rowsWithLinks) {
    const geneId = normalizeText(row.gene_id);
    const ensgid = normalizeText(row.ensgid);
    const uniprotId = normalizeText(row.uniprot_id);

    if (geneId && uniprotId) {
      addToMapSet(geneIdToUniprotIds, geneId, uniprotId);
    }

    if (ensgid && uniprotId) {
      addToMapSet(ensgidToUniprotIds, ensgid, uniprotId);
    }
  }

  return {
    geneIdToUniprotIds: mapSetToArray(geneIdToUniprotIds),
    ensgidToUniprotIds: mapSetToArray(ensgidToUniprotIds)
  };
}

function collectCellTexts(value: TableCell | undefined): string[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (isRichTableCell(value)) {
    return value.lines
      .map((line) => normalizeText(line.text))
      .filter((text): text is string => Boolean(text));
  }

  return splitPipeDelimitedText(String(value));
}

function createLinkedScalarCell(
  value: TableCell | undefined,
  buildLink: (text: string) => Pick<RichTableCellLine, "href">
): TableCell {
  const text = normalizeText(value);
  if (!text) {
    return value ?? null;
  }

  return createRichCell([
    {
      text,
      ...buildLink(text)
    }
  ]);
}

function createGeneLinkedCell(
  value: TableCell | undefined,
  options: {
    kind: "geneId" | "ensgid";
    linkMaps: GeneLinkMaps;
    includeSearchActions: boolean;
  }
): TableCell {
  if (value === null || value === undefined) {
    return value ?? null;
  }

  const lines = isRichTableCell(value)
    ? value.lines.map((line) => enrichGeneLine(line, options))
    : splitPipeDelimitedText(String(value)).map((text) =>
        enrichGeneLine({ text }, options)
      );

  return lines.length > 0 ? createRichCell(lines) : value;
}

function enrichGeneLine(
  line: RichTableCellLine,
  options: {
    kind: "geneId" | "ensgid";
    linkMaps: GeneLinkMaps;
    includeSearchActions: boolean;
  }
): RichTableCellLine {
  const text = normalizeText(line.text);
  if (!text) {
    return line;
  }

  const uniprotIds =
    options.kind === "geneId"
      ? options.linkMaps.geneIdToUniprotIds.get(text) ?? []
      : options.linkMaps.ensgidToUniprotIds.get(text) ?? [];

  const geneActions = [
    ...buildUniprotActions(uniprotIds),
    ...(options.kind === "geneId" && options.includeSearchActions
      ? buildGeneSearchActions(text)
      : [])
  ];

  return {
    ...line,
    actions: [...(line.actions ?? []), ...geneActions]
  };
}

function buildUniprotActions(uniprotIds: readonly string[]): TableCellAction[] {
  if (uniprotIds.length === 0) {
    return [];
  }

  return uniprotIds.flatMap((uniprotId, index) => {
    const suffix = uniprotIds.length > 1 ? ` (${uniprotId})` : "";
    return [
      {
        label: `UniProt${suffix}`,
        kind: "link",
        href: `https://www.uniprot.org/uniprotkb/${encodeURIComponent(uniprotId)}/entry`
      },
      {
        label: `PubChem${suffix}`,
        kind: "link",
        href: `https://pubchem.ncbi.nlm.nih.gov/protein/${encodeURIComponent(uniprotId)}`
      }
    ];
  });
}

function buildGeneSearchActions(geneId: string): TableCellAction[] {
  return [
    {
      label: "Search in Target/Predictor/Gene",
      kind: "navigate",
      navigation: { page: "target", tab: "Predictor", gene: geneId }
    },
    {
      label: "Search in Target/Signature/Gene",
      kind: "navigate",
      navigation: { page: "target", tab: "Signature", gene: geneId }
    },
    {
      label: "Search in Network/Networks/Gene ID",
      kind: "navigate",
      navigation: { page: "network", tab: "Signature Guided Networks", gene: geneId }
    },
    {
      label: "Search in Drug/M6/Prioritized Targets",
      kind: "navigate",
      navigation: { page: "drug", tab: "M6", query: geneId }
    }
  ];
}

function createRichCell(lines: readonly RichTableCellLine[]): RichTableCell {
  return {
    kind: "rich",
    lines: [...lines],
    exportText: lines.map((line) => line.text).filter(Boolean).join("\n")
  };
}

function isRichTableCell(value: TableCell): value is RichTableCell {
  return typeof value === "object" && value !== null && "kind" in value && value.kind === "rich";
}

function splitPipeDelimitedText(value: string): string[] {
  return value
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function addToMapSet(map: Map<string, Set<string>>, key: string, value: string) {
  const values = map.get(key) ?? new Set<string>();
  values.add(value);
  map.set(key, values);
}

function mapSetToArray(map: Map<string, Set<string>>): Map<string, string[]> {
  return new Map(
    [...map.entries()].map(([key, values]) => [key, [...values].sort((left, right) => left.localeCompare(right))])
  );
}
