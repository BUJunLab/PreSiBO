import { databaseName, queryRows } from "../lib/db.js";
import type { TableCell, TableResult } from "../types.js";
import { createTableResult } from "../utils/http.js";
import {
  buildTargetGeneColumnClause,
  buildTargetGeneMatchClause,
  buildTargetGeneSubquery
} from "../utils/liteScope.js";
import { enrichTableResult } from "../utils/tableEnrichment.js";

const schema = `\`${databaseName}\``;

const predictorSourceTables = {
  "Outcome-Clinical Diagnosis": "Kunkle_IGAP_GWAS_Variant_Clinical_Dx_ALL_Stage2",
  "Outcome-Tangle (BRAAK)": "Beecham_ADGC_GWAS_Variant_Neuropath_BRAAK_ALL",
  "Outcome-Plaque (CERAD)": "Beecham_ADGC_GWAS_Variant_Neuropath_CERAD_ALL",
  "Biomarker-CSF.Abeta": "Deming_Public_GWAS_Variant_CSF_Ab42_ALL",
  "Biomarker-CSF.pTau": "Deming_Public_GWAS_Variant_CSF_pTau_ALL",
  "Biomarker-CSF.tTau": "Deming_Public_GWAS_Variant_CSF_tTau_ALL"
} as const;

export type PredictorSelection = keyof typeof predictorSourceTables;

const predictorColumns = [
  "Variant ID",
  "SNP ID",
  "Allele 1",
  "Allele 2",
  "Frequency1",
  "BETA",
  "SE",
  "P",
  "Gene",
  "Gene Left",
  "Gene Right",
  "Distance Left (bps)",
  "Distance Right (bps)"
];

const diffExpressionColumns = [
  "Gene ID",
  "Source",
  "Subgroup",
  "Zscore or logFC",
  "P-Value"
];

const quantitativeTraitColumns = [
  "Gene ID",
  "Source",
  "Subgroup",
  "Outcome",
  "Beta",
  "SE",
  "P-Value"
];

function predictorTableName(selection: PredictorSelection): string {
  return predictorSourceTables[selection];
}

export async function getPredictorTable(
  genes: readonly string[],
  selections: readonly PredictorSelection[],
  pMax: number
): Promise<TableResult> {
  const activeSelections = selections.length > 0 ? selections : [...Object.keys(predictorSourceTables)] as PredictorSelection[];
  const geneFilter = buildSelectedGeneMatchClause(genes, "source_gene");
  const referenceWhereParts = geneFilter.sql
    ? [geneFilter.sql]
    : [buildTargetGeneMatchClause("source_gene")];
  const referenceWhere = `WHERE ${referenceWhereParts.join(" AND ")}`;
  const unionSql = activeSelections
    .map(
      (selection) => `
        SELECT
          t1.variant_id AS \`Variant ID\`,
          t1.snp_id AS \`SNP ID\`,
          t1.a1 AS \`Allele 1\`,
          t1.a2 AS \`Allele 2\`,
          ROUND(t1.freq1, 3) AS \`Frequency1\`,
          ROUND(t1.beta, 3) AS \`BETA\`,
          ROUND(t1.se, 3) AS \`SE\`,
          t1.p AS \`P\`,
          t2.gene_id AS \`Gene\`,
          t2.geneid_left AS \`Gene Left\`,
          t2.geneid_right AS \`Gene Right\`,
          t2.dist_left AS \`Distance Left (bps)\`,
          t2.dist_right AS \`Distance Right (bps)\`
        FROM ${schema}.\`${predictorTableName(selection)}\` t1
        INNER JOIN (
          SELECT *
          FROM ${schema}.\`extended_gwas_variant_reference_table\` AS source_gene
          ${referenceWhere}
        ) t2
          USING (variant_id)
        WHERE t1.p <= ?
      `
    )
    .join("\nUNION ALL\n");
  const rows = await queryRows(
    unionSql,
    activeSelections.flatMap(() => [...geneFilter.params, pMax])
  );

  return enrichTableResult(
    omitEmptyFrequencyColumn(
      createTableResult(
        predictorColumns,
        rows,
        `${(genes.join("_") || "all")}_predictor_${activeSelections.join("_").toLowerCase().replaceAll(/[^a-z0-9]+/gi, "_")}`
      )
    )
  );
}

