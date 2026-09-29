import type { RichTableCell, TableCell } from "../../api/types";

const superscriptMap: Record<string, string> = {
  "-": "\u207b",
  "0": "\u2070",
  "1": "\u00b9",
  "2": "\u00b2",
  "3": "\u00b3",
  "4": "\u2074",
  "5": "\u2075",
  "6": "\u2076",
  "7": "\u2077",
  "8": "\u2078",
  "9": "\u2079"
};

const superscriptInverseMap = Object.fromEntries(
  Object.entries(superscriptMap).map(([plain, superscript]) => [superscript, plain])
) as Record<string, string>;

export function parseNumericTableCell(value: TableCell | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const text = isRichTableCell(value)
    ? value.exportText.split("\n")[0] ?? ""
    : String(value);
  return parseNumericText(text);
}

export function parseNumericText(value: string): number | null {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }

  const normalized = text
    .replace(/,/g, "")
    .replace(/\s*x\s*10\s*[\^]?\s*([+\-]?\d+)/i, "e$1")
    .replace(/\s*x\s*10\s*([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)/i, (_match, exponent: string) => {
      return `e${fromSuperscript(exponent)}`;
    });
  const match = normalized.match(/^[<>]=?|^!=/);
  const numeric = match ? normalized.slice(match[0].length).trim() : normalized;
  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatDisplayText(text: string): string {
  const withPlainNumbers = String(text ?? "").replace(
    /([<>]=?|!=|=)?\s*(?<![\w.])(-?\d+\.\d+|-?\d+)(?![\w.])/g,
    (_match, comparator: string | undefined, numericText: string) => {
      const formatted = formatNumericToken(numericText);
      return comparator ? `${comparator}${formatted}` : formatted;
    }
  );

  return withPlainNumbers.replace(
    /([<>]=?|!=|=)?\s*(?<![\w.])(-?(?:\d+\.\d+|\d+)(?:e[+\-]?\d+))(?![\w.])/gi,
    (_match, comparator: string | undefined, numericText: string) => {
      const formatted = formatNumericToken(numericText);
      return comparator ? `${comparator}${formatted}` : formatted;
    }
  );
}

export function formatNumericCell(value: TableCell | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number") {
    return formatNumericValue(value);
  }

  return formatDisplayText(String(value));
}

function formatNumericToken(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  if (/[eE]/.test(value)) {
    return formatNumericValue(parsed);
  }

  const decimals = getDecimalDigits(value);
  if (decimals <= 4) {
    return stripTrailingZeros(value);
  }

  return formatNumericValue(parsed);
}

function formatNumericValue(value: number): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }

  const scientific = value.toExponential(4);
  const [mantissaText, exponentText] = scientific.split("e");
  const mantissa = stripTrailingZeros(mantissaText);
  const exponent = Number(exponentText);
  if (exponent === 0) {
    return mantissa;
  }
  return `${mantissa} x 10${toSuperscript(exponent)}`;
}

function getDecimalDigits(value: string) {
  const match = value.match(/\.(\d+)/);
  return match ? match[1].length : 0;
}

function stripTrailingZeros(value: string) {
  if (!value.includes(".")) {
    return value;
  }

  return value.replace(/\.?0+$/, "");
}

function toSuperscript(value: number) {
  return String(value)
    .split("")
    .map((character) => superscriptMap[character] ?? character)
    .join("");
}

function fromSuperscript(value: string) {
  return value
    .split("")
    .map((character) => superscriptInverseMap[character] ?? character)
    .join("");
}

function isRichTableCell(value: TableCell): value is RichTableCell {
  return typeof value === "object" && value !== null && "kind" in value && value.kind === "rich";
}
