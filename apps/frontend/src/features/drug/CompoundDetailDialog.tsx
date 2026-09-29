import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  Typography
} from "@mui/material";

import type { TableCellAction, TableRow } from "../../api/types";
import { RichTableCell } from "../../components/common/RichTableCell";
import { getPlainCellText, toDisplayRichCell } from "../../components/common/tableCellUtils";

interface CompoundDetailDialogProps {
  open: boolean;
  row: TableRow | null;
  columns: string[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onClose: () => void;
  onCellAction?: (payload: { action: TableCellAction; row: TableRow; column: string }) => void;
}

export function CompoundDetailDialog({
  open,
  row,
  columns,
  loading = false,
  error = null,
  onRetry,
  onClose,
  onCellAction
}: CompoundDetailDialogProps) {
  if (!row) {
    return null;
  }

  const title = extractTitle(row);
  const structureImage = extractStructureImage(row);
  const visibleColumns = columns.filter((column) => {
    if (column === "Compound Name" || column === "Compound Structure") {
      return false;
    }

    const value = row[column];
    if (value === null || value === undefined) {
      return false;
    }

    const richCell = toDisplayRichCell(value);
    if (richCell) {
      return richCell.lines.length > 0;
    }

    return Boolean(getPlainCellText(value).trim());
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      slotProps={{
        paper: {
          sx: {
            maxHeight: "80vh",
            borderRadius: 3
          }
        }
      }}
    >
      <Stack direction="row" sx={{ px: 1, pt: 1, justifyContent: "flex-end" }}>
        <IconButton onClick={onClose} aria-label="Close compound details">
          <CloseIcon />
        </IconButton>
      </Stack>
      <DialogContent dividers sx={{ pt: 0 }}>
          <Stack spacing={2.5}>
          {loading ? (
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <CircularProgress size={20} />
              <Typography>Loading detailed clinical-trial and bioassay data…</Typography>
            </Stack>
          ) : null}
          {error ? (
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography color="error">{error}</Typography>
              {onRetry ? <Button onClick={onRetry}>Retry</Button> : null}
            </Stack>
          ) : null}
          <Stack spacing={1.5} sx={{ alignItems: "center" }}>
            <Typography variant="h5" sx={{ textAlign: "center" }}>
              {title}
            </Typography>
            {structureImage ? (
              <Box
                component="img"
                src={structureImage.imageUrl}
                alt={structureImage.imageAlt ?? `${title} structure`}
                sx={{
                  display: "block",
                  maxWidth: "100%",
                  maxHeight: 220,
                  objectFit: "contain"
                }}
              />
            ) : null}
          </Stack>

          {visibleColumns.map((column) => {
            const value = row[column];
            const richCell = toDisplayRichCell(value);

            if (!richCell) {
              return (
                <Typography key={column} variant="body1">
                  <Box component="span" sx={{ fontWeight: 700 }}>
                    {column}:
                  </Box>{" "}
                  {getPlainCellText(value)}
                </Typography>
              );
            }

            const isSingleTextLine =
              richCell.lines.length === 1 && !richCell.lines[0]?.imageUrl;

            return (
              <Stack key={column} spacing={0.5} sx={{ alignItems: "stretch" }}>
                {isSingleTextLine ? (
                  <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {column}:
                    </Typography>
                    <RichTableCell
                      value={richCell}
                      align="flex-start"
                      onAction={(action) => {
                        onCellAction?.({ action, row, column });
                      }}
                    />
                  </Stack>
                ) : (
                  <>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {column}:
                    </Typography>
                    <RichTableCell
                      value={richCell}
                      align="flex-start"
                      onAction={(action) => {
                        onCellAction?.({ action, row, column });
                      }}
                    />
                  </>
                )}
              </Stack>
            );
          })}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

function extractTitle(row: TableRow): string {
  const richCell = toDisplayRichCell(row["Compound Name"]);
  if (richCell?.lines[0]?.text) {
    return richCell.lines[0].text;
  }

  return getPlainCellText(row["Compound Name"]) || "Compound";
}

function extractStructureImage(row: TableRow) {
  const richCell = toDisplayRichCell(row["Compound Structure"]);
  return richCell?.lines.find((line) => Boolean(line.imageUrl)) ?? null;
}
