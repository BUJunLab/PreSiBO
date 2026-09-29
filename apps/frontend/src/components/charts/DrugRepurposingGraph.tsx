import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent
} from "react";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Menu,
  MenuItem,
  Paper,
  Slider,
  Stack,
  TextField,
  Typography
} from "@mui/material";

import type {
  DrugRepurposingGraph as DrugRepurposingGraphData,
  DrugRepurposingGraphActivity,
  DrugRepurposingGraphEdge,
  DrugRepurposingGraphNode,
  DrugRepurposingLegendItem
} from "../../api/types";
import { inactivePanelHeaderActionSx } from "../../theme";
import { useAppNavigation } from "../../navigation/AppNavigationContext";
import { DrugGraphDisplayDialog } from "./DrugGraphDisplayDialog";
import { DrugGraphNodeControlDialog } from "./DrugGraphNodeControlDialog";
import { DrugGraphPpiVisibilityDialog } from "./DrugGraphPpiVisibilityDialog";
import {
  activityIsWithinRange,
  buildDrugGraphActivityDomains,
  type DrugGraphActivityRange
} from "./drugGraphActivityRanges";
import { applyDrugGraphVisibility } from "./drugGraphVisibility";
import { PlotlyChart } from "./plotly";

interface DrugRepurposingGraphProps {
  graph: DrugRepurposingGraphData | null;
  loading: boolean;
  error: string | null;
  onCompoundDetailRequest?: (compoundCid: string) => void;
}

interface NodeMenuAction {
  label: string;
  href?: string;
  navigation?: {
    page: "about" | "target" | "network" | "drug";
    tab?: string;
    gene?: string;
    query?: string;
  };
}

interface MenuState {
  nodeId: string;
  mouseX: number;
  mouseY: number;
}

interface SelectionOverlayState {
  nodeId: string;
  left: number;
  top: number;
}

const compoundColor = "rgb(43, 109, 224)";
const targetColor = "rgb(207, 47, 47)";
const outerRadius = 2.7;
const innerRadius = 1.6;
const baseSphereOpacity = 0.14;
const compoundGlyphByPhase: Record<string, string> = {
  "2": "●",
  "3": "▲",
  "4": "■"
};
const activityDirectionByType: Record<string, "lower" | "higher"> = {
  AC50: "lower",
  Activity: "higher",
  EC50: "lower",
  fIC50: "lower",
  GI50: "lower",
  IC50: "lower",
  INH: "higher",
  Kd: "lower",
  Ki: "lower",
  Km: "lower",
  Potency: "higher"
};

