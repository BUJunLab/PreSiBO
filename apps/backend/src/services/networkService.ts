import { databaseName, queryRows } from "../lib/db.js";
import type { DonutSlice, TableResult } from "../types.js";
import { createTableResult } from "../utils/http.js";
import {
  buildLiteEnsgidColumnClause,
  buildLiteNetworkIdClause,
  LITE_NETWORK_ID
} from "../utils/liteScope.js";
import { enrichTableResult } from "../utils/tableEnrichment.js";

const schema = `\`${databaseName}\``;

const networkColumns = [
  "PreSiBO Network ID",
  "Module ID",
  "Omics Source",
  "Discovery Study",
  "Discovery Tissue",
  "Validation Study",
  "Validation Tissue",
  "Tissue/Cell Type",
  "Z Summary",
  "P-val (ADvsAsymAD)",
  "P-val (AD)"
];

const networkProfileColumns = [
  "Gene ID",
  "Meta3All-P",
  "Meta2-BRAAK-P",
  "Meta2-CERAD-P",
  "PSD95-P",
  "Ab42-P",
  "ptau181-P",
  "ptau231-P",
  "ptau181_ttau-P",
  "ptau231_ttau-P",
  "C4A-P",
  "C4B-P",
  "PPP2CB-P",
  "PPP2CA-P"
];

const prsColumns = [
  "PreSiBO Network ID",
  "PRS Study",
  "Network Subgroup",
  "Network Study",
  "Network Data",
  "Outcome",
  "BETA",
  "SE",
  "P"
];

const drugColumns = [
  "Drug Name",
  "Clinical Phase",
  "Mechanism of Action",
  "Disease Area",
  "Indication",
  "ENSGID",
  "Gene ID"
];

const networkReferenceSelect = `
  SELECT
    presibo_network_id AS \`PreSiBO Network ID\`,
    module_id AS \`Module ID\`,
    omics_source AS \`Omics Source\`,
    discovery_study AS \`Discovery Study\`,
    discovery_tissue AS \`Discovery Tissue\`,
    validation_study AS \`Validation Study\`,
    validation_tissue AS \`Validation Tissue\`,
    tissue_or_cell_type AS \`Tissue/Cell Type\`,
    zsummary AS \`Z Summary\`,
    module_pval_ad_vs_asymad AS \`P-val (ADvsAsymAD)\`,
    module_pval_ad AS \`P-val (AD)\`
  FROM ${schema}.\`network_reference_table\`
`;

export async function getSignatureGuidedNetworksTable(
  filters: {
    genes?: readonly string[];
    sources?: readonly string[];
    moduleIds?: readonly string[];
    zMin?: number;
  }
): Promise<TableResult> {
  const { sql, params } = buildNetworkReferenceQuery(filters);
  const rows = await queryRows(sql, params);

  return enrichTableResult(
    createTableResult(networkColumns, rows, `${buildNetworkFilterLabel(filters)}_signature_guided_networks`)
  );
}

export async function getNetworkProfileTable(networkId: string): Promise<TableResult> {
  const activeNetworkId = LITE_NETWORK_ID;
  const rows = await queryRows(
    `
      SELECT
        gene_id AS \`Gene ID\`,
        meta3_all_P AS \`Meta3All-P\`,
        meta2_braak_P AS \`Meta2-BRAAK-P\`,
        meta2_cerad_P AS \`Meta2-CERAD-P\`,
        PSD95_P AS \`PSD95-P\`,
        Ab42_P AS \`Ab42-P\`,
        ptau181_P AS \`ptau181-P\`,
        ptau231_P AS \`ptau231-P\`,
        ptau181_ttau_P AS \`ptau181_ttau-P\`,
        ptau231_ttau_P AS \`ptau231_ttau-P\`,
        C4A_P AS \`C4A-P\`,
        C4B_P AS \`C4B-P\`,
        PPP2CB_P AS \`PPP2CB-P\`,
        PPP2CA_P AS \`PPP2CA-P\`
      FROM ${schema}.\`Jun_eQTL_Outcome_Combined\`
      WHERE ensgid IN (
        SELECT ensgid
        FROM ${schema}.\`presibo_Jaeyoon_ADNI_Brain_Network\`
        WHERE presibo_network_id = ?
      )
    `,
    [activeNetworkId]
  );

  return enrichTableResult(
    createTableResult(networkProfileColumns, rows, `${activeNetworkId}_signature_network_profile`)
  );
}

export async function getGeneProfilesNetworkTable(
  filters: {
    genes?: readonly string[];
    sources?: readonly string[];
    moduleIds?: readonly string[];
  }
): Promise<TableResult> {
  const { sql, params } = buildNetworkReferenceQuery(filters);
  const rows = await queryRows(sql, params);

  return enrichTableResult(
    createTableResult(networkColumns, rows, `${buildNetworkFilterLabel(filters)}_network_subgroups`)
  );
}

