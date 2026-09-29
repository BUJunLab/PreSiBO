import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography
} from "@mui/material";

export interface TableColumnDialogProps {
  open: boolean;
  title: string;
  columns: readonly string[];
  visibilityModel: Record<string, boolean | undefined>;
  onClose: () => void;
  onChange: (column: string, visible: boolean) => void;
}

export function TableColumnDialog({
  open,
  title,
  columns,
  visibilityModel,
  onClose,
  onChange
}: TableColumnDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        {columns.length === 0 ? (
          <Typography color="text.secondary">No columns are available.</Typography>
        ) : (
          <Stack spacing={0.75}>
            {columns.map((column) => (
              <FormControlLabel
                key={column}
                control={
                  <Checkbox
                    checked={visibilityModel[column] !== false}
                    onChange={(event) => onChange(column, event.target.checked)}
                  />
                }
                label={column}
              />
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
