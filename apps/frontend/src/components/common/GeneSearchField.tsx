import { TextField } from "@mui/material";

interface GeneSearchFieldProps {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  onSubmit?: () => void;
  placeholder?: string;
}

export function GeneSearchField({
  label,
  value,
  onChange,
  onSubmit,
  placeholder
}: GeneSearchFieldProps) {
  return (
    <TextField
      fullWidth
      label={label}
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(event) => {
        const nextValue = event.target.value.trim();
        onChange(nextValue ? nextValue : null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onSubmit?.();
        }
      }}
    />
  );
}
