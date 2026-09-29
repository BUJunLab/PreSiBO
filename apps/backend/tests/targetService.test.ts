import { beforeEach, describe, expect, it, vi } from "vitest";

const basePredictorRow = {
  "Variant ID": "1:100:A:T",
  "SNP ID": "rs1",
  "Allele 1": "A",
  "Allele 2": "T",
  BETA: 0.1,
  SE: 0.01,
  P: 0.05,
  Gene: "NR2E1",
  "Gene Left": null,
  "Gene Right": null,
  "Distance Left (bps)": null,
  "Distance Right (bps)": null
};

const { queryRows } = vi.hoisted(() => ({
  queryRows: vi.fn()
}));

vi.mock("../src/lib/db.js", () => ({
  databaseName: "presibo1",
  queryRows
}));

const { getDifferentialExpressionTable, getPredictorTable } = await import("../src/services/targetService.js");

describe("getPredictorTable", () => {
  beforeEach(() => {
    queryRows.mockReset();
  });

  it("drops Frequency1 when every predictor row is zero or missing", async () => {
    queryRows
      .mockResolvedValueOnce([
        { ...basePredictorRow, Frequency1: 0 },
        { ...basePredictorRow, "Variant ID": "1:200:A:T", Frequency1: null }
      ])
      .mockResolvedValueOnce([]);

    const table = await getPredictorTable(["NR2E1"], ["Outcome-Clinical Diagnosis"], 1);
    const predictorSql = String(queryRows.mock.calls[0]?.[0] ?? "");

    expect(predictorSql).not.toContain("presibo_Jaeyoon_ADNI_Brain_Network");
    expect(table.columns).not.toContain("Frequency1");
    expect(table.rows[0]).not.toHaveProperty("Frequency1");
  });

  it("keeps Frequency1 when any predictor row has a nonzero value", async () => {
    queryRows
      .mockResolvedValueOnce([
        { ...basePredictorRow, Frequency1: 0 },
        { ...basePredictorRow, "Variant ID": "1:200:A:T", Frequency1: 0.25 }
      ])
      .mockResolvedValueOnce([]);

    const table = await getPredictorTable(["NR2E1"], ["Outcome-Clinical Diagnosis"], 1);

    expect(table.columns).toContain("Frequency1");
    expect(table.rows[1]?.Frequency1).toBe(0.25);
  });

  it("offers one Signature destination from gene-cell menus", async () => {
    queryRows.mockResolvedValueOnce([{ ...basePredictorRow, Frequency1: 0.25 }]).mockResolvedValueOnce([]);

    const table = await getPredictorTable(["NR2E1"], ["Outcome-Clinical Diagnosis"], 1);
    const geneCell = table.rows[0]?.Gene as {
      lines?: Array<{ actions?: Array<{ label: string; navigation?: unknown }> }>;
    };
    const signatureActions =
      geneCell.lines?.[0]?.actions?.filter((action) => action.label.includes("Target/Signature")) ?? [];

    expect(signatureActions).toEqual([
      {
        label: "Search in Target/Signature/Gene",
        kind: "navigate",
        navigation: { page: "target", tab: "Signature", gene: "NR2E1" }
      }
    ]);
  });

  it("does not limit typed signature genes to the lite network gene set", async () => {
    queryRows.mockResolvedValueOnce([]);

    await getDifferentialExpressionTable(["NR2E1"]);

    const signatureSql = String(queryRows.mock.calls[0]?.[0] ?? "");
    expect(signatureSql).not.toContain("presibo_Jaeyoon_ADNI_Brain_Network");
    expect(queryRows.mock.calls[0]?.[1]).toEqual(["NR2E1", "NR2E1", "NR2E1", "NR2E1"]);
  });
});
