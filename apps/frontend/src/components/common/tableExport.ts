import type { TableCell, TableRow } from "../../api/types";
import { getSortableCellText, toDisplayRichCell } from "./tableCellUtils";

export type TableExportFormat = "csv" | "tsv" | "txt" | "json" | "xls";

export interface TableExportFormatOption {
  format: TableExportFormat;
  label: string;
}

export const tableExportFormatOptions: TableExportFormatOption[] = [
  { format: "csv", label: "CSV" },
  { format: "tsv", label: "TSV" },
  { format: "txt", label: "TXT" },
  { format: "json", label: "JSON" },
  { format: "xls", label: "Excel" }
];

export function downloadVisibleTable(options: {
  filename: string;
  columns: readonly string[];
  rows: readonly TableRow[];
  format: TableExportFormat;
}) {
  const { filename, columns, rows, format } = options;
  const exportPayload = buildExportPayload(columns, rows, format);
  downloadBlob(filename, format, exportPayload.content, exportPayload.mimeType);
}

function downloadBlob(
  filename: string,
  format: TableExportFormat,
  content: string,
  mimeType: string
) {
  const blob = new Blob(["\ufeff", content], { type: mimeType });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `${sanitizeFilename(filename)}.${format}`;
  anchor.click();
  URL.revokeObjectURL(href);
}

function buildExportPayload(
  columns: readonly string[],
  rows: readonly TableRow[],
  format: TableExportFormat
) {
  if (format === "json") {
    return {
      content: buildJson(columns, rows),
      mimeType: "application/json;charset=utf-8;"
    };
  }

  if (format === "xls") {
    return {
      content: buildExcelHtml(columns, rows),
      mimeType: "application/vnd.ms-excel;charset=utf-8;"
    };
  }

  if (format === "tsv") {
    return {
      content: buildDelimitedText(columns, rows, "\t"),
      mimeType: "text/tab-separated-values;charset=utf-8;"
    };
  }

  if (format === "txt") {
    return {
      content: buildDelimitedText(columns, rows, "\t"),
      mimeType: "text/plain;charset=utf-8;"
    };
  }

  return {
    content: buildDelimitedText(columns, rows, ","),
    mimeType: "text/csv;charset=utf-8;"
  };
}

function buildDelimitedText(
  columns: readonly string[],
  rows: readonly TableRow[],
  delimiter: "," | "\t"
) {
  const header = columns.map((column) => escapeDelimitedCell(column, delimiter)).join(delimiter);
  const body = rows.map((row) =>
    columns
      .map((column) => escapeDelimitedCell(getExportText(row[column]), delimiter))
      .join(delimiter)
  );
  return [header, ...body].join("\r\n");
}

function buildJson(columns: readonly string[], rows: readonly TableRow[]) {
  return JSON.stringify(
    rows.map((row) =>
      Object.fromEntries(columns.map((column) => [column, getExportText(row[column])]))
    ),
    null,
    2
  );
}

function buildExcelHtml(columns: readonly string[], rows: readonly TableRow[]) {
  const header = columns
    .map((column) => `<th>${escapeHtml(column)}</th>`)
    .join("");
  const body = rows
    .map((row) => {
      const cells = columns
        .map((column) => `<td>${escapeHtml(getExportText(row[column])).replace(/\n/g, "<br />")}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return [
    "<html>",
    "<head><meta charset=\"utf-8\" /></head>",
    "<body>",
    "<table>",
    `<thead><tr>${header}</tr></thead>`,
    `<tbody>${body}</tbody>`,
    "</table>",
    "</body>",
    "</html>"
  ].join("");
}

function getExportText(value: TableCell | undefined) {
  const richCell = toDisplayRichCell(value);
  if (richCell) {
    return richCell.lines.map((line) => line.text).join("\n");
  }

  return getSortableCellText(value);
}

function escapeDelimitedCell(value: string, delimiter: "," | "\t") {
  const normalized = String(value ?? "");
  const shouldQuote =
    delimiter === "," || normalized.includes(delimiter) || /["\r\n]/.test(normalized);
  if (!shouldQuote) {
    return normalized;
  }

  return `"${normalized.replace(/"/g, "\"\"")}"`;
}

function escapeHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeFilename(value: string) {
  const normalized = String(value ?? "").trim().replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "_");
  return normalized || "presibo-lite-export";
}
