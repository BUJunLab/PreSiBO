import DownloadIcon from "@mui/icons-material/Download";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TablePagination,
  Typography
} from "@mui/material";
import {
  DataGrid,
  type GridColumnVisibilityModel,
  gridFilteredSortedRowIdsSelector,
  type GridColDef,
  type GridRenderCellParams,
  type GridRowHeightParams,
  type GridRowParams,
  useGridApiRef
} from "@mui/x-data-grid";
import { getGridStringOperators } from "@mui/x-data-grid/colDef";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { TableCell, TableCellAction, TableResult, TableRow } from "../../api/types";
import { inactivePanelHeaderActionSx } from "../../theme";
import { ExpandableTableCellLine } from "./ExpandableTableCellLine";
import { RichTableCell } from "./RichTableCell";
import { TableColumnDialog } from "./TableColumnDialog";
import {
  downloadVisibleTable,
  tableExportFormatOptions,
  type TableExportFormat
} from "./tableExport";
import { TableFilterDialog } from "./TableFilterDialog";
import {
  getDisplayPlainCellText,
  getSortableCellText,
  toDisplayRichCell
} from "./tableCellUtils";
import {
  estimateTableTextWidth,
  getDefaultTableColumnWidth,
  minimumTableColumnWidth
} from "./tableLayoutUtils";
import { parseNumericTableCell } from "./tableNumberUtils";
import {
  applyTableFilters,
  describeFilter,
  type TableFilterDefinition
} from "./tableFilterUtils";

const tableStringFilterOperators = getGridStringOperators();

interface DataPanelProps {
  title: string;
  subtitle?: string;
  table: TableResult | null;
  loading: boolean;
  retrying?: boolean;
  error: string | null;
  emptyMessage?: string;
  selectedRowValue?: string | null;
  selectedRowField?: string;
  onRowSelect?: (row: TableRow) => void;
  onExport?: () => void;
  onCellAction?: (payload: { action: TableCellAction; row: TableRow; column: string }) => void;
  onVisibleRowsChange?: (rows: TableRow[]) => void;
  onRetry?: () => void;
}

