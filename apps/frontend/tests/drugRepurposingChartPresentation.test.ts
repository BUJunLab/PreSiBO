import { describe, expect, it } from "vitest";

import {
  buildDonutPresentation,
  formatChartPercent
} from "../src/features/drug/drugRepurposingChartPresentation";

describe("drug repurposing chart presentation", () => {
  it("formats percentages with significant digits and scientific notation for tiny values", () => {
    expect(formatChartPercent(0.02896)).toBe("2.9%");
    expect(formatChartPercent(0.12345)).toBe("12.3%");
    expect(formatChartPercent(0.00002896)).toBe("2.90e-3%");
  });

  it("puts each donut value and percentage beside its outside label", () => {
    const presentation = buildDonutPresentation({
      slices: [
        { label: "Neurology/Psychiatry", value: 2 },
        { label: "Ophthalmology", value: 1 }
      ],
      emptyMessage: "No values"
    });

    expect(presentation.entries[0]?.plotText).toContain(
      "Neurology/Psychiatry (2 | 66.7%)"
    );
    expect(presentation.entries[1]?.plotText).toContain("Ophthalmology (1 | 33.3%)");
  });
});
