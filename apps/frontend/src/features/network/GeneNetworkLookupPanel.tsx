import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import { fetchTable } from "../../api/client";
import { useAsyncResource } from "../../api/useAsyncResource";
import { GeneSearchField } from "../../components/common/GeneSearchField";
import { useAppNavigation } from "../../navigation/AppNavigationContext";
import { getGeneModuleRows, type GeneModuleRow } from "./networkGeneModuleRows";

interface GeneNetworkLookupPanelProps {
  onLookupComplete?: (matches: readonly GeneModuleRow[]) => void;
}

export function GeneNetworkLookupPanel({ onLookupComplete }: GeneNetworkLookupPanelProps = {}) {
  const { initialGene, sharedGene, setSharedGene } = useAppNavigation();
  const [selectedGene, setSelectedGene] = useState<string | null>(null);
  const [submittedGene, setSubmittedGene] = useState<string | null>(null);
  const matchingModules = useAsyncResource(
    (signal, onRetry) =>
      fetchTable("/networks/signature-guided", {
        gene: submittedGene ? [submittedGene] : []
      }, { signal, onRetry }),
    [submittedGene],
    { enabled: Boolean(submittedGene) }
  );
  const rows = useMemo(
    () => getGeneModuleRows(matchingModules.data?.rows),
    [matchingModules.data?.rows]
  );

  useEffect(() => {
    if (sharedGene !== undefined) {
      setSelectedGene(sharedGene);
      setSubmittedGene(sharedGene);
      return;
    }

    if (initialGene) {
      setSelectedGene(initialGene);
      setSubmittedGene(initialGene);
    }
  }, [initialGene, sharedGene]);

  useEffect(() => {
    if (!submittedGene || matchingModules.loading || matchingModules.error) {
      return;
    }

    onLookupComplete?.(rows);
  }, [matchingModules.error, matchingModules.loading, onLookupComplete, rows, submittedGene]);

  return (
    <Paper className="panel-card" sx={{ p: 2 }}>
      <Box
        sx={{
          display: "grid",
          gap: 2.5,
          gridTemplateColumns: {
            xs: "1fr",
            lg: "minmax(360px, 1fr) minmax(0, 3fr)"
          },
          alignItems: "start"
        }}
      >
        <Stack spacing={1.25}>
          <Typography variant="h6">Find Networks by Gene</Typography>
          <GeneSearchField
            label="Find modules by gene"
            value={sharedGene ?? selectedGene}
            onChange={(nextGene) => {
              setSelectedGene(nextGene);
              setSubmittedGene(nextGene);
              setSharedGene?.(nextGene);
            }}
          />
        </Stack>

        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" sx={{ mb: 1.25 }}>
            {submittedGene ? `Modules containing ${submittedGene}` : "Matching Modules"}
          </Typography>
          {matchingModules.loading ? (
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", py: 3 }}>
              <CircularProgress size={22} />
              <Typography>
                {matchingModules.retrying
                  ? "The server is responding slowly. Retrying automatically…"
                  : "Searching network modules…"}
              </Typography>
            </Stack>
          ) : matchingModules.error ? (
            <Alert severity="error">{matchingModules.error}</Alert>
          ) : submittedGene && rows.length === 0 ? (
            <Alert severity="info">No network modules contain this gene.</Alert>
          ) : submittedGene ? (
            <TableContainer
              sx={{
                maxHeight: 230,
                border: "1px solid rgba(31,95,148,0.12)",
                borderRadius: 2
              }}
            >
              <Table size="small" stickyHeader aria-label="Gene network modules">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Module ID</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Method / Omics Source</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Discovery Study</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={`${row.moduleId}-${row.source}-${row.study}`}>
                      <TableCell>{row.moduleId}</TableCell>
                      <TableCell>{row.source}</TableCell>
                      <TableCell>{row.study}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              Choose a gene to see the modules and methods that contain it.
            </Typography>
          )}
        </Box>
      </Box>
    </Paper>
  );
}
