import {
  Alert,
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  FormControlLabel,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import type { TableRow } from "../../api/types";
import { PlotlyChart } from "../../components/charts/plotly";
import {
  buildActivityTypeFigure,
  buildBbbFigure,
  buildClinicalTrialSunburst,
  buildDiseaseAreaFigure,
  buildMaxPhaseFigure,
  buildScopedFieldFigure,
  getDiseaseAreaOptions,
  getPrioritizedTargetOptions,
  parseRepurposingRows,
  type ActivityCountMode,
  type DonutFigureData,
  type ScopeMode,
  type SunburstFigureData
} from "./drugRepurposingInsights";
import {
  buildDonutPresentation,
  formatChartPercent,
  formatChartValue,
  type NumberedChartEntry
} from "./drugRepurposingChartPresentation";
import { CollapsibleSection } from "./CollapsibleSection";

interface DrugRepurposingChartsProps {
  rows: readonly TableRow[];
  clinicalTrialRows: readonly TableRow[];
  clinicalLoading: boolean;
  clinicalError: string | null;
  expanded: {
    overview: boolean;
    activity: boolean;
    disease: boolean;
    clinical: boolean;
  };
  onToggleSection: (
    section: "overview" | "activity" | "disease" | "clinical",
    expanded: boolean
  ) => void;
}

export function DrugRepurposingCharts({
  rows,
  clinicalTrialRows,
  clinicalLoading,
  clinicalError,
  expanded,
  onToggleSection
}: DrugRepurposingChartsProps) {
  const hasExpandedChart =
    expanded.overview || expanded.activity || expanded.disease || expanded.clinical;
  const parsedRows = useMemo(() => {
    if (!hasExpandedChart) {
      return [];
    }

    const clinicalTrialsByCompound = new Map(
      parseRepurposingRows(clinicalTrialRows).map((row) => [row.compoundCid, row.clinicalTrials])
    );
    return parseRepurposingRows(rows).map((row) => ({
      ...row,
      clinicalTrials: clinicalTrialsByCompound.get(row.compoundCid) ?? []
    }));
  }, [clinicalTrialRows, hasExpandedChart, rows]);
  const prioritizedTargets = useMemo(() => getPrioritizedTargetOptions(parsedRows), [parsedRows]);
  const diseaseAreas = useMemo(() => getDiseaseAreaOptions(parsedRows), [parsedRows]);

  const [activityTarget, setActivityTarget] = useState<string>("");
  const [activityMode, setActivityMode] = useState<ActivityCountMode>("compound");
  const [diseaseScopeMode, setDiseaseScopeMode] = useState<ScopeMode>("disease-area");
  const [diseaseScopeValue, setDiseaseScopeValue] = useState<string>("");
  const [clinicalScopeMode, setClinicalScopeMode] = useState<ScopeMode>("disease-area");
  const [clinicalScopeValue, setClinicalScopeValue] = useState<string>("");

  useEffect(() => {
    if (!prioritizedTargets.includes(activityTarget)) {
      setActivityTarget(prioritizedTargets[0] ?? "");
    }
  }, [activityTarget, prioritizedTargets]);

  const diseaseScopeOptions =
    diseaseScopeMode === "disease-area" ? diseaseAreas : prioritizedTargets;
  const clinicalScopeOptions =
    clinicalScopeMode === "disease-area" ? diseaseAreas : prioritizedTargets;

  useEffect(() => {
    if (!diseaseScopeOptions.includes(diseaseScopeValue)) {
      setDiseaseScopeValue(diseaseScopeOptions[0] ?? "");
    }
  }, [diseaseScopeOptions, diseaseScopeValue]);

  useEffect(() => {
    if (!clinicalScopeOptions.includes(clinicalScopeValue)) {
      setClinicalScopeValue(clinicalScopeOptions[0] ?? "");
    }
  }, [clinicalScopeOptions, clinicalScopeValue]);

  const maxPhaseFigure = useMemo(() => buildMaxPhaseFigure(parsedRows), [parsedRows]);
  const bbbFigure = useMemo(() => buildBbbFigure(parsedRows), [parsedRows]);
  const diseaseAreaFigure = useMemo(() => buildDiseaseAreaFigure(parsedRows), [parsedRows]);
  const activityFigure = useMemo(
    () => buildActivityTypeFigure(parsedRows, activityTarget || null, activityMode),
    [activityMode, activityTarget, parsedRows]
  );
  const diseaseIndicationFigure = useMemo(
    () =>
      buildScopedFieldFigure(
        parsedRows,
        diseaseScopeMode,
        diseaseScopeValue || null,
        "diseaseIndications"
      ),
    [diseaseScopeMode, diseaseScopeValue, parsedRows]
  );
  const mechanismFigure = useMemo(
    () =>
      buildScopedFieldFigure(parsedRows, diseaseScopeMode, diseaseScopeValue || null, "mechanisms"),
    [diseaseScopeMode, diseaseScopeValue, parsedRows]
  );
  const clinicalFigure = useMemo(
    () => buildClinicalTrialSunburst(parsedRows, clinicalScopeMode, clinicalScopeValue || null),
    [clinicalScopeMode, clinicalScopeValue, parsedRows]
  );

  return (
    <Stack spacing={3}>
      <CollapsibleSection
        title="Overview"
        expanded={expanded.overview}
        onChange={(nextExpanded) => onToggleSection("overview", nextExpanded)}
      >
        <Stack
          direction={{ xs: "column", xl: "row" }}
          spacing={2}
          sx={{ alignItems: "stretch" }}
        >
          <DonutFigureCard title="Current Max Phase" figure={maxPhaseFigure} />
          <DonutFigureCard title="BBB Status" figure={bbbFigure} />
          <DonutFigureCard title="Disease Area" figure={diseaseAreaFigure} />
        </Stack>
      </CollapsibleSection>

      <CollapsibleSection
        title="Activity"
        expanded={expanded.activity}
        onChange={(nextExpanded) => onToggleSection("activity", nextExpanded)}
      >
        <FigureCard
          title="Activity Value Types by Prioritized Target"
          controls={
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ width: "100%" }}>
              <FormControl size="small" sx={{ minWidth: 240 }}>
                <InputLabel id="activity-target-label">Prioritized Target</InputLabel>
                <Select
                  labelId="activity-target-label"
                  label="Prioritized Target"
                  value={activityTarget}
                  onChange={(event) => setActivityTarget(String(event.target.value))}
                >
                  {prioritizedTargets.map((target) => (
                    <MenuItem key={target} value={target}>
                      {target}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <RadioGroup
                row
                value={activityMode}
                onChange={(_event, value) => setActivityMode(value as ActivityCountMode)}
              >
                <FormControlLabel value="compound" control={<Radio />} label="By Compound" />
                <FormControlLabel
                  value="interaction"
                  control={<Radio />}
                  label="By Interaction"
                />
              </RadioGroup>
            </Stack>
          }
        >
          <DonutFigure figure={activityFigure} />
        </FigureCard>
      </CollapsibleSection>

      <CollapsibleSection
        title="Disease Breakdown"
        expanded={expanded.disease}
        onChange={(nextExpanded) => onToggleSection("disease", nextExpanded)}
      >
        <Stack
          direction={{ xs: "column", xl: "row" }}
          spacing={2}
          sx={{ alignItems: "stretch" }}
        >
          <DonutFigureCard
            title="Disease Indication"
            figure={diseaseIndicationFigure}
            controls={
              <ScopedSelector
                idPrefix="disease-indication"
                mode={diseaseScopeMode}
                value={diseaseScopeValue}
                options={diseaseScopeOptions}
                onModeChange={setDiseaseScopeMode}
                onValueChange={setDiseaseScopeValue}
              />
            }
          />
          <DonutFigureCard
            title="Mechanism of Action"
            figure={mechanismFigure}
            controls={
              <ScopedSelector
                idPrefix="mechanism"
                mode={diseaseScopeMode}
                value={diseaseScopeValue}
                options={diseaseScopeOptions}
                onModeChange={setDiseaseScopeMode}
                onValueChange={setDiseaseScopeValue}
              />
            }
          />
        </Stack>
      </CollapsibleSection>

      <CollapsibleSection
        title="Clinical Trials"
        expanded={expanded.clinical}
        onChange={(nextExpanded) => onToggleSection("clinical", nextExpanded)}
      >
        <FigureCard
          title="Clinical Trial Phases and Conditions"
          controls={
            <ScopedSelector
              idPrefix="clinical-trials"
              mode={clinicalScopeMode}
              value={clinicalScopeValue}
              options={clinicalScopeOptions}
              onModeChange={setClinicalScopeMode}
              onValueChange={setClinicalScopeValue}
            />
          }
        >
          {clinicalLoading ? (
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", py: 4 }}>
              <CircularProgress size={22} />
              <Typography>Loading clinical-trial summary…</Typography>
            </Stack>
          ) : clinicalError ? (
            <Alert severity="error">{clinicalError}</Alert>
          ) : (
            <SunburstFigure figure={clinicalFigure} />
          )}
        </FigureCard>
      </CollapsibleSection>
    </Stack>
  );
}

function ScopedSelector({
  idPrefix,
  mode,
  value,
  options,
  onModeChange,
  onValueChange
}: {
  idPrefix: string;
  mode: ScopeMode;
  value: string;
  options: readonly string[];
  onModeChange: (mode: ScopeMode) => void;
  onValueChange: (value: string) => void;
}) {
  const label = mode === "disease-area" ? "Disease Area" : "Prioritized Target";

  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ width: "100%" }}>
      <ToggleButtonGroup
        exclusive
        value={mode}
        onChange={(_event, nextValue: ScopeMode | null) => {
          if (nextValue) {
            onModeChange(nextValue);
          }
        }}
        color="primary"
        size="small"
      >
        <ToggleButton value="disease-area">Disease Area</ToggleButton>
        <ToggleButton value="prioritized-target">Prioritized Target</ToggleButton>
      </ToggleButtonGroup>
      <FormControl size="small" sx={{ minWidth: 240 }}>
        <InputLabel id={`${idPrefix}-${mode}-selector-label`}>{label}</InputLabel>
        <Select
          labelId={`${idPrefix}-${mode}-selector-label`}
          label={label}
          value={value}
          onChange={(event) => onValueChange(String(event.target.value))}
        >
          {options.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );
}

