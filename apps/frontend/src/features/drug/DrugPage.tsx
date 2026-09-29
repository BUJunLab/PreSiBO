import { useEffect, useState } from "react";
import { Paper, Stack, Tab, Tabs } from "@mui/material";

import {
  fetchDrugRepurposingDetail,
  fetchDrugRepurposingGraph,
  fetchTable
} from "../../api/client";
import type { DrugRepurposingGraph, TableRow } from "../../api/types";
import { DrugRepurposingGraph as DrugRepurposingGraphPanel } from "../../components/charts/DrugRepurposingGraph";
import { useAsyncResource } from "../../api/useAsyncResource";
import { DataPanel } from "../../components/common/DataPanel";
import { SearchHeader } from "../../components/common/SearchHeader";
import { getSortableCellText } from "../../components/common/tableCellUtils";
import { useAppNavigation } from "../../navigation/AppNavigationContext";
import { GeneNetworkLookupPanel } from "../network/GeneNetworkLookupPanel";
import { CollapsibleSection } from "./CollapsibleSection";
import { CompoundDetailDialog } from "./CompoundDetailDialog";
import { DrugRepurposingCharts } from "./DrugRepurposingCharts";

const activeTab = {
  label: "M6",
  path: "/drugs/repurposing",
  title: "M6 Drug Repurposing Results"
} as const;

export function DrugPage() {
  const { navigationIntent, setActiveTabLabel } = useAppNavigation();
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [detailRow, setDetailRow] = useState<TableRow | null>(null);
  const [detailCompoundCid, setDetailCompoundCid] = useState<string | null>(null);
  const [visibleRepurposingRows, setVisibleRepurposingRows] = useState<TableRow[]>([]);
  const [sectionExpanded, setSectionExpanded] = useState({
    table: true,
    network: false,
    overview: false,
    activity: false,
    disease: false,
    clinical: false
  });

  const repurposing = useAsyncResource(
    (signal, onRetry) => fetchTable("/drugs/repurposing", { query }, { signal, onRetry }),
    [query]
  );
  const repurposingGraph = useAsyncResource(
    (signal, onRetry) =>
      fetchDrugRepurposingGraph("/drugs/repurposing/graph", { query }, { signal, onRetry }),
    [query],
    { enabled: sectionExpanded.network }
  );
  const repurposingDetail = useAsyncResource(
    (signal, onRetry) =>
      fetchDrugRepurposingDetail(detailCompoundCid ?? "", query, { signal, onRetry }),
    [detailCompoundCid, query],
    { enabled: Boolean(detailCompoundCid) }
  );
  const clinicalTrialSummary = useAsyncResource(
    (signal, onRetry) =>
      fetchTable("/drugs/repurposing/clinical-summary", { query }, { signal, onRetry }),
    [query],
    { enabled: sectionExpanded.clinical }
  );

  useEffect(() => {
    setActiveTabLabel(activeTab.label);
  }, [setActiveTabLabel]);

  useEffect(() => {
    if (navigationIntent?.page !== "drug") {
      return;
    }

    if (navigationIntent.query) {
      setDraftQuery(navigationIntent.query);
      setQuery(navigationIntent.query);
    }
  }, [navigationIntent]);

  useEffect(() => {
    setVisibleRepurposingRows(repurposing.data?.rows ?? []);
  }, [repurposing.data]);

  // The graph endpoint is already scoped to the same search query as the table.
  // Do not derive a second graph from the grid's virtualized visible-row state:
  // that state is temporarily empty while the grid mounts and could incorrectly
  // turn a populated graph into an empty one.
  const filteredRepurposingGraph = repurposingGraph.data;
  const displayedDetailRow = repurposingDetail.data?.rows[0] ?? detailRow;
  const displayedDetailColumns = repurposingDetail.data?.columns ?? repurposing.data?.columns ?? [];

  return (
    <>
      <Stack spacing={3}>
        <GeneNetworkLookupPanel />

        <Paper className="panel-card" sx={{ p: 1 }}>
          <Tabs value={0}>
            <Tab label={activeTab.label} />
          </Tabs>
        </Paper>

        <SearchHeader
          placeholder="Search any values, names or keywords in the table"
          value={draftQuery}
          onChange={setDraftQuery}
          onSearch={() => setQuery(draftQuery)}
        />

        <CollapsibleSection
          title="Results Table"
          expanded={sectionExpanded.table}
          onChange={(expanded) => {
            setSectionExpanded((current) => ({ ...current, table: expanded }));
          }}
        >
          <DataPanel
            title={activeTab.title}
            table={repurposing.data}
            loading={repurposing.loading}
            retrying={repurposing.retrying}
            error={repurposing.error}
            onRetry={repurposing.retry}
            onCellAction={({ action, row }) => {
              if (action.kind === "detail" && action.detailId === "compound-record") {
                setDetailRow(row);
                setDetailCompoundCid(getSortableCellText(row["Compound CID"]).trim() || null);
              }
            }}
            onVisibleRowsChange={setVisibleRepurposingRows}
          />
        </CollapsibleSection>
        <CollapsibleSection
          title="3D Network"
          expanded={sectionExpanded.network}
          onChange={(expanded) => {
            setSectionExpanded((current) => ({ ...current, network: expanded }));
          }}
        >
          <DrugRepurposingGraphPanel
            graph={filteredRepurposingGraph}
            loading={repurposingGraph.loading}
            error={repurposingGraph.error}
            onCompoundDetailRequest={(compoundCid) => {
              const matchingRow = visibleRepurposingRows.find(
                (row) => getSortableCellText(row["Compound CID"]).trim() === compoundCid
              );
              if (!matchingRow) {
                return;
              }

              setDetailRow(matchingRow);
              setDetailCompoundCid(compoundCid);
            }}
          />
        </CollapsibleSection>
        <DrugRepurposingCharts
          rows={visibleRepurposingRows}
          clinicalTrialRows={clinicalTrialSummary.data?.rows ?? []}
          clinicalLoading={clinicalTrialSummary.loading}
          clinicalError={clinicalTrialSummary.error}
          expanded={{
            overview: sectionExpanded.overview,
            activity: sectionExpanded.activity,
            disease: sectionExpanded.disease,
            clinical: sectionExpanded.clinical
          }}
          onToggleSection={(section, expanded) => {
            setSectionExpanded((current) => ({ ...current, [section]: expanded }));
          }}
        />
      </Stack>
      <CompoundDetailDialog
        open={Boolean(detailRow)}
        row={displayedDetailRow}
        columns={displayedDetailColumns}
        loading={repurposingDetail.loading}
        error={repurposingDetail.error}
        onRetry={repurposingDetail.retry}
        onClose={() => {
          setDetailRow(null);
          setDetailCompoundCid(null);
        }}
      />
    </>
  );
}
