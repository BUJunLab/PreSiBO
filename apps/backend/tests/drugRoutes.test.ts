import request from "supertest";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/services/drugRepurposingService.js", () => ({
  searchDrugRepurposing: vi.fn(async () => ({
    columns: ["Compound CID", "Clinical Trials"],
    filename: "drug_repurposing_all",
    rows: [
      {
        "Compound CID": {
          kind: "rich",
          lines: [{ text: "119", href: "https://pubchem.ncbi.nlm.nih.gov/compound/119" }],
          exportText: "119"
        },
        "Clinical Trials": {
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
        }
      }
    ]
  }))
}));

import { buildApp } from "../src/app.js";

describe("drug repurposing route", () => {
  it("serves readable JSON and csv for repurposing rows", async () => {
    const app = buildApp();

    const jsonResponse = await request(app).get("/api/drugs/repurposing?query=gaba");
    expect(jsonResponse.status).toBe(200);
    expect(jsonResponse.body.columns).toEqual(["Compound CID", "Clinical Trials"]);

    const csvResponse = await request(app).get("/api/drugs/repurposing?query=gaba&format=csv");
    expect(csvResponse.status).toBe(200);
    expect(csvResponse.text).toContain("Compound CID,Clinical Trials");
    expect(csvResponse.text).toContain("119");
    expect(csvResponse.text).toContain("Chronic Pain (Phase 2)");
    expect(csvResponse.text).not.toContain("clinical_trials_json");
    expect(csvResponse.text).not.toContain("[object Object]");
  });
});
