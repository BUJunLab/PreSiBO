import { describe, expect, it } from "vitest";

import {
  formatDisplayText,
  formatNumericCell
} from "../src/components/common/tableNumberUtils";

describe("formatDisplayText", () => {
  it("formats scientific notation strings with superscript exponents", () => {
    expect(formatDisplayText("7.01e-7")).toBe("7.01 x 10⁻⁷");
    expect(formatDisplayText("= 7.0100E-7")).toBe("=7.01 x 10⁻⁷");
  });

  it("does not format numeric-looking substrings inside identifiers", () => {
    expect(formatDisplayText("NR2E1")).toBe("NR2E1");
    expect(formatDisplayText("CYP2E1")).toBe("CYP2E1");
    expect(formatDisplayText("EIF4E1")).toBe("EIF4E1");
    expect(formatDisplayText("UBE2E1")).toBe("UBE2E1");
    expect(formatDisplayText("variant1.234567")).toBe("variant1.234567");
  });

  it("omits scientific notation when the exponent is zero", () => {
    expect(formatNumericCell(1)).toBe("1");
    expect(formatNumericCell(7.25)).toBe("7.25");
    expect(formatDisplayText("1.234567")).toBe("1.2346");
  });
});
