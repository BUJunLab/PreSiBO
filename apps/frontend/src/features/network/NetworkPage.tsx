import { Alert, Box, Paper, Stack, TextField } from "@mui/material";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";

import { fetchNetworkFilterOptions, fetchTable } from "../../api/client";
import { useAsyncResource } from "../../api/useAsyncResource";
import { DataPanel } from "../../components/common/DataPanel";
import {
  MultiSelectFilter,
  normalizeMultiSelectValues
} from "../../components/common/MultiSelectFilter";
import { useAppNavigation } from "../../navigation/AppNavigationContext";
import { GeneNetworkLookupPanel } from "./GeneNetworkLookupPanel";
import {
  getFirstMatchingModuleId,
  sortModuleIds,
  type GeneModuleRow
} from "./networkGeneModuleRows";

function pickFirstNetworkRow(
  rows: import("../../api/types").TableRow[] | undefined,
  currentNetworkId: string | null
): { networkId: string | null; moduleId: string | null } {
  if (!rows || rows.length === 0) {
    return { networkId: null, moduleId: null };
  }

  const currentRow = rows.find(
    (row) => String(row["PreSiBO Network ID"] ?? "") === currentNetworkId
  );
  const row = currentRow ?? rows[0];
  return {
    networkId: String(row["PreSiBO Network ID"] ?? ""),
    moduleId: String(row["Module ID"] ?? "")
  };
}

export function NetworkPage() {
  const { setActiveTabLabel } = useAppNavigation();
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [zSummaryInput, setZSummaryInput] = useState("");
  const [selectedNetworkId, setSelectedNetworkId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

  const deferredZSummary = useDeferredValue(zSummaryInput);
  const currentSourceValues = [...selectedSources];
  const currentModuleValues = [...selectedModules];

  const options = useAsyncResource(
    (signal, onRetry) =>
      fetchNetworkFilterOptions({
        source: currentSourceValues,
        moduleId: currentModuleValues,
        zMin: deferredZSummary
      }, { signal, onRetry }),
    [currentSourceValues.join("|"), currentModuleValues.join("|"), deferredZSummary]
  );
  const sourceOptions = useMemo(() => options.data?.sources ?? [], [options.data?.sources]);
  const moduleOptions = useMemo(
    () => sortModuleIds(options.data?.moduleIds ?? []),
    [options.data?.moduleIds]
  );
  const resolvedSources = selectedSources;
  const resolvedModules = selectedModules;
  const sourceParams = [...resolvedSources];
  const moduleParams = [...resolvedModules];

  useEffect(() => {
    setActiveTabLabel("Signature Guided Networks");
  }, [setActiveTabLabel]);

  const networks = useAsyncResource(
    (signal, onRetry) =>
      fetchTable("/networks/signature-guided", {
        source: sourceParams,
        moduleId: moduleParams,
        zMin: deferredZSummary
      }, { signal, onRetry }),
    [sourceParams.join("|"), moduleParams.join("|"), deferredZSummary]
  );

  useEffect(() => {
    const picked = pickFirstNetworkRow(networks.data?.rows, selectedNetworkId);
    setSelectedNetworkId(picked.networkId);
    setSelectedModuleId(picked.moduleId);
  }, [networks.data, selectedNetworkId]);

  const networkProfile = useAsyncResource(
    (signal, onRetry) =>
      fetchTable(
        `/networks/signature-guided/${encodeURIComponent(selectedNetworkId ?? "")}/profile`,
        undefined,
        { signal, onRetry }
      ),
    [selectedNetworkId],
    { enabled: Boolean(selectedNetworkId) }
  );

  const prsAssociations = useAsyncResource(
    (signal, onRetry) =>
      fetchTable(
        `/networks/gene-profiles/${encodeURIComponent(selectedNetworkId ?? "")}/prs-associations`,
        undefined,
        { signal, onRetry }
      ),
    [selectedNetworkId],
    { enabled: Boolean(selectedNetworkId) }
  );

  useEffect(() => {
    if (sourceOptions.length === 0) {
      setSelectedSources((current) => (current.length === 0 ? current : []));
      return;
    }

    setSelectedSources((current) => synchronizeSelection(current, sourceOptions));
  }, [sourceOptions]);

  useEffect(() => {
    if (moduleOptions.length === 0) {
      setSelectedModules((current) => (current.length === 0 ? current : []));
      return;
    }

    setSelectedModules((current) => synchronizeSelection(current, moduleOptions));
  }, [moduleOptions]);

  const handleGeneLookupComplete = useCallback(
    (matches: readonly GeneModuleRow[]) => {
      const nextModuleId =
        getFirstMatchingModuleId(moduleOptions, matches) ?? moduleOptions[0] ?? null;
      if (!nextModuleId) {
        return;
      }

      setSelectedModules((current) =>
        current.length === 1 && current[0] === nextModuleId ? current : [nextModuleId]
      );
    },
    [moduleOptions]
  );

  return (
    <Stack spacing={2.5}>
      <GeneNetworkLookupPanel onLookupComplete={handleGeneLookupComplete} />

      <Paper className="panel-card" sx={{ p: 2 }}>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(3, minmax(0, 1fr))"
            }
          }}
        >
          <MultiSelectFilter
            label="Source of Network"
            options={sourceOptions}
            values={resolvedSources}
            onChange={(nextValues) =>
              setSelectedSources(normalizeMultiSelectValues(nextValues, sourceOptions))
            }
          />
          <MultiSelectFilter
            label="Module ID"
            options={moduleOptions}
            values={resolvedModules}
            onChange={(nextValues) =>
              setSelectedModules(normalizeMultiSelectValues(nextValues, moduleOptions))
            }
          />
          <TextField
            fullWidth
            label="Z-Summary >="
            value={zSummaryInput}
            onChange={(event) => setZSummaryInput(event.target.value)}
          />
        </Box>
      </Paper>

      <DataPanel
        title="Networks"
        table={networks.data}
        loading={networks.loading || options.loading}
        retrying={networks.retrying || options.retrying}
        error={networks.error ?? options.error}
        onRetry={() => {
          options.retry();
          networks.retry();
        }}
        selectedRowField="PreSiBO Network ID"
        selectedRowValue={selectedNetworkId}
        onRowSelect={(row) => {
          setSelectedNetworkId(String(row["PreSiBO Network ID"] ?? ""));
          setSelectedModuleId(String(row["Module ID"] ?? ""));
        }}
      />

      {selectedNetworkId ? (
        <>
          <DataPanel
            title="Gene Profile"
            table={networkProfile.data}
            loading={networkProfile.loading}
            retrying={networkProfile.retrying}
            error={networkProfile.error}
            onRetry={networkProfile.retry}
          />

          <DataPanel
            title={`PRS Associations${selectedModuleId ? ` for ${selectedModuleId}` : ""}`}
            table={prsAssociations.data}
            loading={prsAssociations.loading}
            retrying={prsAssociations.retrying}
            error={prsAssociations.error}
            onRetry={prsAssociations.retry}
          />
        </>
      ) : (
        <Alert severity="info">
          Select a network row to display the gene profile and PRS associations tables.
        </Alert>
      )}
    </Stack>
  );
}

function synchronizeSelection(values: readonly string[], options: readonly string[]) {
  const normalizedValues = normalizeMultiSelectValues(values, options);
  if (normalizedValues.length === 0 && options.length > 0) {
    return [options[0]];
  }

  if (
    normalizedValues.length === values.length &&
    normalizedValues.every((value, index) => value === values[index])
  ) {
    return values as string[];
  }

  return normalizedValues;
}
