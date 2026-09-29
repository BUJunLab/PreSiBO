import {
  Autocomplete,
  Checkbox,
  Radio,
  ListItemText,
  TextField
} from "@mui/material";

interface MultiSelectFilterProps {
  label: string;
  options: readonly string[];
  values: readonly string[];
  onChange: (values: string[]) => void;
  minWidth?: number;
  selectionMode?: "multiple" | "single";
}

export function MultiSelectFilter({
  label,
  options,
  values,
  onChange,
  minWidth = 220,
  selectionMode = "multiple"
}: MultiSelectFilterProps) {
  const selectedValues = normalizeMultiSelectValues(values, options);
  if (selectionMode === "single") {
    return (
      <Autocomplete
        disableClearable={options.length > 0}
        options={[...options]}
        value={selectedValues[0] ?? null}
        onChange={(_event, nextValue) => onChange(normalizeSingleSelectValue(nextValue, options))}
        isOptionEqualToValue={(option, value) => option === value}
        sx={{ minWidth, width: "100%" }}
        renderOption={(props, option, { selected }) => (
          <li {...props}>
            <Radio checked={selected} sx={{ mr: 1 }} />
            <ListItemText primary={option} />
          </li>
        )}
        renderInput={(params) => <TextField {...params} label={label} />}
        clearOnBlur={false}
      />
    );
  }

  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      options={[...options]}
      value={selectedValues}
      onChange={(_event, nextValues) => onChange(normalizeMultiSelectValues(nextValues, options))}
      isOptionEqualToValue={(option, value) => option === value}
      sx={{ minWidth, width: "100%" }}
      renderOption={(props, option, { selected }) => (
        <li {...props}>
          <Checkbox checked={selected} sx={{ mr: 1 }} />
          <ListItemText primary={option} />
        </li>
      )}
      renderInput={(params) => <TextField {...params} label={label} />}
      slotProps={{
        chip: {
          size: "small"
        }
      }}
      filterSelectedOptions={false}
      clearOnBlur={false}
    />
  );
}

export function normalizeMultiSelectValues(
  nextValues: readonly string[],
  options: readonly string[]
) {
  const optionSet = new Set(options);
  return [...new Set(nextValues.filter((value) => optionSet.has(value)))];
}

function normalizeSingleSelectValue(nextValue: string | null, options: readonly string[]) {
  if (!nextValue) {
    return [];
  }

  return normalizeMultiSelectValues([nextValue], options);
}
