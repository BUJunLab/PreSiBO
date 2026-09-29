export const minimumTableColumnWidth = 120;

const averageTableCharacterWidth = 8.25;
const expandedCellHorizontalPadding = 16;

export function estimateTableTextWidth(text: string): number {
  return Math.max(
    minimumTableColumnWidth,
    Math.ceil(text.length * averageTableCharacterWidth) + expandedCellHorizontalPadding
  );
}

export function getDefaultTableColumnWidth(columns: readonly string[]): number {
  return columns.reduce(
    (longestWidth, column) =>
      Math.max(longestWidth, Math.ceil(column.length * averageTableCharacterWidth)),
    minimumTableColumnWidth
  );
}

export function tableTextNeedsEllipsis(text: string, columnWidth: number): boolean {
  return estimateTableTextWidth(text) > columnWidth;
}
