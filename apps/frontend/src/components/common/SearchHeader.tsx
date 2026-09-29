import SearchIcon from "@mui/icons-material/Search";
import { Button, Paper, Stack, TextField, Typography } from "@mui/material";

interface SearchHeaderProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
}

export function SearchHeader({
  label,
  placeholder,
  value,
  onChange,
  onSearch
}: SearchHeaderProps) {
  return (
    <Paper className="panel-card" sx={{ p: 2.5 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ alignItems: { md: "center" } }}
      >
        {label ? (
          <Typography variant="h6" sx={{ minWidth: 150 }}>
            {label}
          </Typography>
        ) : null}
        <TextField
          fullWidth
          value={value}
          placeholder={placeholder}
          slotProps={{ htmlInput: { "aria-label": label ?? placeholder ?? "Search" } }}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onSearch();
            }
          }}
        />
        <Button
          variant="contained"
          startIcon={<SearchIcon />}
          onClick={onSearch}
          sx={{ minWidth: 132 }}
        >
          Search
        </Button>
      </Stack>
    </Paper>
  );
}
