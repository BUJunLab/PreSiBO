import { databaseName, queryRows } from "../lib/db.js";
import type {
  RichTableCell,
  RichTableCellLine,
  TableCell,
  TableResult,
  TableRow
} from "../types.js";
import {
  normalizePhase,
  parseActivityText,
  splitPipeDelimitedText
} from "../utils/drugRepurposingActivity.js";
import { buildLiteGeneSubquery } from "../utils/liteScope.js";
import { enrichTableResult } from "../utils/tableEnrichment.js";

const schema = `\`${databaseName}\``;

const drugRepurposingColumns = [
  "Compound CID",
  "Compound Name",
  "Latest Clinical Trial Phase",
  "Blood-Brain Barrier Permeability",
  "Prioritized Targets",
  "Mechanism of Action",
  "Disease Area",
  "Disease Indication",
  "Clinical Trials",
  "Bioassays",
  "Activity",
  "Trial Count",
  "Bioassay Count",
  "Target Count"
] as const;

const drugRepurposingSearchSql = `
  CONCAT_WS(
    ' ',
    NULLIF(TRIM(CAST(delivery.compound_cid AS CHAR)), ''),
    NULLIF(TRIM(delivery.compound_name), ''),
    NULLIF(TRIM(CAST(delivery.latest_clinical_trial_phase AS CHAR)), ''),
    NULLIF(TRIM(CAST(delivery.blood_brain_barrier_permeability AS CHAR)), ''),
    NULLIF(TRIM(REPLACE(COALESCE(delivery.prioritized_targets_text, ''), '|', ' ')), ''),
    NULLIF(TRIM(REPLACE(COALESCE(delivery.mechanism_of_action_text, ''), '|', ' ')), ''),
    NULLIF(TRIM(REPLACE(COALESCE(delivery.disease_area_text, ''), '|', ' ')), ''),
    NULLIF(TRIM(REPLACE(COALESCE(delivery.disease_indication_text, ''), '|', ' ')), ''),
    NULLIF(TRIM(REPLACE(COALESCE(delivery.activity_text, ''), '|', ' ')), ''),
    NULLIF(TRIM(CAST(COALESCE(delivery.clinical_trials_json, '') AS CHAR)), ''),
    NULLIF(TRIM(CAST(COALESCE(delivery.bioassays_json, '') AS CHAR)), '')
  )
`;

const repurposingCacheTtlMs = 60_000;

let allowedGeneSetPromise: Promise<Set<string>> | null = null;

const repurposingRowCache = new Map<
  string,
  { expiresAt: number; promise: Promise<DrugRepurposingRawRow[]> }
>();

export interface DrugRepurposingRawRow {
  compound_cid: number | string | null;
  compound_name: string | null;
  latest_clinical_trial_phase: string | number | null;
  blood_brain_barrier_permeability: string | number | null;
  prioritized_targets_text: string | null;
  mechanism_of_action_text: string | null;
  disease_area_text: string | null;
  disease_indication_text: string | null;
  clinical_trials_json: string | null;
  bioassays_json: string | null;
  activity_text: string | null;
  trial_count: number | null;
  bioassay_count: number | null;
  target_count: number | null;
}

interface ClinicalTrialRecord {
  phase?: string | number | null;
  condition?: string | null;
  nct_id?: string | null;
}

interface BioassayRecord {
  BioAssay_AID?: string | number | null;
  dois?: string | null;
  pmcids?: string | null;
  PMID?: string | number | null;
  Aid_Type?: string | null;
  Bioassay_Data_Source?: string | null;
}

export function buildDrugRepurposingTable(
  rows: readonly DrugRepurposingRawRow[],
  query: string,
  options: { includeDetails?: boolean } = {}
): TableResult {
  const includeDetails = options.includeDetails ?? true;
  return {
    columns: includeDetails
      ? [...drugRepurposingColumns]
      : drugRepurposingColumns.filter(
          (column) => column !== "Clinical Trials" && column !== "Bioassays"
        ),
    rows: rows.map((row) => formatDrugRepurposingRow(row, includeDetails)),
    filename: `drug_repurposing_${query.trim() || "all"}`
  };
}

export async function searchDrugRepurposing(query: string): Promise<TableResult> {
  const rows = await loadDrugRepurposingRows(query);
  return enrichTableResult(buildDrugRepurposingTable(rows, query.trim(), { includeDetails: false }));
}

export async function getDrugRepurposingDetail(
  compoundCid: string,
  query: string
): Promise<TableResult> {
  const rows = await loadDrugRepurposingRows(query);
  const row = rows.find((candidate) => String(candidate.compound_cid ?? "").trim() === compoundCid);
  return enrichTableResult(
    buildDrugRepurposingTable(row ? [row] : [], `compound_${compoundCid}`, {
      includeDetails: true
    })
  );
}

