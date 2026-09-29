import DeleteOutlineIcon from "@mui/icons-material/Delete";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FilterListIcon from "@mui/icons-material/FilterList";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import type { TableRow } from "../../api/types";
import {
  buildColumnMetadata,
  describeFilter,
  filterModeUsesNoValue,
  filterModeUsesNumberInput,
  filterModeUsesSelection,
  filterModeUsesTextInput,
  getModeSelectionOptions,
  operatorSymbol,
  type NumberOperator,
  type TableFilterColumnMetadata,
  type TableFilterDefinition,
  type TableFilterMode
} from "./tableFilterUtils";

interface TableFilterDialogProps {
  open: boolean;
  title: string;
  rows: readonly TableRow[];
  columns: readonly string[];
  filters: readonly TableFilterDefinition[];
  onClose: () => void;
  onChange: (filters: TableFilterDefinition[]) => void;
}

interface DraftFilterState {
  column: string;
  mode: TableFilterMode | "";
  value: string;
  values: string[];
  operator: NumberOperator;
}

const defaultDraft: DraftFilterState = {
  column: "",
  mode: "",
  value: "",
  values: [],
  operator: "eq"
};

export function TableFilterDialog({
  open,
  title,
  rows,
  columns,
  filters,
  onClose,
  onChange
}: TableFilterDialogProps) {
  const [draft, setDraft] = useState<DraftFilterState>(defaultDraft);
  const [editingId, setEditingId] = useState<string | null>(null);

  const metadata = useMemo(() => buildColumnMetadata(columns, rows), [columns, rows]);
  const selectedMetadata =
    metadata.find((item) => item.column === draft.column) ?? null;
  const selectedModeOptions = selectedMetadata?.modeOptions ?? [];
  const selectionOptions = filterModeUsesSelection(draft.mode)
    ? getModeSelectionOptions(rows, draft.column, draft.mode)
    : [];

  useEffect(() => {
    if (!open) {
      setDraft(defaultDraft);
      setEditingId(null);
    }
  }, [open]);

  function beginEdit(filter: TableFilterDefinition) {
    setEditingId(filter.id);
    setDraft({
      column: filter.column,
      mode: filter.mode,
      value: filter.value ?? "",
      values: filter.values ?? [],
      operator: filter.operator ?? "eq"
    });
  }

  function resetDraft(nextColumn?: string, nextMetadata?: TableFilterColumnMetadata | null) {
    setEditingId(null);
    setDraft({
      column: nextColumn ?? "",
      mode: nextMetadata?.modeOptions[0]?.mode ?? "",
      value: "",
      values: [],
      operator: "eq"
    });
  }

  function saveFilter() {
    if (!draft.column || !draft.mode) {
      return;
    }

    const nextFilter: TableFilterDefinition = {
      id: editingId ?? `${draft.column}_${draft.mode}_${Date.now()}`,
      column: draft.column,
      mode: draft.mode,
      operator: draft.operator,
      value: draft.value.trim(),
      values: [...draft.values]
    };

    const nextFilters = editingId
      ? filters.map((filter) => (filter.id === editingId ? nextFilter : filter))
      : [...filters, nextFilter];

    onChange(nextFilters);
    resetDraft(draft.column, selectedMetadata);
  }

  function removeFilter(id: string) {
    onChange(filters.filter((filter) => filter.id !== id));
    if (editingId === id) {
      resetDraft();
    }
  }

  const canSave =
    draft.column &&
    draft.mode &&
    (filterModeUsesNoValue(draft.mode) ||
      (filterModeUsesSelection(draft.mode)
        ? draft.values.length > 0
        : draft.value.trim() !== ""));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <FormControl fullWidth>
              <InputLabel id="table-filter-column-label">Column</InputLabel>
              <Select
                labelId="table-filter-column-label"
                label="Column"
                value={draft.column}
                onChange={(event) => {
                  const nextColumn = String(event.target.value);
                  const nextMetadata =
                    metadata.find((item) => item.column === nextColumn) ?? null;
                  resetDraft(nextColumn, nextMetadata);
                }}
              >
                {metadata.map((item) => (
                  <MenuItem key={item.column} value={item.column}>
                    {item.column}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth disabled={!draft.column}>
              <InputLabel id="table-filter-mode-label">Filter Type</InputLabel>
              <Select
                labelId="table-filter-mode-label"
                label="Filter Type"
                value={draft.mode}
                onChange={(event) => {
                  const nextMode = String(event.target.value) as TableFilterMode;
                  setDraft((current) => ({
                    ...current,
                    mode: nextMode,
                    value: "",
                    values: [],
                    operator: "eq"
                  }));
                }}
              >
                {selectedModeOptions.map((option) => (
                  <MenuItem key={option.mode} value={option.mode}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {filterModeUsesTextInput(draft.mode) ? (
            <TextField
              label={getTextFilterInputLabel(draft.mode)}
              value={draft.value}
              onChange={(event) => {
                setDraft((current) => ({ ...current, value: event.target.value }));
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && canSave) {
                  saveFilter();
                }
              }}
            />
          ) : null}

          {filterModeUsesNumberInput(draft.mode) ? (
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <FormControl sx={{ minWidth: 160 }}>
                <InputLabel id="table-filter-operator-label">Operator</InputLabel>
                <Select
                  labelId="table-filter-operator-label"
                  label="Operator"
                  value={draft.operator}
                  onChange={(event) => {
                    setDraft((current) => ({
                      ...current,
                      operator: event.target.value as NumberOperator
                    }));
                  }}
                >
                  {(["lt", "lte", "eq", "gte", "gt"] as const).map((operator) => (
                    <MenuItem key={operator} value={operator}>
                      {operatorSymbol(operator)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Value"
                value={draft.value}
                onChange={(event) => {
                  setDraft((current) => ({ ...current, value: event.target.value }));
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && canSave) {
                    saveFilter();
                  }
                }}
                fullWidth
              />
            </Stack>
          ) : null}

          {filterModeUsesSelection(draft.mode) ? (
            <FormControl fullWidth>
              <InputLabel id="table-filter-values-label">Values</InputLabel>
              <Select
                labelId="table-filter-values-label"
                label="Values"
                multiple
                value={draft.values}
                renderValue={(selected) => (selected as string[]).join(", ")}
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    values: event.target.value as string[]
                  }));
                }}
              >
                {selectionOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    <Checkbox checked={draft.values.includes(option)} />
                    <ListItemText primary={option} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}

          {filterModeUsesNoValue(draft.mode) ? (
            <Typography color="text.secondary">
              This filter does not require a typed value.
            </Typography>
          ) : null}

          <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end" }}>
            <Button
              variant="outlined"
              onClick={() => resetDraft(draft.column, selectedMetadata)}
              disabled={!editingId && !draft.value && draft.values.length === 0}
            >
              Clear Draft
            </Button>
            <Button variant="contained" onClick={saveFilter} disabled={!canSave}>
              {editingId ? "Save Filter" : "Add Filter"}
            </Button>
          </Stack>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Active Filters
            </Typography>
            {filters.length === 0 ? (
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <FilterListIcon fontSize="small" color="disabled" />
                <Typography color="text.secondary">No filters applied.</Typography>
              </Stack>
            ) : (
              <Stack spacing={1.25}>
                {filters.map((filter) => (
                  <Box
                    key={filter.id}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      border: "1px solid rgba(31,95,148,0.12)",
                      borderRadius: 2,
                      px: 1.25,
                      py: 0.75
                    }}
                  >
                    <Chip size="small" label={filter.column} color="secondary" />
                    <Typography sx={{ flexGrow: 1 }}>{describeFilter(filter)}</Typography>
                    <IconButton size="small" onClick={() => beginEdit(filter)}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => removeFilter(filter.id)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function getTextFilterInputLabel(mode: TableFilterMode | "") {
  switch (mode) {
    case "text-not-contains":
      return "Does not contain";
    case "text-equals":
      return "Equals";
    case "text-not-equals":
      return "Does not equal";
    case "text-starts-with":
      return "Starts with";
    case "text-ends-with":
      return "Ends with";
    default:
      return "Contains";
  }
}
