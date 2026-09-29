import { describe, expect, it } from "vitest";

import { normalizeMultiSelectValues } from "../src/components/common/MultiSelectFilter";

describe("normalizeMultiSelectValues", () => {
  it("keeps only real values without synthetic fallbacks", () => {
    const options = ["A", "B", "C"];

    expect(normalizeMultiSelectValues(["A", "B", "C"], options)).toEqual(options);
    expect(normalizeMultiSelectValues(["C", "Z", "C"], options)).toEqual(["C"]);
    expect(normalizeMultiSelectValues([], options)).toEqual([]);
    expect(normalizeMultiSelectValues([], [])).toEqual([]);
  });
});
