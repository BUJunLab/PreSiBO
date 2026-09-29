import { describe, expect, it } from "vitest";

import {
  buildActivityTypeFigure,
  buildClinicalTrialSunburst,
  buildDiseaseAreaFigure,
  buildScopedFieldFigure,
  parseRepurposingRows
} from "../src/features/drug/drugRepurposingInsights";

describe("drug repurposing clinical-trial sunburst", () => {
  it("extracts inner-ring phases and outer-ring conditions from trial text", () => {
    const rows = parseRepurposingRows([
      {
        "Compound CID": {
          kind: "rich",
          lines: [{ text: "119" }],
          exportText: "119"
        },
        "Compound Name": {
          kind: "rich",
          lines: [{ text: "Gamma-Aminobutyric Acid" }],
          exportText: "Gamma-Aminobutyric Acid"
        },
        "Latest Clinical Trial Phase": "4",
        "Blood-Brain Barrier Permeability": null,
        "Prioritized Targets": "GABBR1",
        "Mechanism of Action": null,
        "Disease Area": "neuropsychiatry",
        "Disease Indication": null,
        "Clinical Trials": {
          kind: "rich",
          lines: [
            { text: "Schizophrenia (Phase 2)" },
            { text: "Schizophrenia (Phase 3)" },
            { text: "Psychosis (Phase 4)" }
          ],
          exportText: "Schizophrenia (Phase 2)\nSchizophrenia (Phase 3)\nPsychosis (Phase 4)"
        },
        "Bioassays": null,
        "Activity": null,
        "Trial Count": 3,
        "Bioassay Count": 0,
        "Target Count": 1
      }
    ]);

    const figure = buildClinicalTrialSunburst(rows, "prioritized-target", "GABBR1");

    expect(figure.nodes.filter((node) => node.parent === "").map((node) => node.label)).toEqual(
      ["Phase 2", "Phase 3", "Phase 4"]
    );
    expect(
      figure.nodes
        .filter((node) => node.parent !== "")
        .map((node) => ({ label: node.label, parent: node.parent }))
    ).toEqual([
      { label: "Schizophrenia", parent: "Phase 2" },
      { label: "Schizophrenia", parent: "Phase 3" },
      { label: "Psychosis", parent: "Phase 4" }
    ]);
  });
});

describe("drug repurposing donut counts", () => {
  it("counts each distinct label once per cell without fractional shares", () => {
    const rows = parseRepurposingRows([
      {
        "Compound CID": "1",
        "Compound Name": "Compound A",
        "Prioritized Targets": "GENE1",
        "Disease Area": "Neurology/Psychiatry|Neurology/Psychiatry|Ophthalmology",
        "Mechanism of Action": "Agonist|Agonist|Antagonist"
      },
      {
        "Compound CID": "2",
        "Compound Name": "Compound B",
        "Disease Area": "neurology/psychiatry"
      }
    ]);

    const diseaseArea = buildDiseaseAreaFigure(rows);
    expect(diseaseArea.slices.map(({ label, value }) => ({ label, value }))).toEqual([
      { label: "Neurology/Psychiatry", value: 2 },
      { label: "Ophthalmology", value: 1 }
    ]);

    const mechanisms = buildScopedFieldFigure(
      rows,
      "prioritized-target",
      "GENE1",
      "mechanisms"
    );
    expect(mechanisms.slices.map(({ label, value }) => ({ label, value }))).toEqual([
      { label: "Agonist", value: 1 },
      { label: "Antagonist", value: 1 }
    ]);
  });

  it("counts each distinct activity type as one in compound mode", () => {
    const rows = parseRepurposingRows([
      {
        "Compound CID": "1",
        "Compound Name": "Compound A",
        "Prioritized Targets": "GENE1",
        Activity: "GENE1 (IC50 1 nM)|GENE1 (EC50 2 nM)"
      }
    ]);

    const figure = buildActivityTypeFigure(rows, "GENE1", "compound");
    expect(figure.slices.map(({ label, value }) => ({ label, value }))).toEqual([
      { label: "EC50", value: 1 },
      { label: "IC50", value: 1 }
    ]);
  });
});
