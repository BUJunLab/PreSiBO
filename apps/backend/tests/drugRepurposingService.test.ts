import { describe, expect, it } from "vitest";

import {
  buildDrugRepurposingTable,
  type DrugRepurposingRawRow
} from "../src/services/drugRepurposingService.js";

const rawRow: DrugRepurposingRawRow = {
  compound_cid: 119,
  compound_name: "Gamma-Aminobutyric Acid",
  latest_clinical_trial_phase: "4",
  blood_brain_barrier_permeability: null,
  prioritized_targets_text: "GABBR1|GABRG1|SLC6A11",
  mechanism_of_action_text: "GABA Agents",
  disease_area_text: null,
  disease_indication_text: null,
  clinical_trials_json:
    "[{\"phase\":2,\"condition\":\"Chronic Pain\",\"nct_id\":\"NCT04683640\"}]",
  bioassays_json:
    "[{\"BioAssay_AID\":\"1184359\",\"dois\":\"10.1016/j.ejmech.2014.07.039\",\"pmcids\":\"PMC5662925\",\"pclids\":\"ignore-me\",\"PMID\":\"25038482\",\"Aid_Type\":\"Confirmatory\",\"Bioassay_Data_Source\":\"ChEMBL\"}]",
  activity_text: "GABBR1 (EC50=0.53)|GABRG1 (IC50=0.018)",
  trial_count: 1,
  bioassay_count: 1,
  target_count: 3
};

describe("buildDrugRepurposingTable", () => {
  it("formats repurposing rows into readable rich cells", () => {
    const table = buildDrugRepurposingTable([rawRow], "");

    expect(table.columns).toEqual([
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
    ]);
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]?.["Compound CID"]).toMatchObject({
      kind: "rich",
      lines: [{ text: "119", href: "https://pubchem.ncbi.nlm.nih.gov/compound/119" }],
      exportText: "119"
    });
    expect(table.rows[0]?.["Prioritized Targets"]).toMatchObject({
      kind: "rich",
      lines: [{ text: "GABBR1" }, { text: "GABRG1" }, { text: "SLC6A11" }],
      exportText: "GABBR1\nGABRG1\nSLC6A11"
    });
    expect(table.rows[0]?.["Clinical Trials"]).toMatchObject({
      kind: "rich",
      lines: [
        {
          text: "Chronic Pain (Phase 2)",
          actions: [
            {
              label: "ClinicalTrials.gov",
              href: "https://clinicaltrials.gov/study/NCT04683640"
            }
          ]
        }
      ],
      exportText: "Chronic Pain (Phase 2)"
    });
    expect(table.rows[0]?.["Bioassays"]).toMatchObject({
      kind: "rich",
      lines: [
        {
          text: "1184359 (ChEMBL): Confirmatory",
          actions: [
            { label: "PubChem", href: "https://pubchem.ncbi.nlm.nih.gov/bioassay/1184359" },
            { label: "DOI", href: "https://doi.org/10.1016/j.ejmech.2014.07.039" },
            { label: "PMC", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5662925/" },
            { label: "PubMed", href: "https://pubmed.ncbi.nlm.nih.gov/25038482/" }
          ]
        }
      ]
    });
  });

  it("drops malformed JSON to an empty rich cell instead of throwing", () => {
    const table = buildDrugRepurposingTable(
      [{ ...rawRow, clinical_trials_json: "{broken json" }],
      ""
    );

    expect(table.rows[0]?.["Clinical Trials"]).toMatchObject({
      kind: "rich",
      lines: [],
      exportText: ""
    });
  });

  it("fans out multi-value bioassay references into separate actions", () => {
    const table = buildDrugRepurposingTable(
      [
        {
          ...rawRow,
          bioassays_json:
            "[{\"BioAssay_AID\":\"1184359\",\"dois\":\"10.1000/alpha| 10.1000/beta |\",\"pmcids\":\"PMC111| |PMC222\",\"PMID\":\"12345|67890\",\"Aid_Type\":\"Confirmatory\",\"Bioassay_Data_Source\":\"ChEMBL\"}]"
        }
      ],
      ""
    );

    expect(table.rows[0]?.["Bioassays"]).toMatchObject({
      kind: "rich",
      lines: [
        {
          text: "1184359 (ChEMBL): Confirmatory",
          actions: [
            { label: "PubChem", href: "https://pubchem.ncbi.nlm.nih.gov/bioassay/1184359" },
            { label: "DOI", href: "https://doi.org/10.1000/alpha" },
            { label: "DOI", href: "https://doi.org/10.1000/beta" },
            { label: "PMC", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC111/" },
            { label: "PMC", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC222/" },
            { label: "PubMed", href: "https://pubmed.ncbi.nlm.nih.gov/12345/" },
            { label: "PubMed", href: "https://pubmed.ncbi.nlm.nih.gov/67890/" }
          ]
        }
      ]
    });
  });

  it("drops malformed bioassay JSON to an empty rich cell instead of throwing", () => {
    const table = buildDrugRepurposingTable(
      [{ ...rawRow, bioassays_json: "{broken json" }],
      ""
    );

    expect(table.rows[0]?.["Bioassays"]).toMatchObject({
      kind: "rich",
      lines: [],
      exportText: ""
    });
  });
});
