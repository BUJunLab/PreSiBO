import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography
} from "@mui/material";

interface DrugGraphPpiVisibilityDialogProps {
  open: boolean;
  maxDepth: number;
  selectedDepth: number;
  onClose: () => void;
  onChangeDepth: (depth: number) => void;
}

export function DrugGraphPpiVisibilityDialog({
  open,
  maxDepth,
  selectedDepth,
  onClose,
  onChangeDepth
}: DrugGraphPpiVisibilityDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>PPI visibility</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <Typography color="text.secondary" variant="body2">
            Choose how many PPI gene degrees remain visible during gene or compound
            highlighting.
          </Typography>
          <RadioGroup
            value={String(selectedDepth)}
            onChange={(event) => onChangeDepth(Number(event.target.value))}
          >
            {Array.from({ length: maxDepth + 1 }, (_, index) => (
              <FormControlLabel
                key={index}
                value={String(index)}
                control={<Radio />}
                label={index === 0 ? "0 degrees" : `${index} degree${index === 1 ? "" : "s"}`}
              />
            ))}
          </RadioGroup>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
