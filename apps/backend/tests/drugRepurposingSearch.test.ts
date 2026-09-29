import { beforeEach, describe, expect, it, vi } from "vitest";

const rawRow = {
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
    "[{\"BioAssay_AID\":\"1184359\",\"dois\":\"10.1016/j.ejmech.2014.07.039\",\"pmcids\":\"PMC5662925\",\"PMID\":\"25038482\",\"Aid_Type\":\"Confirmatory\",\"Bioassay_Data_Source\":\"ChEMBL\"}]",
  activity_text: "GABBR1 (EC50=0.53)|GABRG1 (IC50=0.018)",
  trial_count: 1,
  bioassay_count: 1,
  target_count: 3
};

const { queryRows } = vi.hoisted(() => ({
  queryRows: vi.fn()
}));

vi.mock("../src/lib/db.js", () => ({
  databaseName: "presibo1",
  queryRows
}));

const { searchDrugRepurposing } = await import("../src/services/drugRepurposingService.js");

describe("searchDrugRepurposing", () => {
  beforeEach(() => {
    queryRows.mockReset();
    queryRows
      .mockResolvedValue([])
      .mockResolvedValueOnce([rawRow])
      .mockResolvedValueOnce([
        { gene_id: "GABBR1" },
        { gene_id: "GABRG1" },
        { gene_id: "SLC6A11" }
      ]);
  });

  it("uses the BIDRH-style LIKE search over readable concatenated content", async () => {
    const table = await searchDrugRepurposing("Phase 2");

    expect(table.filename).toBe("drug_repurposing_Phase 2");
    expect(queryRows).toHaveBeenCalledTimes(3);

    const [sql, params] = queryRows.mock.calls[0] ?? [];
    expect(sql).toContain("FROM `presibo1`.`presibo_lite_delivery_cache` AS delivery");
    expect(sql).toContain("WHERE");
    expect(sql).toContain("LIKE ?");
    expect(sql).toContain("REPLACE(COALESCE(delivery.prioritized_targets_text, ''), '|', ' ')");
    expect(sql).toContain("CAST(COALESCE(delivery.clinical_trials_json, '') AS CHAR)");
    expect(sql).toContain("CAST(COALESCE(delivery.bioassays_json, '') AS CHAR)");
    expect(sql).not.toContain("JSON_TABLE");
    expect(params).toEqual(["%Phase 2%"]);
  });
});