export async function getDrugRepurposingClinicalSummary(query: string): Promise<TableResult> {
  const rows = await loadDrugRepurposingRows(query);
  return {
    columns: ["Compound CID", "Clinical Trials"],
    rows: rows.map((row) => ({
      "Compound CID": createCompoundCidCell(row.compound_cid),
      "Clinical Trials": createClinicalTrialsCell(row.clinical_trials_json)
    })),
    filename: `drug_repurposing_clinical_trials_${query.trim() || "all"}`
  };
}

export async function loadDrugRepurposingRows(
  query: string
): Promise<DrugRepurposingRawRow[]> {
  const trimmedQuery = query.trim();
  const cachedEntry = repurposingRowCache.get(trimmedQuery);
  if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
    return cachedEntry.promise;
  }

  const promise = loadDrugRepurposingRowsUncached(trimmedQuery);
  repurposingRowCache.set(trimmedQuery, {
    expiresAt: Date.now() + repurposingCacheTtlMs,
    promise
  });

  try {
    return await promise;
  } catch (error) {
    repurposingRowCache.delete(trimmedQuery);
    throw error;
  }
}

async function loadDrugRepurposingRowsUncached(
  trimmedQuery: string
): Promise<DrugRepurposingRawRow[]> {
  const [rows, allowedGenes] = await Promise.all([
    queryRows(
      `
        SELECT
          compound_cid,
          compound_name,
          latest_clinical_trial_phase,
          blood_brain_barrier_permeability,
          prioritized_targets_text,
          mechanism_of_action_text,
          disease_area_text,
          disease_indication_text,
          clinical_trials_json,
          bioassays_json,
          activity_text,
          trial_count,
          bioassay_count,
          target_count
        FROM ${schema}.\`presibo_lite_delivery_cache\` AS delivery
        WHERE ${drugRepurposingSearchSql} LIKE ?
      `,
      [`%${trimmedQuery}%`]
    ),
    loadAllowedGeneSet()
  ]);

  return (rows as unknown as DrugRepurposingRawRow[])
    .map((row) => constrainDrugRepurposingRow(row, allowedGenes))
    .filter((row): row is DrugRepurposingRawRow => Boolean(row));
}

async function loadAllowedGeneSet() {
  if (!allowedGeneSetPromise) {
    allowedGeneSetPromise = queryRows(
      `
        SELECT gene_id
        FROM (${buildLiteGeneSubquery()}) AS lite_genes
      `
    )
      .then((rows) => {
        return new Set(
          rows
            .map((row) => normalizeText(row.gene_id))
            .filter((geneId): geneId is string => Boolean(geneId))
        );
      })
      .catch((error) => {
        allowedGeneSetPromise = null;
        throw error;
      });
  }

  return allowedGeneSetPromise;
}

function formatDrugRepurposingRow(row: DrugRepurposingRawRow, includeDetails: boolean): TableRow {
  return {
    "Compound CID": createCompoundCidCell(row.compound_cid),
    "Compound Name": createCompoundNameCell(row.compound_name),
    "Compound Structure": createCompoundStructureCell(row.compound_cid, row.compound_name),
    "Latest Clinical Trial Phase": normalizeScalar(row.latest_clinical_trial_phase),
    "Blood-Brain Barrier Permeability": normalizeScalar(
      row.blood_brain_barrier_permeability
    ),
    "Prioritized Targets": createPipeDelimitedCell(row.prioritized_targets_text),
    "Mechanism of Action": createPipeDelimitedCell(row.mechanism_of_action_text),
    "Disease Area": createPipeDelimitedCell(row.disease_area_text),
    "Disease Indication": createPipeDelimitedCell(row.disease_indication_text),
    ...(includeDetails
      ? {
          "Clinical Trials": createClinicalTrialsCell(row.clinical_trials_json),
          Bioassays: createBioassaysCell(row.bioassays_json)
        }
      : {}),
    "Activity": createActivityCell(row.activity_text),
    "Trial Count": normalizeScalar(row.trial_count),
    "Bioassay Count": normalizeScalar(row.bioassay_count),
    "Target Count": normalizeScalar(row.target_count)
  };
}

function createCompoundCidCell(value: string | number | null): TableCell {
  const cid = normalizeText(value);
  if (!cid) {
    return null;
  }

  return createRichCell([
    {
      text: cid,
      href: `https://pubchem.ncbi.nlm.nih.gov/compound/${encodeURIComponent(cid)}`
    }
  ]);
}

function createCompoundNameCell(value: string | null): TableCell {
  const compoundName = normalizeText(value);
  if (!compoundName) {
    return null;
  }

  return createRichCell([
    {
      text: compoundName,
      clickAction: {
        label: "Open compound record",
        kind: "detail",
        detailId: "compound-record"
      }
    }
  ]);
}

function createCompoundStructureCell(
  compoundCid: string | number | null,
  compoundName: string | null
): TableCell {
  const cid = normalizeText(compoundCid);
  if (!cid) {
    return null;
  }

  return createRichCell(
    [
      {
        text: "",
        imageUrl: `https://pubchem.ncbi.nlm.nih.gov/image/imgsrv.fcgi?cid=${encodeURIComponent(cid)}&t=l`,
        imageAlt: `${normalizeText(compoundName) ?? cid} structure`
      }
    ],
    ""
  );
}