export async function getPrsAssociationsTable(
  networkId: string,
  pMax: number
): Promise<TableResult> {
  const activeNetworkId = LITE_NETWORK_ID;
  const rows = await queryRows(
    `
      SELECT
        presibo_network_id AS \`PreSiBO Network ID\`,
        prs_study AS \`PRS Study\`,
        network_subgroup AS \`Network Subgroup\`,
        network_study AS \`Network Study\`,
        network_data AS \`Network Data\`,
        outcome AS \`Outcome\`,
        beta AS \`BETA\`,
        se AS \`SE\`,
        p AS \`P\`
      FROM ${schema}.\`module_prs_associations\`
      WHERE presibo_network_id = ?
      AND p < ?
    `,
    [activeNetworkId, pMax]
  );

  return enrichTableResult(createTableResult(prsColumns, rows, `${activeNetworkId}_prs_associations`));
}

export async function getNetworkGuidedDrugNetworksTable(
  gene: string,
  source: string
): Promise<TableResult> {
  const brainOnlyFilter =
    source === "Brain-Brain Transcriptome"
      ? "AND omics_source = 'Bulk_RNA_seq' AND discovery_tissue = 'brain' AND validation_tissue = 'brain'"
      : "";
  const rows = await queryRows(
    `
      ${networkReferenceSelect}
      WHERE presibo_network_id IN (
        SELECT presibo_network_id
        FROM ${schema}.\`presibo_Jaeyoon_ADNI_Brain_Network\`
        WHERE gene_id = ?
      )
      ${brainOnlyFilter}
    `,
    [gene]
  );

  return enrichTableResult(
    createTableResult(networkColumns, rows, `${gene}_network_guided_drug_networks`)
  );
}

export async function getNetworkFilterOptions(filters: {
  genes?: readonly string[];
  sources?: readonly string[];
  moduleIds?: readonly string[];
  zMin?: number;
}): Promise<{
  genes: string[];
  moduleIds: string[];
  sources: string[];
}> {
  const geneFilters = {
    sources: filters.sources,
    moduleIds: filters.moduleIds,
    zMin: filters.zMin
  };
  const moduleFilters = {
    genes: filters.genes,
    sources: filters.sources,
    zMin: filters.zMin
  };
  const sourceFilters = {
    genes: filters.genes,
    moduleIds: filters.moduleIds,
    zMin: filters.zMin
  };
  const geneQuery = buildNetworkReferenceQuery(geneFilters);
  const moduleQuery = buildNetworkReferenceQuery(moduleFilters);
  const sourceQuery = buildNetworkReferenceQuery(sourceFilters);
  const [geneRows, moduleRows, sourceRows] = await Promise.all([
    queryRows(
      `
        SELECT DISTINCT members.gene_id
        FROM ${schema}.\`presibo_Jaeyoon_ADNI_Brain_Network\` AS members
        WHERE members.gene_id IS NOT NULL
          AND TRIM(members.gene_id) <> ''
          AND members.presibo_network_id IN (
            SELECT filtered.\`PreSiBO Network ID\`
            FROM (${geneQuery.sql}) AS filtered
          )
        ORDER BY members.gene_id
      `,
      geneQuery.params
    ),
    queryRows(
      `
        SELECT DISTINCT filtered.\`Module ID\` AS module_id
        FROM (${moduleQuery.sql}) AS filtered
        WHERE filtered.\`Module ID\` IS NOT NULL
          AND TRIM(filtered.\`Module ID\`) <> ''
        ORDER BY filtered.\`Module ID\`
      `,
      moduleQuery.params
    ),
    queryRows(
      `
        SELECT DISTINCT filtered.\`Omics Source\` AS omics_source
        FROM (${sourceQuery.sql}) AS filtered
        WHERE filtered.\`Omics Source\` IS NOT NULL
          AND TRIM(filtered.\`Omics Source\`) <> ''
        ORDER BY filtered.\`Omics Source\`
      `,
      sourceQuery.params
    )
  ]);

  return {
    genes: toDistinctTextArray(geneRows, "gene_id"),
    moduleIds: toDistinctTextArray(moduleRows, "module_id"),
    sources: toDistinctTextArray(sourceRows, "omics_source")
  };
}

export async function getAvailableDrugModuleIds(): Promise<string[]> {
  const rows = await queryRows(
    `
      SELECT DISTINCT module_id
      FROM ${schema}.\`network_reference_table\`
      WHERE ${buildLiteNetworkIdClause()}
        AND module_id IS NOT NULL
        AND TRIM(module_id) <> ''
      ORDER BY module_id
    `
  );

  return toDistinctTextArray(rows, "module_id");
}

