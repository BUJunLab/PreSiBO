import ExcelJS from "exceljs";
import type { Request, RequestHandler, Response } from "express";

import type { RichTableCell, TableCell, TableResult } from "../types.js";

export function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

function sanitizeCell(value: unknown): TableCell {
  if (value === null || value === undefined) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (isRichTableCell(value)) {
    return value;
  }

  return String(value);
}

function isRichTableCell(value: unknown): value is RichTableCell {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    (value as { kind?: unknown }).kind === "rich"
  );
}

export function createTableResult(
  columns: string[],
  rows: readonly Record<string, unknown>[],
  filename: string
): TableResult {
  return {
    columns,
    filename,
    rows: rows.map((row) => {
      const output: Record<string, TableCell> = {};
      for (const column of columns) {
        output[column] = sanitizeCell(row[column]);
      }
      return output;
    })
  };
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function csvEscape(value: TableCell): string {
  const exportValue = cellToExportValue(value);
  if (exportValue === null) {
    return "";
  }

  const stringValue = String(exportValue);
  if (stringValue.includes(",") || stringValue.includes("\"") || stringValue.includes("\n")) {
    return `"${stringValue.replaceAll("\"", "\"\"")}"`;
  }
  return stringValue;
}

function cellToExportValue(value: TableCell): string | number | boolean | null {
  if (isRichTableCell(value)) {
    return value.exportText;
  }

  return value;
}

async function buildWorkbook(table: TableResult): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Results");

  worksheet.columns = table.columns.map((column) => ({
    header: column,
    key: column,
    width: Math.max(column.length + 4, 16)
  }));
  worksheet.addRows(
    table.rows.map((row) =>
      Object.fromEntries(
        table.columns.map((column) => [column, cellToExportValue(row[column] ?? null)])
      )
    )
  );

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function buildCsv(table: TableResult): string {
  const header = table.columns.map(csvEscape).join(",");
  const body = table.rows
    .map((row) => table.columns.map((column) => csvEscape(row[column])).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

export async function sendTableResponse(
  res: Response,
  table: TableResult,
  format: string | undefined
): Promise<void> {
  if (format === "xlsx") {
    const workbook = await buildWorkbook(table);
    const filename = `${sanitizeFilename(table.filename)}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(workbook);
    return;
  }

  if (format === "csv") {
    const filename = `${sanitizeFilename(table.filename)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buildCsv(table));
    return;
  }

  res.json(table);
}

export function requiredString(value: unknown, label: string): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }

  return trimmed;
}

export function optionalNumber(
  value: unknown,
  fallback: number | undefined
): number | undefined {
  if (value === undefined || value === null || String(value).trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected a numeric value but received "${value}".`);
  }

  return parsed;
}

export function optionalStringList(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  const values = Array.isArray(value) ? value : String(value).split(",");
  return values
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}
