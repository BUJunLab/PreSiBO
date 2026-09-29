import { Alert, Box, CircularProgress, Paper, Typography } from "@mui/material";

import type { DonutResponse } from "../../api/types";
import { PlotlyChart } from "./plotly";

interface DonutChartProps {
  title: string;
  data: DonutResponse | null;
  loading: boolean;
  error: string | null;
}

export function DonutChart({ title, data, loading, error }: DonutChartProps) {
  return (
    <Paper className="panel-card" sx={{ overflow: "hidden" }}>
      <Box className="panel-card-header">
        <Typography variant="h6">{title}</Typography>
      </Box>
      <Box sx={{ p: 2, minHeight: 420 }}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {loading ? <CircularProgress size={24} /> : null}
        {!loading && !error && (data?.slices.length ?? 0) > 0 ? (
          <PlotlyChart
            data={[
              {
                type: "pie",
                labels: data?.slices.map((slice) => slice.label),
                values: data?.slices.map((slice) => slice.value),
                hole: 0.55,
                sort: false,
                marker: {
                  colors: ["#1f5f94", "#3f7fb0", "#6f9fc8", "#d97a3a", "#e4aa64", "#8bb7d6"]
                }
              }
            ]}
            layout={{
              autosize: true,
              height: 360,
              margin: { t: 10, r: 10, b: 10, l: 10 },
              paper_bgcolor: "transparent",
              plot_bgcolor: "transparent"
            }}
            style={{ width: "100%", height: "100%" }}
            config={{ displayModeBar: false, responsive: true }}
          />
        ) : null}
        {!loading && !error && (data?.slices.length ?? 0) === 0 ? (
          <Typography color="text.secondary">No launched-drug disease areas were returned.</Typography>
        ) : null}
      </Box>
    </Paper>
  );
}