export async function getModuleDrugsTable(
  moduleId: string,
  query: string
): Promise<TableResult> {
  const trimmedQuery = query.trim();
  const rows = await queryRows(
    `
      SELECT DISTINCT
        ref.module_id AS \`Module ID\`,
        drugs.pert_iname AS \`Drug Name\`,
        drugs.clinical_phase AS \`Clinical Test Phase\`,
        drugs.moa AS \`Mechanism of Action\`,
        drugs.disease_area AS \`Disease Area\`,
        drugs.indication AS \`Indication\`,
        drugs.ensgid AS \`ENSGID\`,
        drugs.gene_id AS \`Gene ID\`
      FROM ${schema}.\`AI4AD_Gene_GGDD_BIDRH_all_drugs\` AS drugs
      INNER JOIN ${schema}.\`presibo_Jaeyoon_ADNI_Brain_Network\` AS members
        ON members.ensgid = drugs.ensgid
      INNER JOIN ${schema}.\`network_reference_table\` AS ref
        ON ref.presibo_network_id = members.presibo_network_id
      WHERE ${buildLiteNetworkIdClause("ref.presibo_network_id")}
        AND ${buildLiteNetworkIdClause("members.presibo_network_id")}
        AND ref.module_id = ?
        AND drugs.clinical_phase = 'Launched'
        AND CONCAT_WS(
          ' ',
          COALESCE(ref.module_id, ''),
          COALESCE(drugs.pert_iname, ''),
          COALESCE(drugs.clinical_phase, ''),
          COALESCE(drugs.moa, ''),
          COALESCE(drugs.disease_area, ''),
          COALESCE(drugs.indication, ''),
          COALESCE(drugs.gene_id, ''),
          COALESCE(drugs.ensgid, '')
        ) LIKE ?
    `,
    [moduleId, `%${trimmedQuery}%`]
  );

  return enrichTableResult(
    createTableResult(
      [
        "Module ID",
        "Drug Name",
        "Clinical Test Phase",
        "Mechanism of Action",
        "Disease Area",
        "Indication",
        "ENSGID",
        "Gene ID"
      ],
      rows,
      `${moduleId}_module_drugs_${trimmedQuery || "all"}`
    )
  );
}

function buildNetworkReferenceQuery(filters: {
  genes?: readonly string[];
  sources?: readonly string[];
  moduleIds?: readonly string[];
  zMin?: number;
}) {
  const whereParts: string[] = [buildLiteNetworkIdClause()];
  const params: Array<string | number> = [];

  if (filters.genes && filters.genes.length > 0) {
    whereParts.push(
      `presibo_network_id IN (
        SELECT DISTINCT presibo_network_id
        FROM ${schema}.\`presibo_Jaeyoon_ADNI_Brain_Network\`
        WHERE gene_id IN (${filters.genes.map(() => "?").join(", ")})
      )`
    );
    params.push(...filters.genes);
  }

  if (filters.sources && filters.sources.length > 0) {
    whereParts.push(`omics_source IN (${filters.sources.map(() => "?").join(", ")})`);
    params.push(...filters.sources);
  }

  if (filters.moduleIds && filters.moduleIds.length > 0) {
    whereParts.push(`module_id IN (${filters.moduleIds.map(() => "?").join(", ")})`);
    params.push(...filters.moduleIds);
  }

  if (filters.zMin !== undefined) {
    whereParts.push(`zsummary >= ?`);
    params.push(filters.zMin);
  }

  return {
    sql: `
      ${networkReferenceSelect}
      ${whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : ""}
    `,
    params
  };
}

function buildNetworkFilterLabel(filters: {
  genes?: readonly string[];
  sources?: readonly string[];
  moduleIds?: readonly string[];
}) {
  return (
    [
      ...(filters.genes ?? []),
      ...(filters.sources ?? []),
      ...(filters.moduleIds ?? [])
    ].join("_") || "all"
  );
}

function toDistinctTextArray(
  rows: readonly Record<string, unknown>[],
  key: string
): string[] {
  return rows
    .map((row) => normalizeText(row[key]))
    .filter((value): value is string => Boolean(value));
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

export async function getNetworkGuidedDrugsTable(networkId: string): Promise<TableResult> {
  const activeNetworkId = LITE_NETWORK_ID;
  const rows = await queryRows(
    `
      SELECT
        pert_iname AS \`Drug Name\`,
        clinical_phase AS \`Clinical Phase\`,
        moa AS \`Mechanism of Action\`,
        disease_area AS \`Disease Area\`,
        indication AS \`Indication\`,
        ensgid AS \`ENSGID\`,
        gene_id AS \`Gene ID\`
      FROM ${schema}.\`AI4AD_Gene_GGDD_BIDRH_all_drugs\`
      WHERE ${buildLiteEnsgidColumnClause("ensgid")}
      AND clinical_phase = 'Launched'
    `,
    []
  );

  return enrichTableResult(createTableResult(drugColumns, rows, `${activeNetworkId}_launched_drugs`));
}

export async function getDiseaseAreaBreakdown(networkId: string): Promise<DonutSlice[]> {
  const table = await getNetworkGuidedDrugsTable(networkId);
  const counts = new Map<string, number>();

  for (const row of table.rows) {
    const label = String(row["Disease Area"] ?? "Unknown").trim() || "Unknown";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value);
}
