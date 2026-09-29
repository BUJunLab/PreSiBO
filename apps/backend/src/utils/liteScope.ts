import { databaseName } from "../lib/db.js";
import { loadAppConfig } from "../config/env.js";

const schema = `\`${databaseName}\``;

export const LITE_NETWORK_ID = "PN000084";

export const isLiteDataScope = loadAppConfig().dataScope === "lite";

export function buildLiteNetworkIdClause(column = "presibo_network_id") {
  return `${column} = '${LITE_NETWORK_ID}'`;
}

export function buildLiteGeneSubquery() {
  return `
    SELECT DISTINCT gene_id
    FROM ${schema}.\`presibo_Jaeyoon_ADNI_Brain_Network\`
    WHERE ${buildLiteNetworkIdClause()}
      AND gene_id IS NOT NULL
      AND TRIM(gene_id) <> ''
  `;
}

export function buildLiteEnsgidSubquery() {
  return `
    SELECT DISTINCT ensgid
    FROM ${schema}.\`presibo_Jaeyoon_ADNI_Brain_Network\`
    WHERE ${buildLiteNetworkIdClause()}
      AND ensgid IS NOT NULL
      AND TRIM(ensgid) <> ''
  `;
}

export function buildLiteGeneColumnClause(column: string) {
  return `${column} IN (${buildLiteGeneSubquery()})`;
}

export function buildLiteEnsgidColumnClause(column: string) {
  return `${column} IN (${buildLiteEnsgidSubquery()})`;
}

export function buildLiteGeneMatchClause(alias: string) {
  const geneSubquery = buildLiteGeneSubquery();
  return `(
    ${alias}.gene_id IN (${geneSubquery})
    OR ${alias}.geneid_left IN (${geneSubquery})
    OR ${alias}.geneid_right IN (${geneSubquery})
  )`;
}

export function buildLitePipeDelimitedGeneClause(column: string) {
  return `EXISTS (
    SELECT 1
    FROM (${buildLiteGeneSubquery()}) AS lite_genes
    WHERE CONCAT('|', COALESCE(${column}, ''), '|') LIKE CONCAT('%|', lite_genes.gene_id, '|%')
  )`;
}

export function buildTargetGeneSubquery() {
  return isLiteDataScope ? buildLiteGeneSubquery() : buildFullGeneSubquery();
}

export function buildTargetGeneColumnClause(column: string) {
  return `${column} IN (${buildTargetGeneSubquery()})`;
}

export function buildTargetGeneMatchClause(alias: string) {
  const geneSubquery = buildTargetGeneSubquery();
  return `(
    ${alias}.gene_id IN (${geneSubquery})
    OR ${alias}.geneid_left IN (${geneSubquery})
    OR ${alias}.geneid_right IN (${geneSubquery})
  )`;
}

function buildFullGeneSubquery() {
  return `
    SELECT DISTINCT gene_id
    FROM ${schema}.\`presibo_Jaeyoon_ADNI_Brain_Network\`
    WHERE gene_id IS NOT NULL
      AND TRIM(gene_id) <> ''
  `;
}
