import {
  Alert,
  Box,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField
} from "@mui/material";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { fetchTable } from "../../api/client";
import { useAsyncResource } from "../../api/useAsyncResource";
import { DataPanel } from "../../components/common/DataPanel";
import { GeneSearchField } from "../../components/common/GeneSearchField";
import {
  MultiSelectFilter,
  normalizeMultiSelectValues
} from "../../components/common/MultiSelectFilter";
import { useAppNavigation } from "../../navigation/AppNavigationContext";

const predictorSelections = [
  "Outcome-Clinical Diagnosis",
  "Outcome-Tangle (BRAAK)",
  "Outcome-Plaque (CERAD)",
  "Biomarker-CSF.Abeta",
  "Biomarker-CSF.pTau",
  "Biomarker-CSF.tTau"
] as const;

const signatureAnalysisOptions = [
  {
    value: "diff-expression",
    label: "Differential Expression (AD vs Non-AD)"
  },
  {
    value: "quantitative-trait-loci",
    label: "Quantitative Trait Loci"
  }
] as const;

export function TargetPage() {
  const { initialGene, navigationIntent, setActiveTabLabel, sharedGene, setSharedGene } = useAppNavigation();
  const appliedInitialGeneRef = useRef<string | null>(null);
  const appliedNavigationIntentIdRef = useRef<number | null>(null);
  const [tab, setTab] = useState(0);
  const [predictorSelectionsValue, setPredictorSelectionsValue] = useState<string[]>([
    predictorSelections[0]
  ]);
  const [predictorGenes, setPredictorGenes] = useState<string[]>([]);
  const [predictorPMaxInput, setPredictorPMaxInput] = useState("1.00");
  const [signatureGenes, setSignatureGenes] = useState<string[]>([]);
  const [signaturePMaxInput, setSignaturePMaxInput] = useState("");
  const [signatureAnalysisSelections, setSignatureAnalysisSelections] = useState<string[]>([
    signatureAnalysisOptions[0].label
  ]);

  const predictorPMax = useDeferredValue(predictorPMaxInput);
  const signaturePMax = useDeferredValue(signaturePMaxInput);

  const resolvedPredictorSelections = predictorSelectionsValue;
  const preferredGene =
    navigationIntent?.page === "target" && navigationIntent.gene
      ? navigationIntent.gene
      : initialGene;
  const resolvedPredictorGenes = predictorGenes;
  const resolvedSignatureGenes = signatureGenes;
  const resolvedSignatureAnalyses = signatureAnalysisSelections;
  const predictorGeneParams = [...resolvedPredictorGenes];
  const signatureGeneParams = [...resolvedSignatureGenes];
  const predictorGeneValue = predictorGeneParams[0]?.trim() ?? "";
  const signatureGeneValue = signatureGeneParams[0]?.trim() ?? "";
  const hasPredictorGene = predictorGeneValue.length > 0;
  const hasSignatureGene = signatureGeneValue.length > 0;
  const activePredictorSelections = [...resolvedPredictorSelections];
  const activeSignatureAnalyses = [...resolvedSignatureAnalyses];
  const predictorEmptyMessage = hasPredictorGene
    ? `No genes found with name ${predictorGeneValue}.`
    : "Enter a gene name to view records.";
  const signatureEmptyMessage = hasSignatureGene
    ? `No genes found with name ${signatureGeneValue}.`
    : "Enter a gene name to view records.";

  const predictorTables = useAsyncResource(
    (signal, onRetry) =>
      Promise.all(
        activePredictorSelections.map(async (selection) => ({
          selection,
          table: await fetchTable("/targets/predictors", {
            gene: predictorGeneParams,
            selection: [selection],
            pMax: predictorPMax || "1.00"
          }, { signal, onRetry })
        }))
      ),
    [activePredictorSelections.join("|"), predictorGeneParams.join("|"), predictorPMax],
    { enabled: activePredictorSelections.length > 0 && hasPredictorGene }
  );

  const signatureTables = useAsyncResource(
    (signal, onRetry) =>
      Promise.all(
        activeSignatureAnalyses.map(async (analysisLabel) => ({
          analysisLabel,
          table: await fetchTable(getSignatureAnalysisPath(analysisLabel), {
            gene: signatureGeneParams,
            pMax: signaturePMax
          }, { signal, onRetry })
        }))
      ),
    [activeSignatureAnalyses.join("|"), signatureGeneParams.join("|"), signaturePMax],
    { enabled: activeSignatureAnalyses.length > 0 && hasSignatureGene }
  );

  useEffect(() => {
    setActiveTabLabel(tab === 0 ? "Predictor" : "Signature");
  }, [setActiveTabLabel, tab]);

  useEffect(() => {
    if (navigationIntent?.page !== "target") {
      return;
    }

    if (navigationIntent.tab === "Predictor") {
      setTab(0);
    } else if (navigationIntent.tab === "Signature") {
      setTab(1);
    }

    if (navigationIntent.gene && appliedNavigationIntentIdRef.current !== navigationIntent.id) {
      appliedNavigationIntentIdRef.current = navigationIntent.id;
      appliedInitialGeneRef.current = navigationIntent.gene;
      setPredictorGenes([navigationIntent.gene]);
      setSignatureGenes([navigationIntent.gene]);
      setSharedGene?.(navigationIntent.gene);
    }
  }, [navigationIntent, setSharedGene]);

  useEffect(() => {
    setPredictorSelectionsValue((current) => synchronizeSelection(current, predictorSelections));
  }, []);

  useEffect(() => {
    setSignatureAnalysisSelections((current) =>
      synchronizeSelection(
        current,
        signatureAnalysisOptions.map((option) => option.label)
      )
    );
  }, []);

  useEffect(() => {
    if (sharedGene) {
      setPredictorGenes([sharedGene]);
      setSignatureGenes([sharedGene]);
      return;
    }

    if (!preferredGene || appliedInitialGeneRef.current === preferredGene) {
      return;
    }

    appliedInitialGeneRef.current = preferredGene;
    setPredictorGenes([preferredGene]);
    setSignatureGenes([preferredGene]);
  }, [preferredGene, sharedGene]);

  const updateSharedGene = (nextValue: string | null) => {
    const normalized = normalizeGeneInput(nextValue);
    const nextGene = normalized[0] ?? null;
    setPredictorGenes(normalized);
    setSignatureGenes(normalized);
    setSharedGene?.(nextGene);
  };

  const predictorFilters = useMemo(
    () => (
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
            label="SBO Selection"
            options={predictorSelections}
            values={resolvedPredictorSelections}
            onChange={(nextValues) =>
              setPredictorSelectionsValue(normalizeMultiSelectValues(nextValues, predictorSelections))
            }
          />
          <GeneSearchField
            label="Gene"
            value={resolvedPredictorGenes[0] ?? null}
            onChange={updateSharedGene}
          />
          <TextField
            fullWidth
            label="P-value <="
            value={predictorPMaxInput}
            onChange={(event) => setPredictorPMaxInput(event.target.value)}
          />
        </Box>
      </Paper>
    ),
    [predictorPMaxInput, resolvedPredictorGenes, resolvedPredictorSelections]
  );

  return (
    <Stack spacing={2.5}>
      <Paper className="panel-card" sx={{ p: 1 }}>
        <Tabs value={tab} onChange={(_event, nextTab) => setTab(nextTab)}>
          <Tab label="Predictor" />
          <Tab label="Signature" />
        </Tabs>
      </Paper>

      {tab === 0 ? (
        <Stack spacing={2}>
          {predictorFilters}
          {activePredictorSelections.length === 0 ? (
            <Alert severity="info">Select at least one SBO selection to display predictor tables.</Alert>
          ) : (
            activePredictorSelections.map((selection) => {
              const table = predictorTables.data?.find((entry) => entry.selection === selection)?.table ?? null;
              return (
                <DataPanel
                  key={selection}
                  title={selection}
                  table={table}
                  loading={hasPredictorGene && predictorTables.loading}
                  retrying={predictorTables.retrying}
                  error={predictorTables.error}
                  onRetry={predictorTables.retry}
                  emptyMessage={predictorEmptyMessage}
                />
              );
            })
          )}
        </Stack>
      ) : (
        <Stack spacing={2}>
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
                label="Analysis"
                options={signatureAnalysisOptions.map((option) => option.label)}
                values={resolvedSignatureAnalyses}
                onChange={(nextValues) =>
                  setSignatureAnalysisSelections(
                    normalizeMultiSelectValues(
                      nextValues,
                      signatureAnalysisOptions.map((option) => option.label)
                    )
                  )
                }
              />
              <GeneSearchField
                label="Gene"
                value={resolvedSignatureGenes[0] ?? null}
                onChange={updateSharedGene}
              />
              <TextField
                fullWidth
                label="P-value <="
                value={signaturePMaxInput}
                onChange={(event) => setSignaturePMaxInput(event.target.value)}
              />
            </Box>
          </Paper>
          {activeSignatureAnalyses.length === 0 ? (
            <Alert severity="info">Select at least one analysis to display signature tables.</Alert>
          ) : (
            activeSignatureAnalyses.map((analysisLabel) => {
              const table =
                signatureTables.data?.find((entry) => entry.analysisLabel === analysisLabel)?.table ??
                null;
              return (
                <DataPanel
                  key={analysisLabel}
                  title={analysisLabel}
                  table={table}
                  loading={hasSignatureGene && signatureTables.loading}
                  retrying={signatureTables.retrying}
                  error={signatureTables.error}
                  onRetry={signatureTables.retry}
                  emptyMessage={signatureEmptyMessage}
                />
              );
            })
          )}
        </Stack>
      )}
    </Stack>
  );
}

function normalizeGeneInput(value: string | null): string[] {
  const normalizedValue = value?.trim();
  return normalizedValue ? [normalizedValue] : [];
}

function synchronizeSelection(
  values: readonly string[],
  options: readonly string[],
  preferredValue?: string | null
) {
  const normalizedValues = normalizeMultiSelectValues(values, options);
  if (normalizedValues.length === 0 && options.length > 0) {
    if (preferredValue && options.includes(preferredValue)) {
      return [preferredValue];
    }

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

function getSignatureAnalysisPath(label: string) {
  const analysis = signatureAnalysisOptions.find((option) => option.label === label)?.value;
  return analysis === "diff-expression"
    ? "/targets/signatures/diff-expression"
    : "/targets/signatures/quantitative-trait-loci";
}