function DonutFigureCard({
  title,
  figure,
  controls
}: {
  title: string;
  figure: DonutFigureData;
  controls?: React.ReactNode;
}) {
  return (
    <FigureCard title={title} controls={controls} sx={{ flex: 1 }}>
      <DonutFigure figure={figure} />
    </FigureCard>
  );
}

function FigureCard({
  title,
  controls,
  children,
  sx
}: {
  title: string;
  controls?: React.ReactNode;
  children: React.ReactNode;
  sx?: Record<string, unknown>;
}) {
  return (
    <Paper className="panel-card" sx={{ overflow: "hidden", ...sx }}>
      <Box className="panel-card-header">
        <Typography variant="h6">{title}</Typography>
      </Box>
      <Stack spacing={2} sx={{ p: 2 }}>
        {controls ? <Box>{controls}</Box> : null}
        {children}
      </Stack>
    </Paper>
  );
}

function DonutFigure({ figure }: { figure: DonutFigureData }) {
  const presentation = useMemo(() => buildDonutPresentation(figure), [figure]);

  if (presentation.entries.length === 0) {
    return <EmptyMessage message={figure.emptyMessage} />;
  }

  return (
    <Stack spacing={2}>
      <Box sx={{ width: "100%", minHeight: presentation.height, position: "relative" }}>
        <PlotlyChart
          data={[
            {
              type: "pie",
              labels: presentation.entries.map((entry) => entry.label),
              values: presentation.entries.map((entry) => entry.value),
              hole: 0.62,
              sort: false,
              direction: "clockwise",
              rotation: 90,
              domain: {
                x: [0, 1],
                y: [0, 1]
              },
              text: presentation.entries.map((entry) => entry.plotText),
              textinfo: "text",
              textposition: "outside",
              automargin: true,
              hovertext: presentation.entries.map((entry) => entry.hoverText),
              hovertemplate: "%{hovertext}<extra></extra>",
              textfont: {
                color: "#000000",
                size: 12
              },
              marker: {
                colors: presentation.entries.map((entry) => entry.color),
                line: {
                  color: "rgba(255,255,255,0.92)",
                  width: 1.4
                }
              },
              showlegend: false
            }
          ]}
          layout={{
            autosize: true,
            height: presentation.height,
            margin: {
              t: 18,
              r: presentation.outerLabelMargin,
              b: presentation.outerLabelMargin,
              l: presentation.outerLabelMargin
            },
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            hoverlabel: {
              align: "left",
              bgcolor: "#ffffff",
              bordercolor: "#000000",
              font: {
                color: "#000000"
              }
            },
            showlegend: false
          }}
          style={{ width: "100%", height: "100%" }}
          config={{ displayModeBar: false, responsive: true }}
          useResizeHandler
        />
      </Box>
      <FigureLegend entries={presentation.entries} />
    </Stack>
  );
}

