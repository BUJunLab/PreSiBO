import { databaseName, queryRows } from "../lib/db.js";
import type { TableResult } from "../types.js";
import { createTableResult } from "../utils/http.js";
import { enrichTableResult } from "../utils/tableEnrichment.js";

const schema = `\`${databaseName}\``;

const drugSearchColumns = [
  "PreSiBO Drug ID",
  "Drug Name",
  "Clinical Test Phase",
  "Mechanism of Action",
  "Disease Area",
  "Indication",
  "Gene Target"
];

export async function searchDrugs(query: string): Promise<TableResult> {
  const rows = await queryRows(
    `
      SELECT
        presibo_drug_id AS \`PreSiBO Drug ID\`,
        pert_iname AS \`Drug Name\`,
        clinical_phase AS \`Clinical Test Phase\`,
        moa AS \`Mechanism of Action\`,
        disease_area AS \`Disease Area\`,
        indication AS \`Indication\`,
        gene_id AS \`Gene Target\`
      FROM ${schema}.\`AI4AD_Gene_GGDD_BIDRH_all_drugs\`
      WHERE CONCAT(
        presibo_drug_id,
        COALESCE(pert_iname, ''),
        COALESCE(clinical_phase, ''),
        COALESCE(moa, ''),
        COALESCE(disease_area, ''),
        COALESCE(indication, ''),
        COALESCE(gene_id, '')
      ) LIKE ?
    `,
    [`%${query.trim()}%`]
  );

  return enrichTableResult(
    createTableResult(drugSearchColumns, rows, `drug_search_${query.trim() || "all"}`)
  );
}
