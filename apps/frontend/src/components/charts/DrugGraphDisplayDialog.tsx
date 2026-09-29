import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack
} from "@mui/material";

interface DrugGraphDisplayDialogProps {
  open: boolean;
  showGeneNames: boolean;
  showCompoundNames: boolean;
  onClose: () => void;
  onChangeShowGeneNames: (checked: boolean) => void;
  onChangeShowCompoundNames: (checked: boolean) => void;
}

export function DrugGraphDisplayDialog({
  open,
  showGeneNames,
  showCompoundNames,
  onClose,
  onChangeShowGeneNames,
  onChangeShowCompoundNames
}: DrugGraphDisplayDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Toggle Names</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1}>
          <FormControlLabel
            control={
              <Checkbox
                checked={showGeneNames}
                onChange={(event) => onChangeShowGeneNames(event.target.checked)}
              />
            }
            label="Display gene names"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={showCompoundNames}
                onChange={(event) => onChangeShowCompoundNames(event.target.checked)}
              />
            }
            label="Display compound names"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