function omitEmptyFrequencyColumn(table: TableResult): TableResult {
  if (!table.columns.includes("Frequency1") || hasNonZeroFrequencyValue(table.rows)) {
    return table;
  }

  return {
    ...table,
    columns: table.columns.filter((column) => column !== "Frequency1"),
    rows: table.rows.map((row) => {
      const { Frequency1: _frequency1, ...rest } = row;
      return rest;
    })
  };
}

function hasNonZeroFrequencyValue(rows: TableResult["rows"]): boolean {
  return rows.some((row) => isNonZeroValue(row.Frequency1));
}

function isNonZeroValue(value: TableCell | undefined): boolean {
  if (value === null || value === undefined || typeof value === "boolean") {
    return false;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) && value !== 0;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim();
    if (!normalizedValue || /^(na|n\/a|null|undefined)$/i.test(normalizedValue)) {
      return false;
    }

    const numericValue = Number(normalizedValue);
    return Number.isFinite(numericValue) ? numericValue !== 0 : true;
  }

  return true;
}

export async function getDifferentialExpressionTable(
  genes: readonly string[],
  pMax?: number
): Promise<TableResult> {
  const filterSql = pMax === undefined ? "" : "WHERE `P-Value` < ?";
  const geneWhere = buildGeneScopeClause(genes, "gene_id");
  const rows = await queryRows(
    `
      SELECT *
      FROM (
        SELECT gene_id AS \`Gene ID\`, 'brain tissue' AS \`Source\`, 'e23-meta3' AS \`Subgroup\`,
          meta3_e23_Zscore AS \`Zscore or logFC\`, meta3_e23_P AS \`P-Value\`
        FROM ${schema}.\`Jun_eQTL_Outcome_Combined\`
        ${geneWhere.sql}
        UNION
        SELECT gene_id, 'brain tissue', 'e33-meta3',
          meta3_e33_Zscore, meta3_e33_P
        FROM ${schema}.\`Jun_eQTL_Outcome_Combined\`
        ${geneWhere.sql}
        UNION
        SELECT gene_id, 'brain tissue', 'e34-meta3',
          meta3_e34_Zscore, meta3_e34_P
        FROM ${schema}.\`Jun_eQTL_Outcome_Combined\`
        ${geneWhere.sql}
        UNION
        SELECT gene_id, 'brain tissue', 'all-meta3',
          meta3_all_Zscore, meta3_all_P
        FROM ${schema}.\`Jun_eQTL_Outcome_Combined\`
        ${geneWhere.sql}
      ) diff_expr_master_view
      ${filterSql}
    `,
    pMax === undefined
      ? [...geneWhere.params, ...geneWhere.params, ...geneWhere.params, ...geneWhere.params]
      : [
          ...geneWhere.params,
          ...geneWhere.params,
          ...geneWhere.params,
          ...geneWhere.params,
          pMax
        ]
  );

  return enrichTableResult(
    createTableResult(
      diffExpressionColumns,
      rows,
      `${genes.join("_") || "all"}_signature_differential_expression`
    )
  );
}

