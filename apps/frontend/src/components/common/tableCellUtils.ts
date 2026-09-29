import type { RichTableCell, TableCell } from "../../api/types";
import { formatDisplayText } from "./tableNumberUtils";

export function isRichTableCell(value: TableCell): value is RichTableCell {
  return Boolean(value) && typeof value === "object" && (value as RichTableCell).kind === "rich";
}

export function formatPipeDelimitedText(value: string): string {
  return value
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n");
}

export function getPlainCellText(value: TableCell | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.includes("|") ? formatPipeDelimitedText(value) : value;
  }

  return String(value);
}

export function getDisplayPlainCellText(value: TableCell | undefined): string {
  return formatDisplayText(getPlainCellText(value));
}

export function getSortableCellText(value: TableCell | undefined): string {
  if (value !== null && value !== undefined && isRichTableCell(value)) {
    return value.exportText;
  }

  return getPlainCellText(value);
}

export function toDisplayRichCell(value: TableCell | undefined): RichTableCell | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (isRichTableCell(value)) {
    return {
      ...value,
      lines: value.lines.map((line) => ({
        ...line,
        text: line.imageUrl ? line.text : formatDisplayText(line.text)
      }))
    };
  }

  if (typeof value === "string" && (value.includes("|") || value.includes("\n"))) {
    const lines = value
      .split(/\||\n/g)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((text) => ({ text: formatDisplayText(text) }));

    return {
      kind: "rich",
      lines,
      exportText: lines.map((line) => line.text).join("\n")
    };
  }

  return null;
}

export function getCellLineCount(value: TableCell | undefined): number {
  const richCell = toDisplayRichCell(value);
  return richCell?.lines.length ?? 1;
}

export function getLongestCellLineLength(value: TableCell | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const richCell = toDisplayRichCell(value);
  if (richCell) {
    return richCell.lines.reduce((longest, line) => {
      if (line.imageUrl) {
        return Math.max(longest, 18);
      }

      return Math.max(longest, line.text.length);
    }, 0);
  }

  return getPlainCellText(value)
    .split("\n")
    .reduce((longest, line) => Math.max(longest, line.length), 0);
}