export function DrugRepurposingGraph({
  graph,
  loading,
  error,
  onCompoundDetailRequest
}: DrugRepurposingGraphProps) {
  const { requestNavigation } = useAppNavigation();
  const plotContainerRef = useRef<HTMLDivElement | null>(null);
  const [activeLineLegendKeys, setActiveLineLegendKeys] = useState<Set<string>>(new Set());
  const [activeCompoundPhases, setActiveCompoundPhases] = useState<Set<string>>(new Set());
  const [activityRanges, setActivityRanges] = useState<Map<string, DrugGraphActivityRange>>(
    new Map()
  );
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [selectionOverlay, setSelectionOverlay] = useState<SelectionOverlayState | null>(null);
  const [displayDialogOpen, setDisplayDialogOpen] = useState(false);
  const [geneDialogOpen, setGeneDialogOpen] = useState(false);
  const [compoundDialogOpen, setCompoundDialogOpen] = useState(false);
  const [ppiDialogOpen, setPpiDialogOpen] = useState(false);
  const [showGeneNames, setShowGeneNames] = useState(false);
  const [showCompoundNames, setShowCompoundNames] = useState(false);
  const [highlightedGeneIds, setHighlightedGeneIds] = useState<Set<string>>(new Set());
  const [hiddenGeneIds, setHiddenGeneIds] = useState<Set<string>>(new Set());
  const [highlightedCompoundIds, setHighlightedCompoundIds] = useState<Set<string>>(new Set());
  const [hiddenCompoundIds, setHiddenCompoundIds] = useState<Set<string>>(new Set());
  const [ppiDepth, setPpiDepth] = useState(0);
  const [legendFiltersChanged, setLegendFiltersChanged] = useState(false);
  const [plotResetToken, setPlotResetToken] = useState(0);
  const [plotRendered, setPlotRendered] = useState(false);
  const explicitHighlightMode =
    highlightedGeneIds.size > 0 ||
    hiddenGeneIds.size > 0 ||
    highlightedCompoundIds.size > 0 ||
    hiddenCompoundIds.size > 0;

  const pointLegendItems = useMemo(
    () => graph?.legend.find((section) => section.title === "Points")?.items ?? [],
    [graph]
  );
  const phaseLegendItems = useMemo(
    () => pointLegendItems.filter((item) => item.key.startsWith("phase-")),
    [pointLegendItems]
  );
  const activityLegendItems = useMemo(
    () =>
      graph?.legend.find((section) => section.title === "Compound-target lines")?.items.filter(
        (item) => item.key.startsWith("activity:")
      ) ?? [],
    [graph]
  );
  const lineLegendItems = useMemo(
    () =>
      graph?.legend
        .filter((section) => section.title !== "Points")
        .flatMap((section) => section.items) ?? [],
    [graph]
  );
  const activityDomains = useMemo(() => buildDrugGraphActivityDomains(graph), [graph]);

  const legendResetKey = useMemo(() => {
    return [
      graph?.title ?? "",
      phaseLegendItems.map((item) => item.key).join("|"),
      lineLegendItems.map((item) => item.key).join("|")
    ].join("::");
  }, [graph?.title, lineLegendItems, phaseLegendItems]);

  useEffect(() => {
    setActiveLineLegendKeys(new Set(lineLegendItems.map((item) => item.key)));
    setActiveCompoundPhases(
      new Set(phaseLegendItems.map((item) => item.key.replace("phase-", "")))
    );
    setActivityRanges(cloneActivityRanges(activityDomains));
    setFocusedNodeId(null);
    setHoveredNodeId(null);
    setMenuState(null);
    setSelectionOverlay(null);
    setLegendFiltersChanged(false);
  }, [activityDomains, legendResetKey, lineLegendItems, phaseLegendItems]);

  useEffect(() => {
    setPlotRendered(false);
  }, [graph, plotResetToken]);

  const activeLineKey = useMemo(() => {
    return [...activeLineLegendKeys].sort((left, right) => left.localeCompare(right)).join("|");
  }, [activeLineLegendKeys]);
  const activePhaseKey = useMemo(() => {
    return [...activeCompoundPhases]
      .sort((left, right) => left.localeCompare(right))
      .join("|");
  }, [activeCompoundPhases]);
  const deferredActivityRanges = useDeferredValue(activityRanges);
  // Filters are initialized after a graph response arrives. During the first
  // render, use the graph's complete legend instead of interpreting the empty
  // local state as an instruction to hide every node and edge.
  const effectiveLineLegendKeys = useMemo(
    () =>
      activeLineLegendKeys.size > 0
        ? activeLineLegendKeys
        : new Set(lineLegendItems.map((item) => item.key)),
    [activeLineKey, activeLineLegendKeys, lineLegendItems]
  );
  const effectiveCompoundPhases = useMemo(
    () =>
      activeCompoundPhases.size > 0
        ? activeCompoundPhases
        : new Set(phaseLegendItems.map((item) => item.key.replace("phase-", ""))),
    [activeCompoundPhases, activePhaseKey, phaseLegendItems]
  );
  const effectiveActivityRanges = useMemo(
    () =>
      deferredActivityRanges.size > 0
        ? deferredActivityRanges
        : cloneActivityRanges(activityDomains),
    [activityDomains, deferredActivityRanges]
  );

  const visibleGraph = useMemo(
    () => {
      if (!legendFiltersChanged) {
        return graph;
      }

      return deriveVisibleGraph(
        graph,
        lineLegendItems,
        effectiveLineLegendKeys,
        effectiveCompoundPhases,
        effectiveActivityRanges
      );
    },
    [
      activeLineKey,
      activePhaseKey,
      effectiveActivityRanges,
      effectiveCompoundPhases,
      effectiveLineLegendKeys,
      graph,
      legendFiltersChanged,
      lineLegendItems
    ]
  );
  const geneOptions = useMemo(
    () =>
      (visibleGraph?.nodes ?? [])
        .filter((node) => node.kind === "target")
        .map((node) => ({ id: node.id, label: node.label }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [visibleGraph]
  );
  const compoundOptions = useMemo(
    () =>
      (visibleGraph?.nodes ?? [])
        .filter((node) => node.kind === "compound")
        .map((node) => ({ id: node.id, label: node.label }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [visibleGraph]
  );

  useEffect(() => {
    const visibleGeneIds = new Set(geneOptions.map((item) => item.id));
    const visibleCompoundIds = new Set(compoundOptions.map((item) => item.id));

    setHighlightedGeneIds((current) => retainIds(current, visibleGeneIds));
    setHiddenGeneIds((current) => retainIds(current, visibleGeneIds));
    setHighlightedCompoundIds((current) => retainIds(current, visibleCompoundIds));
    setHiddenCompoundIds((current) => retainIds(current, visibleCompoundIds));
  }, [compoundOptions, geneOptions]);

  const activeHighlightedNodeIds = useMemo(() => {
    if (explicitHighlightMode) {
      return new Set([...highlightedGeneIds, ...highlightedCompoundIds]);
    }

    return focusedNodeId ? new Set([focusedNodeId]) : new Set<string>();
  }, [explicitHighlightMode, focusedNodeId, highlightedCompoundIds, highlightedGeneIds]);
  const maxPpiDepth = useMemo(() => computeMaxPpiDepth(visibleGraph), [visibleGraph]);

  useEffect(() => {
    setPpiDepth((current) => Math.min(current, maxPpiDepth));
  }, [maxPpiDepth]);

  const controlledGraph = useMemo(
    () =>
      applyDrugGraphVisibility(visibleGraph, {
        highlightedNodeIds: activeHighlightedNodeIds,
        hiddenNodeIds: new Set([...hiddenGeneIds, ...hiddenCompoundIds]),
        ppiDepth
      }),
    [activeHighlightedNodeIds, hiddenCompoundIds, hiddenGeneIds, ppiDepth, visibleGraph]
  );
  const nodeLookup = useMemo(
    () => new Map((controlledGraph?.nodes ?? []).map((node) => [node.id, node])),
    [controlledGraph]
  );

  useEffect(() => {
    if (focusedNodeId && !nodeLookup.has(focusedNodeId)) {
      setFocusedNodeId(null);
      setMenuState(null);
      setSelectionOverlay(null);
    }
  }, [focusedNodeId, nodeLookup]);

  useEffect(() => {
    if (explicitHighlightMode && focusedNodeId) {
      setFocusedNodeId(null);
      setMenuState(null);
      setSelectionOverlay(null);
    }
  }, [explicitHighlightMode, focusedNodeId]);

  const targetNodes = (controlledGraph?.nodes ?? []).filter((node) => node.kind === "target");
  const finalNodeOpacityById = controlledGraph?.nodeOpacityById ?? new Map<string, number>();
  const edgeTraces = (controlledGraph?.edges ?? []).flatMap((edge) =>
    buildEdgeTraces(edge, nodeLookup, controlledGraph?.edgeOpacityById.get(edge.id) ?? 1)
  );
  const sphereTraces = [
    ...createSphereWireframeTraces(outerRadius, compoundColor, baseSphereOpacity),
    ...createSphereWireframeTraces(innerRadius, targetColor, baseSphereOpacity)
  ];
  const compoundTraces = phaseLegendItems.flatMap((item) => {
    const phase = item.key.replace("phase-", "");
    const phaseNodes = (controlledGraph?.nodes ?? []).filter(
      (node) => node.kind === "compound" && node.phase === phase
    );
    return buildOpacityGroups(phaseNodes, finalNodeOpacityById).map(({ nodes, opacity }) =>
      createCompoundTrace(nodes, compoundGlyphByPhase[phase] ?? "●", opacity)
    );
  });
  const targetTraces = buildOpacityGroups(targetNodes, finalNodeOpacityById)
    .map(({ nodes, opacity }) => createTargetTrace(nodes, opacity))
    .filter(Boolean) as Record<string, unknown>[];
  const geneLabelTraces = showGeneNames
    ? buildOpacityGroups(targetNodes, finalNodeOpacityById)
        .map(({ nodes, opacity }) =>
          createNodeLabelTrace(nodes, opacity, "top center")
        )
        .filter(Boolean)
    : [];
  const compoundLabelTraces = showCompoundNames
    ? buildOpacityGroups(
        (controlledGraph?.nodes ?? []).filter((node) => node.kind === "compound"),
        finalNodeOpacityById
      )
        .map(({ nodes, opacity }) =>
          createNodeLabelTrace(nodes, opacity, "bottom center")
        )
        .filter(Boolean)
    : [];
  const selectionOverlayNode = selectionOverlay
    ? nodeLookup.get(selectionOverlay.nodeId) ?? null
    : null;

  const menuNode = menuState ? nodeLookup.get(menuState.nodeId) ?? null : null;
  const menuActions = menuNode ? buildNodeMenuActions(menuNode) : [];

  function handleLegendToggle(item: DrugRepurposingLegendItem) {
    setLegendFiltersChanged(true);
    if (item.dashRatio !== undefined) {
      setActiveLineLegendKeys((current) => {
        const next = new Set(current);
        if (next.has(item.key)) {
          next.delete(item.key);
        } else {
          next.add(item.key);
        }
        return next;
      });
      return;
    }

    if (item.key.startsWith("phase-")) {
      const phase = item.key.replace("phase-", "");
      setActiveCompoundPhases((current) => {
        const next = new Set(current);
        if (next.has(phase)) {
          next.delete(phase);
        } else {
          next.add(phase);
        }
        return next;
      });
    }
  }

  function handleChartClick(event: unknown) {
    if (explicitHighlightMode) {
      return;
    }

    const clickEvent = event as {
      points?: Array<{ customdata?: unknown }>;
      event?: { clientX?: number; clientY?: number };
    };
    const nodeId = normalizeText(clickEvent.points?.[0]?.customdata);
    if (!nodeId) {
      return;
    }

    setMenuState(null);
    setFocusedNodeId(nodeId);
    setSelectionOverlay(resolveSelectionOverlay(plotContainerRef.current, nodeId, clickEvent.event));
  }

  function handleChartHover(event: unknown) {
    const hoverEvent = event as {
      points?: Array<{ customdata?: unknown }>;
    };
    setHoveredNodeId(normalizeText(hoverEvent.points?.[0]?.customdata));
  }

  function handleChartUnhover() {
    setHoveredNodeId(null);
  }

  function handleContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    if (!hoveredNodeId || !nodeLookup.has(hoveredNodeId)) {
      return;
    }

    event.preventDefault();
    setMenuState({
      nodeId: hoveredNodeId,
      mouseX: event.clientX,
      mouseY: event.clientY
    });
  }

  function handlePlotReset() {
    setActiveLineLegendKeys(new Set(lineLegendItems.map((item) => item.key)));
    setActiveCompoundPhases(
      new Set(phaseLegendItems.map((item) => item.key.replace("phase-", "")))
    );
    setActivityRanges(cloneActivityRanges(activityDomains));
    setShowGeneNames(false);
    setShowCompoundNames(false);
    setHighlightedGeneIds(new Set());
    setHiddenGeneIds(new Set());
    setHighlightedCompoundIds(new Set());
    setHiddenCompoundIds(new Set());
    setPpiDepth(0);
    setFocusedNodeId(null);
    setHoveredNodeId(null);
    setMenuState(null);
    setSelectionOverlay(null);
    setDisplayDialogOpen(false);
    setGeneDialogOpen(false);
    setCompoundDialogOpen(false);
    setPpiDialogOpen(false);
    setPlotResetToken((current) => current + 1);
  }

  return (
    <Paper className="panel-card" sx={{ overflow: "hidden" }}>
      <Box className="panel-card-header">
        <Stack
          direction={{ xs: "column", xl: "row" }}
          spacing={1.5}
          sx={{ justifyContent: "space-between", alignItems: { xl: "center" } }}
        >
          <Typography variant="h6">Drug Repurposing 3D Graph</Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <Button
              variant={showGeneNames || showCompoundNames ? "contained" : "outlined"}
              color="secondary"
              onClick={() => setDisplayDialogOpen(true)}
              sx={showGeneNames || showCompoundNames ? undefined : inactivePanelHeaderActionSx}
            >
              Toggle Names
            </Button>
            <Button
              variant={highlightedGeneIds.size > 0 || hiddenGeneIds.size > 0 ? "contained" : "outlined"}
              color="secondary"
              onClick={() => setGeneDialogOpen(true)}
              sx={
                highlightedGeneIds.size > 0 || hiddenGeneIds.size > 0
                  ? undefined
                  : inactivePanelHeaderActionSx
              }
            >
              Highlight genes
            </Button>
            <Button
              variant={
                highlightedCompoundIds.size > 0 || hiddenCompoundIds.size > 0
                  ? "contained"
                  : "outlined"
              }
              color="secondary"
              onClick={() => setCompoundDialogOpen(true)}
              sx={
                highlightedCompoundIds.size > 0 || hiddenCompoundIds.size > 0
                  ? undefined
                  : inactivePanelHeaderActionSx
              }
            >
              Highlight compounds
            </Button>
            <Button
              variant={ppiDepth > 0 ? "contained" : "outlined"}
              color="secondary"
              onClick={() => setPpiDialogOpen(true)}
              sx={ppiDepth > 0 ? undefined : inactivePanelHeaderActionSx}
            >
              PPI visibility
            </Button>
          </Stack>
        </Stack>
      </Box>
      <Box sx={{ p: 2 }}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {loading ? (
          <Stack direction="row" spacing={1.5} sx={{ minHeight: 140, alignItems: "center" }}>
            <CircularProgress size={24} />
            <Typography>Loading graph...</Typography>
          </Stack>
        ) : null}
        {!loading && controlledGraph && controlledGraph.nodes.length > 0 ? (
          <Stack spacing={2}>
            <Box
              ref={plotContainerRef}
              sx={{ width: "100%", minHeight: 720, position: "relative" }}
              onContextMenu={handleContextMenu}
            >
              {selectionOverlay && selectionOverlayNode ? (
                <Box
                  sx={{
                    position: "absolute",
                    left: selectionOverlay.left,
                    top: selectionOverlay.top,
                    zIndex: 2,
                    transform: "translate(-50%, -135%)",
                    pointerEvents: "auto"
                  }}
                >
                  {selectionOverlayNode.kind === "compound" ? (
                    <Button
                      variant="contained"
                      color="secondary"
                      size="small"
                      onClick={() => {
                        if (selectionOverlayNode.compoundCid) {
                          onCompoundDetailRequest?.(selectionOverlayNode.compoundCid);
                        }
                      }}
                      sx={{
                        minWidth: 0,
                        px: 1,
                        py: 0.25,
                        borderRadius: 999,
                        fontWeight: 700,
                        textTransform: "none",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {selectionOverlayNode.label}
                    </Button>
                  ) : (
                    <Box
                      sx={{
                        px: 1,
                        py: 0.35,
                        borderRadius: 999,
                        backgroundColor: "rgba(255,255,255,0.9)",
                        border: "1px solid rgba(31,95,148,0.16)",
                        boxShadow: "0 8px 18px rgba(16,52,81,0.12)"
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 700, lineHeight: 1.15, whiteSpace: "nowrap" }}
                      >
                        {selectionOverlayNode.label}
                      </Typography>
                    </Box>
                  )}
                </Box>
              ) : null}
              <Button
                variant="contained"
                color="secondary"
                size="small"
                onClick={handlePlotReset}
                sx={{
                  position: "absolute",
                  right: 12,
                  bottom: 12,
                  zIndex: 2
                }}
              >
                Reset
              </Button>
              <PlotlyChart
                key={`drug-graph-${plotResetToken}`}
                data={[
                  ...sphereTraces,
                  ...edgeTraces,
                  ...compoundTraces,
                  ...targetTraces,
                  ...geneLabelTraces,
                  ...compoundLabelTraces
                ]}
                layout={{
                  title: { text: visibleGraph?.title ?? "" },
                  height: 720,
                  margin: { t: 48, r: 16, b: 16, l: 16 },
                  paper_bgcolor: "transparent",
                  plot_bgcolor: "transparent",
                  uirevision: `drug-graph-${plotResetToken}`,
                  scene: {
                    bgcolor: "transparent",
                    uirevision: `drug-graph-${plotResetToken}`,
                    xaxis: { visible: false },
                    yaxis: { visible: false },
                    zaxis: { visible: false },
                    camera: {
                      eye: { x: 1.55, y: 1.35, z: 1.1 }
                    }
                  },
                  showlegend: false
                }}
                style={{ width: "100%", height: "100%" }}
                config={{ responsive: true, displayModeBar: false, scrollZoom: true }}
                onClick={handleChartClick}
                onHover={handleChartHover}
                onUnhover={handleChartUnhover}
                onInitialized={() => setPlotRendered(true)}
              />
              {!plotRendered ? (
                <Stack
                  spacing={1.25}
                  sx={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 3,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(255,255,255,0.88)",
                    pointerEvents: "none"
                  }}
                  aria-live="polite"
                >
                  <CircularProgress size={38} />
                  <Typography color="text.secondary">Rendering interactive graph…</Typography>
                </Stack>
              ) : null}
            </Box>
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <Box
                data-testid="drug-graph-legend-layout"
                sx={{
                  display: "grid",
                  gridTemplateColumns: "220px minmax(620px, 1fr) 220px",
                  gap: 2,
                  width: "100%",
                  minWidth: 1100,
                  alignItems: "stretch"
                }}
              >
                {(visibleGraph?.legend ?? []).map((section) => (
                  <Paper
                    key={section.title}
                    variant="outlined"
                    sx={{
                      p: 2,
                      minWidth: 0,
                      borderColor: "rgba(31,95,148,0.18)",
                      backgroundColor: "rgba(255,255,255,0.72)"
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      {section.title}
                    </Typography>
                    <Stack spacing={1}>
                      {section.items.map((item) => {
                        const interactive =
                          item.dashRatio !== undefined || item.key.startsWith("phase-");
                        const active =
                          item.dashRatio !== undefined
                            ? activeLineLegendKeys.has(item.key)
                            : item.key.startsWith("phase-")
                              ? activeCompoundPhases.has(item.key.replace("phase-", ""))
                              : true;

                        const activityType = item.key.startsWith("activity:")
                          ? item.key.slice("activity:".length)
                          : null;
                        const domain = activityType
                          ? activityDomains.get(activityType) ?? null
                          : null;
                        const selectedRange = activityType
                          ? activityRanges.get(activityType) ?? domain
                          : null;

                        if (activityType && domain && selectedRange) {
                          return (
                            <Box
                              key={item.key}
                              data-testid={`activity-range-row-${activityType}`}
                              sx={{
                                display: "grid",
                                gridTemplateColumns: "minmax(150px, 0.7fr) minmax(300px, 1.6fr)",
                                gap: 2,
                                alignItems: "center",
                                minWidth: 0
                              }}
                            >
                              <LegendItem
                                item={item}
                                interactive={interactive}
                                active={active}
                                onToggle={() => handleLegendToggle(item)}
                              />
                              <ActivityRangeSlider
                                activityType={activityType}
                                domain={domain}
                                value={selectedRange}
                                disabled={!active}
                                directionLabel={getActivityEffectLabel(activityType)}
                                onChange={(nextRange) => {
                                  setLegendFiltersChanged(true);
                                  setActivityRanges((current) => {
                                    const next = new Map(current);
                                    next.set(activityType, nextRange);
                                    return next;
                                  });
                                }}
                              />
                            </Box>
                          );
                        }

                        return (
                          <Box key={item.key}>
                            <LegendItem
                              item={item}
                              interactive={interactive}
                              active={active}
                              onToggle={() => handleLegendToggle(item)}
                            />
                          </Box>
                        );
                      })}
                    </Stack>
                  </Paper>
                ))}
              </Box>
            </Box>
          </Stack>
        ) : null}
        {!loading && !error && (!controlledGraph || controlledGraph.nodes.length === 0) ? (
          <Typography color="text.secondary">
            No graph data is available for the current Drug Repurposing results.
          </Typography>
        ) : null}
      </Box>
      <Menu
        open={Boolean(menuState && menuNode)}
        onClose={() => setMenuState(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          menuState ? { top: menuState.mouseY, left: menuState.mouseX } : undefined
        }
      >
        {menuActions.map((action) => (
          <MenuItem
            key={`${action.label}-${action.href ?? action.navigation?.page ?? "action"}`}
            onClick={() => {
              setMenuState(null);
              if (action.navigation) {
                requestNavigation(action.navigation);
                return;
              }

              if (action.href) {
                window.open(action.href, "_blank", "noopener,noreferrer");
              }
            }}
          >
            {action.label}
          </MenuItem>
        ))}
      </Menu>
      <DrugGraphDisplayDialog
        open={displayDialogOpen}
        showGeneNames={showGeneNames}
        showCompoundNames={showCompoundNames}
        onClose={() => setDisplayDialogOpen(false)}
        onChangeShowGeneNames={setShowGeneNames}
        onChangeShowCompoundNames={setShowCompoundNames}
      />
      <DrugGraphNodeControlDialog
        open={geneDialogOpen}
        title="Highlight Genes"
        items={geneOptions}
        highlightedIds={highlightedGeneIds}
        hiddenIds={hiddenGeneIds}
        highlightLabel="Highlight genes"
        hideLabel="Hide genes"
        onClose={() => setGeneDialogOpen(false)}
        onToggleHighlight={(id, checked) => {
          setHighlightedGeneIds((current) => toggleSetValue(current, id, checked));
          if (checked) {
            setHiddenGeneIds((current) => toggleSetValue(current, id, false));
          }
        }}
        onToggleHide={(id, checked) => {
          setHiddenGeneIds((current) => toggleSetValue(current, id, checked));
          if (checked) {
            setHighlightedGeneIds((current) => toggleSetValue(current, id, false));
          }
        }}
      />
      <DrugGraphNodeControlDialog
        open={compoundDialogOpen}
        title="Highlight Compounds"
        items={compoundOptions}
        highlightedIds={highlightedCompoundIds}
        hiddenIds={hiddenCompoundIds}
        highlightLabel="Highlight compounds"
        hideLabel="Hide compounds"
        onClose={() => setCompoundDialogOpen(false)}
        onToggleHighlight={(id, checked) => {
          setHighlightedCompoundIds((current) => toggleSetValue(current, id, checked));
          if (checked) {
            setHiddenCompoundIds((current) => toggleSetValue(current, id, false));
          }
        }}
        onToggleHide={(id, checked) => {
          setHiddenCompoundIds((current) => toggleSetValue(current, id, checked));
          if (checked) {
            setHighlightedCompoundIds((current) => toggleSetValue(current, id, false));
          }
        }}
      />
      <DrugGraphPpiVisibilityDialog
        open={ppiDialogOpen}
        maxDepth={maxPpiDepth}
        selectedDepth={ppiDepth}
        onClose={() => setPpiDialogOpen(false)}
        onChangeDepth={setPpiDepth}
      />
    </Paper>
  );
}

function deriveVisibleGraph(
  graph: DrugRepurposingGraphData | null,
  lineLegendItems: readonly DrugRepurposingLegendItem[],
  activeLineLegendKeys: ReadonlySet<string>,
  activeCompoundPhases: ReadonlySet<string>,
  activityRanges: ReadonlyMap<string, DrugGraphActivityRange>
): DrugRepurposingGraphData | null {
  if (!graph) {
    return null;
  }

  const nodeLookup = new Map(graph.nodes.map((node) => [node.id, node]));
  const activityColorMap = new Map(
    lineLegendItems
      .filter((item) => item.key.startsWith("activity:"))
      .map((item) => [
        item.key.slice("activity:".length),
        darkenColor(stripAlpha(item.color), 0.5)
      ])
  );
  const edges: DrugRepurposingGraphEdge[] = [];

  for (const edge of graph.edges) {
    if (edge.kind === "target-target" && !activeLineLegendKeys.has("target-target-string")) {
      continue;
    }

    if (edge.kind === "compound-target") {
      const sourceNode = nodeLookup.get(edge.source);
      if (sourceNode?.kind === "compound" && sourceNode.phase) {
        if (!activeCompoundPhases.has(sourceNode.phase)) {
          continue;
        }
      }

      if (edge.activities?.length) {
        const visibleActivities = edge.activities.filter(
          (activity) =>
            activeLineLegendKeys.has(`activity:${activity.type}`) &&
            activityIsWithinRange(activity, activityRanges)
        );
        if (visibleActivities.length === 0) {
          continue;
        }

        const edgeLabel = `${sourceNode?.label ?? edge.source} ↔ ${nodeLookup.get(edge.target)?.label ?? edge.target}`;
        const mixedColor = averageColor(
          visibleActivities.map((activity) => activityColorMap.get(activity.type) ?? compoundColor)
        );

        edges.push({
          ...edge,
          color: withAlpha(mixedColor, 0.5),
          fadedColor: withAlpha(mixedColor, 0.1),
          dashRatio: average(visibleActivities.map((activity) => activity.dashRatio)),
          hoverText: [edgeLabel, ...visibleActivities.map(formatActivityHoverLine)].join("<br>"),
          activities: visibleActivities
        });
        continue;
      }

      if (!activeLineLegendKeys.has("compound-target-default")) {
        continue;
      }
    }

    edges.push({
      ...edge,
      color: darkenColorPreserveAlpha(edge.color, 0.5),
      fadedColor: darkenColorPreserveAlpha(edge.fadedColor, 0.5)
    });
  }

  const visibleNodeIds = new Set<string>();
  for (const edge of edges) {
    visibleNodeIds.add(edge.source);
    visibleNodeIds.add(edge.target);
  }

  return {
    ...graph,
    nodes: graph.nodes.filter((node) => visibleNodeIds.has(node.id)),
    edges
  };
}

function buildOpacityGroups(
  nodes: readonly DrugRepurposingGraphNode[],
  opacityById: ReadonlyMap<string, number>
) {
  const groups = new Map<string, { opacity: number; nodes: DrugRepurposingGraphNode[] }>();

  for (const node of nodes) {
    const opacity = opacityById.get(node.id) ?? 1;
    const key = opacity.toFixed(4);
    const current = groups.get(key);
    if (current) {
      current.nodes.push(node);
      continue;
    }

    groups.set(key, { opacity, nodes: [node] });
  }

  return [...groups.values()];
}

function retainIds(current: ReadonlySet<string>, allowedIds: ReadonlySet<string>) {
  return new Set([...current].filter((value) => allowedIds.has(value)));
}

function toggleSetValue(current: ReadonlySet<string>, value: string, checked: boolean) {
  const next = new Set(current);
  if (checked) {
    next.add(value);
  } else {
    next.delete(value);
  }
  return next;
}

function cloneActivityRanges(
  ranges: ReadonlyMap<string, DrugGraphActivityRange>
): Map<string, DrugGraphActivityRange> {
  return new Map(
    [...ranges].map(([activityType, range]) => [activityType, { ...range }])
  );
}

function getActivityEffectLabel(activityType: string) {
  const direction = activityDirectionByType[activityType] ?? "lower";
  return direction === "higher" ? "higher is better" : "lower is better";
}

function ActivityRangeSlider({
  activityType,
  domain,
  value,
  disabled,
  directionLabel,
  onChange
}: {
  activityType: string;
  domain: DrugGraphActivityRange;
  value: DrugGraphActivityRange;
  disabled: boolean;
  directionLabel: string;
  onChange: (value: DrugGraphActivityRange) => void;
}) {
  const fixedDomain = domain.min === domain.max;
  const [draftMin, setDraftMin] = useState(formatEditableNumber(value.min));
  const [draftMax, setDraftMax] = useState(formatEditableNumber(value.max));

  useEffect(() => {
    setDraftMin(formatEditableNumber(value.min));
    setDraftMax(formatEditableNumber(value.max));
  }, [value.min, value.max]);

  function commitEndpoint(endpoint: "min" | "max", rawValue: string) {
    const parsedValue = parseEditableNumber(rawValue);

    if (parsedValue === null) {
      setDraftMin(formatEditableNumber(value.min));
      setDraftMax(formatEditableNumber(value.max));
      return;
    }

    if (endpoint === "min") {
      const nextMin = clampNumber(parsedValue, domain.min, Math.min(value.max, domain.max));
      setDraftMin(formatEditableNumber(nextMin));
      setDraftMax(formatEditableNumber(value.max));
      onChange({ min: nextMin, max: value.max });
      return;
    }

    const nextMax = clampNumber(parsedValue, Math.max(value.min, domain.min), domain.max);
    setDraftMin(formatEditableNumber(value.min));
    setDraftMax(formatEditableNumber(nextMax));
    onChange({ min: value.min, max: nextMax });
  }

  return (
    <Box sx={{ width: "100%", minWidth: 0, opacity: disabled ? 0.45 : 1 }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "minmax(74px, auto) 1fr minmax(74px, auto)",
          alignItems: "center",
          columnGap: 1,
          mb: -0.5
        }}
      >
        <ActivityRangeEndpointField
          ariaLabel={`${activityType} lower activity cutoff`}
          value={draftMin}
          disabled={disabled || fixedDomain}
          textAlign="left"
          onChange={setDraftMin}
          onCommit={() => commitEndpoint("min", draftMin)}
        />
        <Typography
          variant="caption"
          sx={{
            color: "rgba(33, 33, 33, 0.62)",
            fontSize: "0.68rem",
            lineHeight: 1,
            textAlign: "center",
            whiteSpace: "nowrap"
          }}
        >
          {directionLabel}
        </Typography>
        <ActivityRangeEndpointField
          ariaLabel={`${activityType} upper activity cutoff`}
          value={draftMax}
          disabled={disabled || fixedDomain}
          textAlign="right"
          onChange={setDraftMax}
          onCommit={() => commitEndpoint("max", draftMax)}
        />
      </Box>
      <Slider
        size="small"
        min={domain.min}
        max={domain.max}
        step={activityRangeStep(domain)}
        value={[value.min, value.max]}
        disabled={disabled || fixedDomain}
        disableSwap
        valueLabelDisplay="auto"
        valueLabelFormat={formatNumber}
        getAriaLabel={(index) => `${activityType} ${index === 0 ? "minimum" : "maximum"}`}
        getAriaValueText={formatNumber}
        onChange={(_event, nextValue) => {
          if (!Array.isArray(nextValue)) {
            return;
          }

          onChange({ min: nextValue[0], max: nextValue[1] });
        }}
        sx={{ py: 0.25 }}
      />
    </Box>
  );
}

function ActivityRangeEndpointField({
  ariaLabel,
  value,
  disabled,
  textAlign,
  onChange,
  onCommit
}: {
  ariaLabel: string;
  value: string;
  disabled: boolean;
  textAlign: "left" | "right";
  onChange: (value: string) => void;
  onCommit: () => void;
}) {
  return (
    <TextField
      variant="standard"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onCommit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
      slotProps={{
        input: {
          disableUnderline: true,
          inputProps: {
            "aria-label": ariaLabel,
            inputMode: "decimal"
          }
        }
      }}
      sx={{
        minWidth: 0,
        "& .MuiInputBase-root": {
          fontSize: "0.75rem",
          lineHeight: 1,
          p: 0
        },
        "& .MuiInputBase-input": {
          px: 0.25,
          py: 0,
          textAlign
        },
        "& .MuiInputBase-input:focus": {
          borderRadius: 0.5,
          outline: "1px solid rgba(47, 95, 155, 0.5)"
        }
      }}
    />
  );
}

function parseEditableNumber(value: string): number | null {
  const normalizedValue = value.trim().replace(/,/g, "");
  if (!normalizedValue) {
    return null;
  }

  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatEditableNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "";
  }

  return Number(value.toPrecision(6)).toString();
}

function activityRangeStep(range: DrugGraphActivityRange) {
  const span = range.max - range.min;
  if (!Number.isFinite(span) || span <= 0) {
    return 1;
  }

  return Number((span / 100_000).toPrecision(12));
}

function LegendItem({
  item,
  interactive,
  active,
  onToggle
}: {
  item: DrugRepurposingLegendItem;
  interactive: boolean;
  active: boolean;
  onToggle: () => void;
}) {
  const displayColor =
    item.dashRatio !== undefined ? darkenColor(stripAlpha(item.color), 0.5) : item.color;
  const displayFadedColor =
    item.dashRatio !== undefined
      ? darkenColor(stripAlpha(item.fadedColor ?? item.color), 0.5)
      : item.fadedColor ?? item.color;
  const content = (
    <Stack
      direction="row"
      spacing={1.25}
      sx={{
        alignItems: "center",
        width: "100%",
        opacity: active ? 1 : 0.35
      }}
    >
      {item.dashRatio !== undefined ? (
        <Box sx={{ display: "flex", width: 42, height: 6, overflow: "hidden", borderRadius: 999 }}>
          <Box sx={{ width: `${item.dashRatio * 100}%`, backgroundColor: displayColor }} />
          <Box
            sx={{
              width: `${100 - item.dashRatio * 100}%`,
              backgroundColor: displayFadedColor
            }}
          />
        </Box>
      ) : (
        <Typography
          component="span"
          sx={{
            color: item.color,
            fontSize: 18,
            lineHeight: 1
          }}
        >
          {shapeGlyph(item.shape)}
        </Typography>
      )}
      <Typography
        variant="body2"
        sx={{ textDecoration: interactive && !active ? "line-through" : "none" }}
      >
        {item.label}
      </Typography>
    </Stack>
  );

  if (!interactive) {
    return content;
  }

  return (
    <ButtonBase
      onClick={onToggle}
      sx={{
        width: "100%",
        justifyContent: "flex-start",
        px: 0.5,
        py: 0.25,
        borderRadius: 1
      }}
    >
      {content}
    </ButtonBase>
  );
}

function createCompoundTrace(
  nodes: readonly DrugRepurposingGraphNode[],
  glyph: string,
  opacity: number
) {
  if (nodes.length === 0) {
    return null;
  }

  return {
    type: "scatter3d",
    mode: "text",
    x: nodes.map((node) => node.x),
    y: nodes.map((node) => node.y),
    z: nodes.map((node) => node.z),
    text: nodes.map(() => glyph),
    textposition: "middle center",
    textfont: {
      size: 18,
      color: withAlpha(compoundColor, opacity)
    },
    hovertext: nodes.map((node) => node.label),
    hovertemplate: "%{hovertext}<extra></extra>",
    customdata: nodes.map((node) => node.id)
  };
}

function createTargetTrace(nodes: readonly DrugRepurposingGraphNode[], opacity: number) {
  if (nodes.length === 0) {
    return null;
  }

  return {
    type: "scatter3d",
    mode: "markers",
    x: nodes.map((node) => node.x),
    y: nodes.map((node) => node.y),
    z: nodes.map((node) => node.z),
    text: nodes.map((node) => node.label),
    hovertemplate: "%{text}<extra></extra>",
    customdata: nodes.map((node) => node.id),
    marker: {
      size: 8,
      color: withAlpha(targetColor, opacity),
      symbol: "circle",
      line: {
        color: withAlpha("rgb(255, 255, 255)", opacity * 0.85),
        width: 0.8
      }
    }
  };
}

function createNodeLabelTrace(
  nodes: readonly DrugRepurposingGraphNode[],
  opacity: number,
  textposition: string
) {
  if (nodes.length === 0) {
    return null;
  }

  return {
    type: "scatter3d",
    mode: "text",
    x: nodes.map((node) => node.x),
    y: nodes.map((node) => node.y),
    z: nodes.map((node) => node.z),
    text: nodes.map((node) => formatNodeLabel(node.label)),
    textposition,
    textfont: {
      size: 11,
      color: withAlpha("rgb(44, 44, 44)", opacity)
    },
    hovertext: nodes.map((node) => node.label),
    hovertemplate: "%{hovertext}<extra></extra>",
    customdata: nodes.map((node) => node.id)
  };
}

function buildEdgeTraces(
  edge: DrugRepurposingGraphEdge,
  nodeLookup: ReadonlyMap<string, DrugRepurposingGraphNode>,
  baseOpacityMultiplier: number
) {
  const source = nodeLookup.get(edge.source);
  const target = nodeLookup.get(edge.target);
  if (!source || !target) {
    return [];
  }

  const { active, faded } = buildDashedSegments(source, target, edge.dashRatio);

  return [
    {
      type: "scatter3d",
      mode: "lines",
      x: faded.x,
      y: faded.y,
      z: faded.z,
      line: {
        color: applyOpacityMultiplier(edge.fadedColor, baseOpacityMultiplier),
        width: edge.kind === "target-target" ? 2.25 : 4.5
      },
      hoverinfo: "skip"
    },
    {
      type: "scatter3d",
      mode: "lines",
      x: active.x,
      y: active.y,
      z: active.z,
      text: active.x.map((value) => (value === null ? "" : edge.hoverText)),
      hovertemplate: "%{text}<extra></extra>",
      line: {
        color: applyOpacityMultiplier(edge.color, baseOpacityMultiplier),
        width: edge.kind === "target-target" ? 3.25 : 6.5
      }
    }
  ];
}

function createSphereWireframeTraces(radius: number, color: string, opacity: number) {
  const traces: Record<string, unknown>[] = [];
  const latitudeAngles = [-60, -35, -10, 10, 35, 60];
  const longitudeAngles = [0, 30, 60, 90, 120, 150];

  for (const latitude of latitudeAngles) {
    traces.push(createSphereRingTrace(buildLatitudeRing(radius, latitude), color, opacity));
  }

  for (const longitude of longitudeAngles) {
    traces.push(createSphereRingTrace(buildLongitudeRing(radius, longitude), color, opacity));
  }

  return traces;
}

function createSphereRingTrace(
  ring: { x: number[]; y: number[]; z: number[] },
  color: string,
  opacity: number
) {
  return {
    type: "scatter3d",
    mode: "lines",
    x: ring.x,
    y: ring.y,
    z: ring.z,
    line: {
      color: withAlpha(color, opacity),
      width: 1.2
    },
    hoverinfo: "skip"
  };
}

function buildLatitudeRing(radius: number, latitudeDegrees: number) {
  const latitudeRadians = (latitudeDegrees * Math.PI) / 180;
  const ringRadius = radius * Math.cos(latitudeRadians);
  const y = radius * Math.sin(latitudeRadians);
  const x: number[] = [];
  const yValues: number[] = [];
  const z: number[] = [];

  for (let step = 0; step <= 72; step += 1) {
    const angle = (step / 72) * Math.PI * 2;
    x.push(ringRadius * Math.cos(angle));
    yValues.push(y);
    z.push(ringRadius * Math.sin(angle));
  }

  return { x, y: yValues, z };
}

function buildLongitudeRing(radius: number, longitudeDegrees: number) {
  const longitudeRadians = (longitudeDegrees * Math.PI) / 180;
  const x: number[] = [];
  const y: number[] = [];
  const z: number[] = [];

  for (let step = 0; step <= 72; step += 1) {
    const angle = (step / 72) * Math.PI * 2;
    x.push(radius * Math.sin(angle) * Math.cos(longitudeRadians));
    y.push(radius * Math.cos(angle));
    z.push(radius * Math.sin(angle) * Math.sin(longitudeRadians));
  }

  return { x, y, z };
}

function buildDashedSegments(
  source: DrugRepurposingGraphNode,
  target: DrugRepurposingGraphNode,
  dashRatio: number
) {
  const distance = Math.sqrt(
    (source.x - target.x) ** 2 + (source.y - target.y) ** 2 + (source.z - target.z) ** 2
  );
  const cycleCount = Math.max(6, Math.min(22, Math.round(distance / 0.28)));
  const cycleLength = 1 / cycleCount;
  const activeLength = cycleLength * dashRatio;

  const active = createSegmentBuffer();
  const faded = createSegmentBuffer();

  for (let index = 0; index < cycleCount; index += 1) {
    const start = index * cycleLength;
    const mid = Math.min(1, start + activeLength);
    const end = Math.min(1, (index + 1) * cycleLength);

    appendSegment(active, interpolatePoint(source, target, start), interpolatePoint(source, target, mid));
    appendSegment(faded, interpolatePoint(source, target, mid), interpolatePoint(source, target, end));
  }

  return { active, faded };
}

function interpolatePoint(
  source: DrugRepurposingGraphNode,
  target: DrugRepurposingGraphNode,
  fraction: number
) {
  return {
    x: source.x + (target.x - source.x) * fraction,
    y: source.y + (target.y - source.y) * fraction,
    z: source.z + (target.z - source.z) * fraction
  };
}

function createSegmentBuffer() {
  return {
    x: [] as Array<number | null>,
    y: [] as Array<number | null>,
    z: [] as Array<number | null>
  };
}

function appendSegment(
  buffer: ReturnType<typeof createSegmentBuffer>,
  start: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number }
) {
  buffer.x.push(start.x, end.x, null);
  buffer.y.push(start.y, end.y, null);
  buffer.z.push(start.z, end.z, null);
}

function buildNodeMenuActions(node: DrugRepurposingGraphNode): NodeMenuAction[] {
  if (node.kind === "compound" && node.compoundCid) {
    return [
      {
        label: "Open PubChem Compound",
        href: `https://pubchem.ncbi.nlm.nih.gov/compound/${encodeURIComponent(node.compoundCid)}`
      }
    ];
  }

  return [
    {
      label: "Search in Target/Predictor/Gene",
      navigation: { page: "target", tab: "Predictor", gene: node.label }
    },
    {
      label: "Search in Target/Signature/Gene",
      navigation: { page: "target", tab: "Signature", gene: node.label }
    },
    {
      label: "Search in Networks",
      navigation: { page: "network", gene: node.label }
    },
    {
      label: "Search in Drug/Prioritized Targets",
      navigation: { page: "drug", tab: "M6", query: node.label }
    }
  ];
}

function formatActivityHoverLine(activity: DrugRepurposingGraphActivity) {
  return `${activity.type} = ${formatNumber(activity.value)}`;
}

function shapeGlyph(shape: DrugRepurposingLegendItem["shape"]) {
  if (shape === "triangle") {
    return "▲";
  }

  if (shape === "square") {
    return "■";
  }

  return "●";
}

function average(values: readonly number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageColor(colors: readonly string[]) {
  const channels = colors
    .map(parseColorChannels)
    .filter((value): value is [number, number, number] => value !== null);

  if (channels.length === 0) {
    return compoundColor;
  }

  return `rgb(${Math.round(average(channels.map((value) => value[0])))}, ${Math.round(
    average(channels.map((value) => value[1]))
  )}, ${Math.round(average(channels.map((value) => value[2])))})`;
}

function darkenColor(color: string, multiplier: number) {
  const channels = parseColorChannels(color);
  if (!channels) {
    return color;
  }

  return `rgb(${Math.round(channels[0] * multiplier)}, ${Math.round(
    channels[1] * multiplier
  )}, ${Math.round(channels[2] * multiplier)})`;
}

function darkenColorPreserveAlpha(color: string, multiplier: number) {
  return withAlpha(darkenColor(stripAlpha(color), multiplier), parseColorAlpha(color));
}

function stripAlpha(color: string) {
  const channels = parseColorChannels(color);
  if (!channels) {
    return color;
  }

  return `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`;
}

function withAlpha(color: string, alpha: number) {
  const channels = parseColorChannels(color);
  if (!channels) {
    return color;
  }

  return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
}

function applyOpacityMultiplier(color: string, multiplier: number) {
  const channels = parseColorChannels(color);
  if (!channels) {
    return color;
  }

  const alpha = parseColorAlpha(color);
  return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha * multiplier})`;
}

function parseColorChannels(color: string): [number, number, number] | null {
  const match = color.match(/\d+/g);
  if (!match || match.length < 3) {
    return null;
  }

  return [
    Number.parseInt(match[0], 10),
    Number.parseInt(match[1], 10),
    Number.parseInt(match[2], 10)
  ];
}

function parseColorAlpha(color: string) {
  const rgbaMatch = color.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([0-9.]+)\s*\)/i);
  if (!rgbaMatch) {
    return 1;
  }

  return Number.parseFloat(rgbaMatch[1]) || 1;
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) {
    return String(value);
  }

  const normalized = Number(value.toPrecision(4));
  const text = normalized.toString();
  if (!/[eE]/.test(text)) {
    return text;
  }

  const scientific = normalized.toExponential(4);
  const [mantissaText, exponentText] = scientific.split("e");
  const mantissa = mantissaText.replace(/\.?0+$/, "");
  const exponent = Number(exponentText);
  return `${mantissa} x 10${toSuperscript(exponent)}`;
}

function toSuperscript(value: number) {
  return String(value)
    .replace(/-/g, "\u207b")
    .replace(/0/g, "\u2070")
    .replace(/1/g, "\u00b9")
    .replace(/2/g, "\u00b2")
    .replace(/3/g, "\u00b3")
    .replace(/4/g, "\u2074")
    .replace(/5/g, "\u2075")
    .replace(/6/g, "\u2076")
    .replace(/7/g, "\u2077")
    .replace(/8/g, "\u2078")
    .replace(/9/g, "\u2079");
}

function formatNodeLabel(label: string) {
  return `<b>${label}</b>`;
}

function normalizeText(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function resolveSelectionOverlay(
  container: HTMLDivElement | null,
  nodeId: string,
  event?: { clientX?: number; clientY?: number }
): SelectionOverlayState | null {
  if (!container) {
    return null;
  }

  const bounds = container.getBoundingClientRect();
  const fallbackLeft = Math.max(36, Math.min(bounds.width - 36, bounds.width / 2));
  const fallbackTop = Math.max(36, Math.min(bounds.height - 36, bounds.height / 2));
  const rawLeft =
    typeof event?.clientX === "number" ? event.clientX - bounds.left : fallbackLeft;
  const rawTop =
    typeof event?.clientY === "number" ? event.clientY - bounds.top : fallbackTop;

  return {
    nodeId,
    left: Math.max(36, Math.min(bounds.width - 36, rawLeft)),
    top: Math.max(48, Math.min(bounds.height - 24, rawTop))
  };
}

function computeMaxPpiDepth(graph: DrugRepurposingGraphData | null) {
  if (!graph) {
    return 0;
  }

  const targetNodeIds = graph.nodes
    .filter((node) => node.kind === "target")
    .map((node) => node.id);
  if (targetNodeIds.length === 0) {
    return 0;
  }

  const neighborsById = new Map<string, Set<string>>();
  for (const edge of graph.edges) {
    if (edge.kind !== "target-target") {
      continue;
    }

    getOrCreateNeighborSet(neighborsById, edge.source).add(edge.target);
    getOrCreateNeighborSet(neighborsById, edge.target).add(edge.source);
  }

  let maxDepth = 0;
  for (const startId of targetNodeIds) {
    const queue = [{ nodeId: startId, depth: 0 }];
    const visited = new Set([startId]);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        break;
      }

      maxDepth = Math.max(maxDepth, current.depth);
      for (const neighborId of neighborsById.get(current.nodeId) ?? []) {
        if (visited.has(neighborId)) {
          continue;
        }

        visited.add(neighborId);
        queue.push({ nodeId: neighborId, depth: current.depth + 1 });
      }
    }
  }

  return maxDepth;
}

function getOrCreateNeighborSet(map: Map<string, Set<string>>, key: string) {
  let values = map.get(key);
  if (!values) {
    values = new Set<string>();
    map.set(key, values);
  }
  return values;
}
