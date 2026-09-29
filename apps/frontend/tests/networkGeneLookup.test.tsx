import { describe, expect, it } from "vitest";

import {
  getFirstMatchingModuleId,
  getGeneModuleRows,
  sortModuleIds
} from "../src/features/network/networkGeneModuleRows";

describe("network gene module rows", () => {
  it("keeps distinct module methods and removes duplicate rows", () => {
    expect(
      getGeneModuleRows([
        { "PreSiBO Network ID": "PN6", "Module ID": "M6", "Omics Source": "Bulk RNA-seq", "Discovery Study": "ADNI" },
        { "PreSiBO Network ID": "PN6", "Module ID": "M6", "Omics Source": "Bulk RNA-seq", "Discovery Study": "ADNI" },
        { "PreSiBO Network ID": "PN8", "Module ID": "M8", "Omics Source": "Proteomics", "Discovery Study": "ROSMAP" }
      ])
    ).toEqual([
      { networkId: "PN6", moduleId: "M6", source: "Bulk RNA-seq", study: "ADNI" },
      { networkId: "PN8", moduleId: "M8", source: "Proteomics", study: "ROSMAP" }
    ]);
  });

  it("uses natural module order and chooses the first module containing a gene", () => {
    const moduleIds = ["M50", "M30", "M2", "M9", "M45", "M6"];
    const matches = getGeneModuleRows([
      { "PreSiBO Network ID": "PN45", "Module ID": "M45" },
      { "PreSiBO Network ID": "PN6", "Module ID": "M6" }
    ]);

    expect(sortModuleIds(moduleIds)).toEqual(["M2", "M6", "M9", "M30", "M45", "M50"]);
    expect(getFirstMatchingModuleId(moduleIds, matches)).toBe("M6");
    expect(getFirstMatchingModuleId(moduleIds, [])).toBeNull();
  });
});