function SunburstFigure({ figure }: { figure: SunburstFigureData }) {
  if (figure.nodes.length === 0) {
    return <EmptyMessage message={figure.emptyMessage} />;
  }

  const sunburstHeight = 504;
  const rootTotal = figure.nodes
    .filter((node) => node.parent === "")
    .reduce((total, node) => total + node.value, 0);

  return (
    <Box sx={{ width: "100%", minHeight: sunburstHeight }}>
      <PlotlyChart
        data={[
          {
            type: "sunburst",
            ids: figure.nodes.map((node) => node.id),
            labels: figure.nodes.map((node) => node.label),
            parents: figure.nodes.map((node) => node.parent),
            values: figure.nodes.map((node) => node.value),
            customdata: figure.nodes.map((node) =>
              formatChartPercent(rootTotal > 0 ? node.value / rootTotal : 0)
            ),
            branchvalues: "total",
            marker: {
              colors: figure.nodes.map((node) => node.color)
            },
            insidetextorientation: "radial",
            hovertemplate:
              "%{label}<br>Value: %{value}<br>Percent: %{customdata}<extra></extra>"
          }
        ]}
        layout={{
          autosize: true,
          height: sunburstHeight,
          margin: { t: 20, r: 16, b: 16, l: 16 },
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent"
        }}
        style={{ width: "100%", height: "100%" }}
        config={{ displayModeBar: false, responsive: true }}
      />
    </Box>
  );
}

function FigureLegend({ entries }: { entries: readonly NumberedChartEntry[] }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 1.5,
        width: "100%",
        alignItems: "stretch"
      }}
    >
      {entries.map((entry) => (
        <Box
          key={entry.key}
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 1.25,
            minWidth: 0,
            px: 1.25,
            py: 1,
            borderRadius: 2.5,
            backgroundColor: "rgba(246,249,253,0.92)",
            border: "1px solid rgba(31,95,148,0.12)"
          }}
        >
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              backgroundColor: entry.color,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              flexShrink: 0,
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)"
            }}
          >
            {entry.rank}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ lineHeight: 1.3, wordBreak: "break-word" }}>
              {entry.label}
            </Typography>
            <Typography variant="caption" sx={{ color: "#000000" }}>
              {formatChartValue(entry.value)} | {formatChartPercent(entry.percentage)}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function EmptyMessage({ message }: { message: string }) {
  return (
    <Alert severity="info" sx={{ alignItems: "center" }}>
      {message}
    </Alert>
  );
}