export function DataPanel({
  title,
  subtitle,
  table,
  loading,
  retrying = false,
  error,
  emptyMessage,
  selectedRowValue,
  selectedRowField,
  onRowSelect,
  onCellAction,
  onVisibleRowsChange,
  onRetry
}: DataPanelProps) {
  const [expandedCells, setExpandedCells] = useState<Record<string, boolean>>({});
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [filters, setFilters] = useState<TableFilterDefinition[]>([]);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<HTMLElement | null>(null);
  const [columnVisibilityModel, setColumnVisibilityModel] = useState<GridColumnVisibilityModel>({});
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 10
  });
  const apiRef = useGridApiRef();
  const defaultColumnWidth = useMemo(
    () => getDefaultTableColumnWidth(table?.columns ?? []),
    [table?.columns]
  );
  const shouldShowEmptyMessage = Boolean(emptyMessage) && !loading && !error && (!table || table.rows.length === 0);

  const rows = useMemo<Array<TableRow & { __rowId: string }>>(
    () =>
      (table?.rows ?? []).map((row, index) => ({
        __rowId:
          selectedRowField && row[selectedRowField] !== null && row[selectedRowField] !== undefined
            ? `${row[selectedRowField]}_${index}`
            : `row_${index}`,
        ...row
      })),
    [selectedRowField, table?.rows]
  );

  const filteredRows = useMemo(
    () => applyTableFilters(rows, filters),
    [filters, rows]
  );

  useEffect(() => {
    setColumnVisibilityModel((current) => {
      const nextModel: GridColumnVisibilityModel = {};
      for (const column of table?.columns ?? []) {
        nextModel[column] = current[column] ?? true;
      }
      return nextModel;
    });
  }, [table?.columns]);

  useEffect(() => {
    const resetWidths: Record<string, number> = {};
    for (const column of table?.columns ?? []) {
      resetWidths[column] = defaultColumnWidth;
    }
    setColumnWidths(resetWidths);
    setExpandedCells({});
  }, [defaultColumnWidth, table]);

  useEffect(() => {
    apiRef.current?.resetRowHeights();
  }, [apiRef, expandedCells]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(filteredRows.length / paginationModel.pageSize) - 1);
    if (paginationModel.page > maxPage) {
      setPaginationModel((current) => ({ ...current, page: maxPage }));
    }
  }, [filteredRows.length, paginationModel.page, paginationModel.pageSize]);

  const visibleColumns = useMemo(
    () => (table?.columns ?? []).filter((column) => columnVisibilityModel[column] !== false),
    [columnVisibilityModel, table?.columns]
  );
  const columnsToggled = visibleColumns.length < (table?.columns.length ?? 0);
  const expandColumnToFit = useCallback(
    (column: string, text: string) => {
      setColumnWidths((current) => ({
        ...current,
        [column]: Math.max(current[column] ?? defaultColumnWidth, estimateTableTextWidth(text))
      }));
    },
    [defaultColumnWidth]
  );

  const columns = useMemo<GridColDef[]>(
    () =>
      (table?.columns ?? []).map((column) => ({
        field: column,
        headerName: column,
        width: columnWidths[column] ?? defaultColumnWidth,
        minWidth: minimumTableColumnWidth,
        sortable: true,
        filterOperators: tableStringFilterOperators,
        align: "center",
        headerAlign: "center",
        valueGetter: (_value, row) => getSortableCellText((row as TableRow)[column]),
        sortComparator: (left, right) => {
          const leftNumeric = parseNumericTableCell(left as TableCell);
          const rightNumeric = parseNumericTableCell(right as TableCell);
          if (leftNumeric !== null && rightNumeric !== null) {
            return leftNumeric - rightNumeric;
          }

          return getSortableCellText(left as TableCell).localeCompare(
            getSortableCellText(right as TableCell),
            undefined,
            { numeric: true, sensitivity: "base" }
          );
        },
        renderCell: (params: GridRenderCellParams<TableRow & { __rowId: string }, TableCell>) => {
          const cellValue = params.row[column] as TableCell;
          const rowId = String(params.row.__rowId);
          const cellKey = getCellKey(rowId, column);
          const columnWidth = columnWidths[column] ?? defaultColumnWidth;
          const richCell = toDisplayRichCell(cellValue);

          if (richCell) {
            return (
              <RichTableCell
                value={richCell}
                expanded={Boolean(expandedCells[cellKey])}
                columnName={column}
                columnWidth={columnWidth}
                onExpand={() => {
                  setExpandedCells((current) => ({
                    ...current,
                    [cellKey]: true
                  }));
                }}
                onCollapse={() => {
                  setExpandedCells((current) => ({
                    ...current,
                    [cellKey]: false
                  }));
                }}
                onExpandColumn={(text) => expandColumnToFit(column, text)}
                onAction={(action) => {
                  onCellAction?.({
                    action,
                    row: params.row,
                    column
                  });
                }}
              />
            );
          }

          const displayText = getDisplayPlainCellText(cellValue);
          return (
            <ExpandableTableCellLine
              text={displayText}
              columnName={column}
              columnWidth={columnWidth}
              onExpandColumn={(text) => expandColumnToFit(column, text)}
            >
              <Typography variant="body2" sx={{ width: "100%", textAlign: "center" }}>
                {displayText}
              </Typography>
            </ExpandableTableCellLine>
          );
        }
      })),
    [
      columnWidths,
      defaultColumnWidth,
      expandColumnToFit,
      expandedCells,
      onCellAction,
      rows,
      table?.columns
    ]
  );

  const getRowHeight = useCallback(
    ({ id }: GridRowHeightParams) =>
      estimateRowHeight(
        filteredRows.find(
          (row): row is TableRow & { __rowId: string } => row.__rowId === String(id)
        ),
        visibleColumns,
        expandedCells
      ),
    [expandedCells, filteredRows, visibleColumns]
  );

  useEffect(() => {
    if (!onVisibleRowsChange || loading || Boolean(error) || !table || !apiRef.current?.state) {
      return;
    }

    queueMicrotask(() => {
      if (!apiRef.current?.state) {
        return;
      }

      const rowIds = gridFilteredSortedRowIdsSelector(apiRef);
      const visibleRows = rowIds
        .map((rowId) => apiRef.current?.getRow(rowId) as (TableRow & { __rowId: string }) | null)
        .filter((row): row is TableRow & { __rowId: string } => Boolean(row))
        .map((row) => {
          const { __rowId: _rowId, ...tableRow } = row;
          return tableRow;
        });

      onVisibleRowsChange(visibleRows);
    });
  }, [apiRef, error, filteredRows, loading, onVisibleRowsChange, table]);

  function exportVisibleRows(format: TableExportFormat) {
    const sortedRows = getSortedFilteredRows(apiRef, filteredRows);
    const exportRows = sortedRows.map((row) => {
      const { __rowId: _rowId, ...tableRow } = row;
      return tableRow;
    });

    downloadVisibleTable({
      filename: table?.filename ?? title,
      columns: visibleColumns,
      rows: exportRows,
      format
    });
  }

  return (
    <Paper className="panel-card" sx={{ overflow: "hidden" }}>
      <Box className="panel-card-header">
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{
            justifyContent: "space-between",
            alignItems: { md: "center" }
          }}
        >
          <Box>
            <Typography variant="h6">{title}</Typography>
            {subtitle ? (
              <Typography variant="body2" color="rgba(255,255,255,0.82)">
                {subtitle}
              </Typography>
            ) : null}
          </Box>
          <Stack direction="row" spacing={1.25}>
            <Button
              variant={columnsToggled ? "contained" : "outlined"}
              color="secondary"
              startIcon={<ViewColumnIcon />}
              onClick={() => setColumnDialogOpen(true)}
              sx={columnsToggled ? undefined : inactivePanelHeaderActionSx}
            >
              Toggle columns
            </Button>
            <Button
              variant={filters.length > 0 ? "contained" : "outlined"}
              color="secondary"
              startIcon={<FilterAltIcon />}
              onClick={() => setFilterDialogOpen(true)}
              sx={filters.length > 0 ? undefined : inactivePanelHeaderActionSx}
            >
              Filters
            </Button>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<DownloadIcon />}
              onClick={(event) => setExportMenuAnchor(event.currentTarget)}
              disabled={!table || loading}
            >
              Export
            </Button>
            <Menu
              anchorEl={exportMenuAnchor}
              open={Boolean(exportMenuAnchor)}
              onClose={() => setExportMenuAnchor(null)}
            >
              {tableExportFormatOptions.map((option) => (
                <MenuItem
                  key={option.format}
                  onClick={() => {
                    setExportMenuAnchor(null);
                    exportVisibleRows(option.format);
                  }}
                >
                  {option.label}
                </MenuItem>
              ))}
            </Menu>
          </Stack>
        </Stack>
      </Box>
      <Box sx={{ p: 2 }}>
        {filters.length > 0 ? (
          <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 2, flexWrap: "wrap" }}>
            {filters.map((filter) => (
              <Chip
                key={filter.id}
                label={describeFilter(filter)}
                onDelete={() => {
                  setFilters((current) => current.filter((item) => item.id !== filter.id));
                }}
              />
            ))}
          </Stack>
        ) : null}
        {error ? (
          <Alert
            severity="error"
            action={
              onRetry ? (
                <Button color="inherit" size="small" onClick={onRetry}>
                  Retry
                </Button>
              ) : undefined
            }
          >
            {error}
          </Alert>
        ) : null}
        {loading ? (
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ minHeight: 140, alignItems: "center" }}
          >
            <CircularProgress size={24} />
            <Typography>
              {retrying
                ? "The server is responding slowly. Retrying automatically…"
                : "Loading data..."}
            </Typography>
          </Stack>
        ) : null}
        {shouldShowEmptyMessage ? <Alert severity="info">{emptyMessage}</Alert> : null}
        {!loading && !error && !shouldShowEmptyMessage ? (
          <Stack spacing={0}>
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <DataGrid
                apiRef={apiRef}
                autoHeight
                rows={filteredRows}
                columns={columns}
                columnVisibilityModel={columnVisibilityModel}
                onColumnVisibilityModelChange={setColumnVisibilityModel}
                getRowId={(row) => row.__rowId}
                getRowHeight={getRowHeight}
                onColumnWidthChange={(params) => {
                  setColumnWidths((current) => ({
                    ...current,
                    [params.colDef.field]: params.width
                  }));
                }}
                disableRowSelectionOnClick={false}
                pagination
                hideFooter
                pageSizeOptions={[10, 25, 50, 100]}
                paginationModel={paginationModel}
                onPaginationModelChange={setPaginationModel}
                onRowClick={(params: GridRowParams) => {
                  onRowSelect?.(params.row as TableRow);
                }}
                onSortModelChange={() => {
                  if (!onVisibleRowsChange || !apiRef.current?.state) {
                    return;
                  }

                  queueMicrotask(() => {
                    if (!apiRef.current?.state) {
                      return;
                    }

                    const rowIds = gridFilteredSortedRowIdsSelector(apiRef);
                    const visibleRows = rowIds
                      .map(
                        (rowId) =>
                          apiRef.current?.getRow(rowId) as (TableRow & { __rowId: string }) | null
                      )
                      .filter((row): row is TableRow & { __rowId: string } => Boolean(row))
                      .map((row) => {
                        const { __rowId: _rowId, ...tableRow } = row;
                        return tableRow;
                      });

                    onVisibleRowsChange(visibleRows);
                  });
                }}
                getRowClassName={(params) =>
                  selectedRowField &&
                  selectedRowValue &&
                  String(params.row[selectedRowField] ?? "") === selectedRowValue
                    ? "is-selected-row"
                    : ""
                }
                sx={{
                  border: "none",
                  minWidth: Math.max(
                    visibleColumns.reduce((total, columnName) => {
                      const column = columns.find((candidate) => candidate.field === columnName);
                      return total + (column?.width ?? 0);
                    }, 0),
                    420
                  ),
                  "& .MuiDataGrid-columnHeaders": {
                    backgroundColor: "rgba(31,95,148,0.06)"
                  },
                  "& .MuiDataGrid-columnHeaderTitle": {
                    fontWeight: 700
                  },
                  "& .MuiDataGrid-cell": {
                    display: "flex",
                    alignItems: "center !important",
                    justifyContent: "center",
                    py: 0.5
                  },
                  "& .MuiDataGrid-cell > .MuiBox-root, & .MuiDataGrid-cell > .MuiStack-root": {
                    my: "auto"
                  },
                  "& .MuiDataGrid-cellContent": {
                    whiteSpace: "normal",
                    overflow: "visible",
                    textOverflow: "unset",
                    textAlign: "center"
                  },
                  "& .is-selected-row": {
                    backgroundColor: "rgba(31,95,148,0.08)"
                  }
                }}
              />
            </Box>
            <TablePagination
              component="div"
              count={filteredRows.length}
              page={paginationModel.page}
              onPageChange={(_event, nextPage) =>
                setPaginationModel((current) => ({ ...current, page: nextPage }))
              }
              rowsPerPage={paginationModel.pageSize}
              onRowsPerPageChange={(event) => {
                const nextPageSize = Number(event.target.value);
                setPaginationModel({
                  page: 0,
                  pageSize: nextPageSize
                });
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
              sx={{
                borderTop: "1px solid rgba(31,95,148,0.08)",
                backgroundColor: "rgba(255,255,255,0.85)"
              }}
            />
          </Stack>
        ) : null}
      </Box>
      <TableFilterDialog
        open={filterDialogOpen}
        title={`Manage Filters: ${title}`}
        rows={rows}
        columns={table?.columns ?? []}
        filters={filters}
        onClose={() => setFilterDialogOpen(false)}
        onChange={setFilters}
      />
      <TableColumnDialog
        open={columnDialogOpen}
        title={`Toggle Columns: ${title}`}
        columns={table?.columns ?? []}
        visibilityModel={columnVisibilityModel}
        onClose={() => setColumnDialogOpen(false)}
        onChange={(column, visible) => {
          setColumnVisibilityModel((current) => ({
            ...current,
            [column]: visible
          }));
        }}
      />
    </Paper>
  );
}