function constrainDrugRepurposingRow(
  row: DrugRepurposingRawRow,
  allowedGenes: ReadonlySet<string>
): DrugRepurposingRawRow | null {
  const prioritizedTargets = uniqueOrderedValues(
    splitPipeDelimitedText(row.prioritized_targets_text).filter((target) => allowedGenes.has(target))
  );

  if (prioritizedTargets.length === 0) {
    return null;
  }

  const activityLines = parseActivityText(row.activity_text)
    .filter((activity) => activity.target && allowedGenes.has(activity.target))
    .map((activity) => activity.displayText);

  return {
    ...row,
    prioritized_targets_text: prioritizedTargets.join("|"),
    activity_text: activityLines.join("|") || null,
    target_count: prioritizedTargets.length
  };
}

function uniqueOrderedValues(values: readonly string[]) {
  return [...new Set(values)];
}

function createPipeDelimitedCell(value: string | null): TableCell {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  if (!text.includes("|")) {
    return text;
  }

  const lines = splitPipeDelimitedText(text)
    .map((part) => part.trim())
    .map((part) => ({ text: part }));

  return createRichCell(lines);
}

function createActivityCell(value: string | null): TableCell {
  const parsedValues = parseActivityText(value);
  if (parsedValues.length === 0) {
    return null;
  }

  return createRichCell(
    parsedValues.map((parsedValue) => ({
      text: parsedValue.displayText
    })),
    parsedValues.map((parsedValue) => parsedValue.displayText).join("\n")
  );
}

function createClinicalTrialsCell(value: string | null): RichTableCell {
  const records = parseJsonArray<ClinicalTrialRecord>(value);
  const lines = records
    .map((record) => createClinicalTrialLine(record))
    .filter((line): line is RichTableCellLine => line !== null);

  return createRichCell(lines);
}

function createClinicalTrialLine(record: ClinicalTrialRecord): RichTableCellLine | null {
  const condition = normalizeText(record.condition);
  const phase = normalizePhase(record.phase);
  const nctId = normalizeText(record.nct_id);

  const parts = [condition, phase ? `(Phase ${phase})` : null].filter(Boolean);
  const text = parts.join(" ").trim();
  if (!text) {
    return null;
  }

  return {
    text,
    actions: nctId
      ? [
          {
            label: "ClinicalTrials.gov",
            href: `https://clinicaltrials.gov/study/${encodeURIComponent(nctId)}`
          }
        ]
      : undefined
  };
}

function createBioassaysCell(value: string | null): RichTableCell {
  const records = parseJsonArray<BioassayRecord>(value);
  const lines = records
    .map((record) => createBioassayLine(record))
    .filter((line): line is RichTableCellLine => line !== null);

  return createRichCell(lines);
}

function createBioassayLine(record: BioassayRecord): RichTableCellLine | null {
  const aid = normalizeText(record.BioAssay_AID);
  const source = normalizeText(record.Bioassay_Data_Source);
  const aidType = normalizeText(record.Aid_Type);
  const text = [
    aid,
    source ? `(${source})` : null,
    aidType ? `: ${aidType}` : null
  ]
    .filter(Boolean)
    .join(" ")
    .replace(" : ", ": ")
    .trim();

  if (!text) {
    return null;
  }

  const actions = [
    aid
      ? {
          label: "PubChem",
          href: `https://pubchem.ncbi.nlm.nih.gov/bioassay/${encodeURIComponent(aid)}`
        }
      : null,
    ...createOptionalActions("DOI", record.dois, (doi) => `https://doi.org/${doi}`),
    ...createOptionalActions("PMC", record.pmcids, (pmcid) => {
      return `https://pmc.ncbi.nlm.nih.gov/articles/${pmcid}/`;
    }),
    ...createOptionalActions("PubMed", record.PMID, (pmid) => {
      return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
    })
  ].filter((action): action is NonNullable<typeof action> => action !== null);

  return {
    text,
    actions: actions.length > 0 ? actions : undefined
  };
}

function createOptionalActions(
  label: string,
  value: unknown,
  hrefBuilder: (value: string) => string
): { label: string; href: string }[] {
  return splitPipeDelimitedText(value).map((part) => ({
    label,
    href: hrefBuilder(part)
  }));
}

function parseJsonArray<T>(value: string | null): T[] {
  const text = normalizeText(value);
  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function createRichCell(
  lines: readonly RichTableCellLine[],
  exportText = lines.map((line) => line.text).join("\n")
): RichTableCell {
  return {
    kind: "rich",
    lines: [...lines],
    exportText
  };
}

function normalizeScalar(value: string | number | null): string | number | null {
  if (typeof value === "number") {
    return value;
  }

  return normalizeText(value);
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}