export async function getQuantitativeTraitLociTable(
  genes: readonly string[],
  pMax?: number
): Promise<TableResult> {
  const filterSql = pMax === undefined ? "" : "WHERE `P-Value` < ?";
  const geneWhere = buildGeneScopeClause(genes, "gene_id");
  const rows = await queryRows(
    `
      SELECT *
      FROM (
        SELECT gene_id AS \`Gene ID\`, 'brain tissue' AS \`Source\`, 'all' AS \`Subgroup\`,
          'BRAAK' AS \`Outcome\`, meta2_braak_BETA AS \`Beta\`, meta2_braak_SE AS \`SE\`, meta2_braak_P AS \`P-Value\`
        FROM ${schema}.\`Jun_eQTL_Outcome_Combined\`
        ${geneWhere.sql}
        UNION
        SELECT gene_id, 'brain tissue', 'all', 'CERAD', meta2_cerad_BETA, meta2_cerad_SE, meta2_cerad_P
        FROM ${schema}.\`Jun_eQTL_Outcome_Combined\`
        ${geneWhere.sql}
        UNION
        SELECT gene_id, 'brain tissue', 'all', 'PSD95', PSD95_BETA, PSD95_SE, PSD95_P
        FROM ${schema}.\`Jun_eQTL_Outcome_Combined\`
        ${geneWhere.sql}
        UNION
        SELECT gene_id, 'brain tissue', 'all', 'Ab42', Ab42_BETA, Ab42_SE, Ab42_P
        FROM ${schema}.\`Jun_eQTL_Outcome_Combined\`
        ${geneWhere.sql}
        UNION
        SELECT gene_id, 'brain tissue', 'all', 'ptau181', ptau181_BETA, ptau181_SE, ptau181_P
        FROM ${schema}.\`Jun_eQTL_Outcome_Combined\`
        ${geneWhere.sql}
        UNION
        SELECT gene_id, 'brain tissue', 'all', 'ptau231', ptau231_BETA, ptau231_SE, ptau231_P
        FROM ${schema}.\`Jun_eQTL_Outcome_Combined\`
        ${geneWhere.sql}
        UNION
        SELECT gene_id, 'brain tissue', 'all', 'ptau181_ttau', ptau181_ttau_BETA, ptau181_ttau_SE, ptau181_ttau_P
        FROM ${schema}.\`Jun_eQTL_Outcome_Combined\`
        ${geneWhere.sql}
        UNION
        SELECT gene_id, 'brain tissue', 'all', 'ptau231_ttau', ptau231_ttau_BETA, ptau231_ttau_SE, ptau231_ttau_P
        FROM ${schema}.\`Jun_eQTL_Outcome_Combined\`
        ${geneWhere.sql}
        UNION
        SELECT gene_id, 'brain tissue', 'all', 'C4A', C4A_BETA, C4A_SE, C4A_P
        FROM ${schema}.\`Jun_eQTL_Outcome_Combined\`
        ${geneWhere.sql}
        UNION
        SELECT gene_id, 'brain tissue', 'all', 'C4B', C4B_BETA, C4B_SE, C4B_P
        FROM ${schema}.\`Jun_eQTL_Outcome_Combined\`
        ${geneWhere.sql}
        UNION
        SELECT gene_id, 'brain tissue', 'all', 'PPP2CB', PPP2CB_BETA, PPP2CB_SE, PPP2CB_P
        FROM ${schema}.\`Jun_eQTL_Outcome_Combined\`
        ${geneWhere.sql}
        UNION
        SELECT gene_id, 'brain tissue', 'all', 'PPP2CA', PPP2CA_BETA, PPP2CA_SE, PPP2CA_P
        FROM ${schema}.\`Jun_eQTL_Outcome_Combined\`
        ${geneWhere.sql}
      ) signature_master_view
      ${filterSql}
    `,
    pMax === undefined
      ? repeatParams(geneWhere.params, 12)
      : [...repeatParams(geneWhere.params, 12), pMax]
  );

  return enrichTableResult(
    createTableResult(
      quantitativeTraitColumns,
      rows,
      `${genes.join("_") || "all"}_signature_quantitative_trait_loci`
    )
  );
}

export async function getTargetGeneOptions(
  selections: readonly PredictorSelection[] = []
): Promise<string[]> {
  const rows = await queryRows(
    `
      SELECT gene_id AS gene_value
      FROM (${buildTargetGeneSubquery()}) AS genes
      ORDER BY gene_id
    `
  );

  return rows
    .map((row) => normalizeText(row.gene_value))
    .filter((geneId): geneId is string => Boolean(geneId));
}

function buildGeneScopeClause(values: readonly string[], column: string) {
  if (values.length > 0) {
    return {
      sql: `WHERE ${column} IN (${values.map(() => "?").join(", ")})`,
      params: [...values]
    };
  }

  return {
    sql: `WHERE ${buildTargetGeneColumnClause(column)}`,
    params: [] as string[]
  };
}

function buildSelectedGeneMatchClause(values: readonly string[], alias: string) {
  if (values.length === 0) {
    return { sql: "", params: [] as string[] };
  }

  const placeholders = values.map(() => "?").join(", ");
  return {
    sql: `(${alias}.gene_id IN (${placeholders}) OR ${alias}.geneid_left IN (${placeholders}) OR ${alias}.geneid_right IN (${placeholders}))`,
    params: [...values, ...values, ...values]
  };
}

function repeatParams(values: readonly string[], count: number) {
  return Array.from({ length: count }, () => [...values]).flat();
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}