function estimateRowHeight(
  row: (TableRow & { __rowId: string }) | undefined,
  visibleColumns: readonly string[],
  expandedCells: Readonly<Record<string, boolean>>
): number {
  if (!row) {
    return 56;
  }

  let tallestCell = 1;
  let hasImage = false;

  for (const [key, value] of Object.entries(row)) {
    if (key === "__rowId" || !visibleColumns.includes(key)) {
      continue;
    }

    const richCell = toDisplayRichCell(value);
    if (richCell) {
      const isExpanded = richCell.lines.length === 1 || expandedCells[getCellKey(row.__rowId, key)];
      if (isExpanded) {
        hasImage = hasImage || richCell.lines.some((line) => Boolean(line.imageUrl));
        tallestCell = Math.max(tallestCell, Math.max(1, richCell.lines.length));
      }
      continue;
    }
  }

  return Math.max(hasImage ? 144 : 56, tallestCell * 28 + 24);
}

function getCellKey(rowId: string, column: string): string {
  return `${rowId}\u0000${column}`;
}

function getSortedFilteredRows(
  apiRef: ReturnType<typeof useGridApiRef>,
  fallbackRows: readonly TableRow[]
) {
  if (!apiRef.current?.state) {
    return fallbackRows.filter(
      (row): row is TableRow & { __rowId: string } =>
        typeof (row as TableRow & { __rowId?: unknown }).__rowId === "string"
    );
  }

  const rowIds = gridFilteredSortedRowIdsSelector(apiRef);
  return rowIds
    .map((rowId) => apiRef.current?.getRow(rowId) as (TableRow & { __rowId: string }) | null)
    .filter((row): row is TableRow & { __rowId: string } => Boolean(row));
}
