import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography
} from "@mui/material";

export interface DrugGraphNodeControlOption {
  id: string;
  label: string;
}

interface DrugGraphNodeControlDialogProps {
  open: boolean;
  title: string;
  items: readonly DrugGraphNodeControlOption[];
  highlightedIds: ReadonlySet<string>;
  hiddenIds: ReadonlySet<string>;
  highlightLabel: string;
  hideLabel: string;
  onClose: () => void;
  onToggleHighlight: (id: string, checked: boolean) => void;
  onToggleHide: (id: string, checked: boolean) => void;
}

export function DrugGraphNodeControlDialog({
  open,
  title,
  items,
  highlightedIds,
  hiddenIds,
  highlightLabel,
  hideLabel,
  onClose,
  onToggleHighlight,
  onToggleHide
}: DrugGraphNodeControlDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers sx={{ maxHeight: "70vh" }}>
        <Stack spacing={1}>
          <Stack
            direction="row"
            spacing={2}
            sx={{ px: 1, alignItems: "center", fontWeight: 700 }}
          >
            <Typography sx={{ flex: 1, fontWeight: 700 }}>Name</Typography>
            <Typography sx={{ width: 150, textAlign: "center", fontWeight: 700 }}>
              {highlightLabel}
            </Typography>
            <Typography sx={{ width: 150, textAlign: "center", fontWeight: 700 }}>
              {hideLabel}
            </Typography>
          </Stack>
          <Divider />
          {items.map((item) => (
            <Stack
              key={item.id}
              direction="row"
              spacing={2}
              sx={{ px: 1, py: 0.5, alignItems: "center" }}
            >
              <Typography sx={{ flex: 1 }}>{item.label}</Typography>
              <Stack direction="row" sx={{ width: 150, justifyContent: "center" }}>
                <Checkbox
                  checked={highlightedIds.has(item.id)}
                  onChange={(event) => onToggleHighlight(item.id, event.target.checked)}
                  slotProps={{ input: { "aria-label": `${highlightLabel} ${item.label}` } }}
                />
              </Stack>
              <Stack direction="row" sx={{ width: 150, justifyContent: "center" }}>
                <Checkbox
                  checked={hiddenIds.has(item.id)}
                  onChange={(event) => onToggleHide(item.id, event.target.checked)}
                  slotProps={{ input: { "aria-label": `${hideLabel} ${item.label}` } }}
                />
              </Stack>
            </Stack>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
