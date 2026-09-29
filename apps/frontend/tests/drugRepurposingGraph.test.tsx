import { CssBaseline, ThemeProvider } from "@mui/material";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DrugRepurposingGraph as DrugRepurposingGraphData } from "../src/api/types";
import { DrugRepurposingGraph } from "../src/components/charts/DrugRepurposingGraph";
import { AppNavigationProvider } from "../src/navigation/AppNavigationContext";
import { appTheme } from "../src/theme";

const graph: DrugRepurposingGraphData = {
  title: "Drug graph",
  nodes: [
    {
      id: "compound:1",
      label: "Compound A",
      kind: "compound",
      color: "rgb(43, 109, 224)",
      phase: "2",
      compoundCid: "1",
      x: 0,
      y: 0,
      z: 0
    },
    {
      id: "target:GENE1",
      label: "GENE1",
      kind: "target",
      color: "rgb(207, 47, 47)",
      x: 1,
      y: 0,
      z: 0
    },
    {
      id: "target:GENE2",
      label: "GENE2",
      kind: "target",
      color: "rgb(207, 47, 47)",
      x: 2,
      y: 0,
      z: 0
    }
  ],
  edges: [
    {
      id: "edge-1",
      source: "compound:1",
      target: "target:GENE1",
      kind: "compound-target",
      legendKey: "compound-target-default",
      color: "rgba(128, 128, 128, 0.5)",
      fadedColor: "rgba(128, 128, 128, 0.1)",
      dashRatio: 0.5,
      hoverText: "Compound A -> GENE1",
      weight: 1,
      activities: [
        { type: "Binding", value: 1, dashRatio: 0.25 },
        { type: "Inhibition", value: 10, dashRatio: 0.75 }
      ]
    },
    {
      id: "edge-activity-range",
      source: "compound:1",
      target: "target:GENE2",
      kind: "compound-target",
      legendKey: "compound-target-default",
      color: "rgba(128, 128, 128, 0.5)",
      fadedColor: "rgba(128, 128, 128, 0.1)",
      dashRatio: 0.5,
      hoverText: "Compound A -> GENE2",
      weight: 1,
      activities: [
        { type: "Binding", value: 5, dashRatio: 0.25 },
        { type: "Inhibition", value: 20, dashRatio: 0.75 }
      ]
    },
    {
      id: "edge-2",
      source: "target:GENE1",
      target: "target:GENE2",
      kind: "target-target",
      legendKey: "target-target-string",
      color: "rgba(0, 0, 0, 0.5)",
      fadedColor: "rgba(0, 0, 0, 0.1)",
      dashRatio: 0.5,
      hoverText: "GENE1 -> GENE2",
      weight: 1
    }
  ],
  legend: [
    {
      title: "Points",
      items: [
        {
          key: "phase-2",
          label: "Phase 2 compounds",
          color: "rgb(43, 109, 224)",
          shape: "circle"
        }
      ]
    },
    {
      title: "Compound-target lines",
      items: [
        {
          key: "compound-target-default",
          label: "Known interaction without activity type",
          color: "rgba(128, 128, 128, 0.5)",
          fadedColor: "rgba(128, 128, 128, 0.1)",
          dashRatio: 0.5
        },
        {
          key: "target-target-string",
          label: "Prioritized target connectivity",
          color: "rgba(0, 0, 0, 0.5)",
          fadedColor: "rgba(0, 0, 0, 0.1)",
          dashRatio: 0.5
        },
        {
          key: "activity:Binding",
          label: "Binding",
          color: "rgba(38, 110, 190, 0.5)",
          fadedColor: "rgba(38, 110, 190, 0.1)",
          dashRatio: 0.25
        },
        {
          key: "activity:Inhibition",
          label: "Inhibition",
          color: "rgba(210, 80, 65, 0.5)",
          fadedColor: "rgba(210, 80, 65, 0.1)",
          dashRatio: 0.75
        }
      ]
    }
  ]
};

describe("DrugRepurposingGraph", () => {
  it("renders graph action buttons for names and highlighting", () => {
    render(
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <AppNavigationProvider
          value={{
            activePage: "drug",
            activeTabLabel: "M6",
            navigate: vi.fn(),
            setActiveTabLabel: vi.fn(),
            navigationIntent: null,
            requestNavigation: vi.fn()
          }}
        >
          <DrugRepurposingGraph graph={graph} loading={false} error={null} />
        </AppNavigationProvider>
      </ThemeProvider>
    );

    expect(screen.getByRole("button", { name: "Toggle Names" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Highlight genes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Highlight compounds" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PPI visibility" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Display gene names" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Display compound names" })
    ).not.toBeInTheDocument();
  });

  it("shows two-thumb activity ranges using the graph value bounds", () => {
    render(
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <AppNavigationProvider
          value={{
            activePage: "drug",
            activeTabLabel: "M6",
            navigate: vi.fn(),
            setActiveTabLabel: vi.fn(),
            navigationIntent: null,
            requestNavigation: vi.fn()
          }}
        >
          <DrugRepurposingGraph graph={graph} loading={false} error={null} />
        </AppNavigationProvider>
      </ThemeProvider>
    );

    const bindingMinimum = screen.getByRole("slider", { name: "Binding minimum" });
    const bindingMaximum = screen.getByRole("slider", { name: "Binding maximum" });
    const bindingRow = screen.getByTestId("activity-range-row-Binding");
    expect(within(bindingRow).getByRole("button", { name: "Binding" })).toBeInTheDocument();
    expect(within(bindingRow).getByRole("slider", { name: "Binding minimum" })).toBe(
      bindingMinimum
    );
    expect(within(bindingRow).getByRole("slider", { name: "Binding maximum" })).toBe(
      bindingMaximum
    );
    expect(bindingMinimum).toHaveAttribute("aria-valuemin", "1");
    expect(bindingMinimum).toHaveAttribute("aria-valuemax", "5");
    expect(bindingMinimum).toHaveAttribute("aria-valuenow", "1");
    expect(bindingMaximum).toHaveAttribute("aria-valuenow", "5");

    expect(screen.getByRole("slider", { name: "Inhibition minimum" })).toHaveAttribute(
      "aria-valuemin",
      "10"
    );
    expect(screen.getByRole("slider", { name: "Inhibition maximum" })).toHaveAttribute(
      "aria-valuemax",
      "20"
    );
  });

  it("shows a compound action button after point selection and reuses the detail callback", () => {
    const onCompoundDetailRequest = vi.fn();

    render(
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <AppNavigationProvider
          value={{
            activePage: "drug",
            activeTabLabel: "M6",
            navigate: vi.fn(),
            setActiveTabLabel: vi.fn(),
            navigationIntent: null,
            requestNavigation: vi.fn()
          }}
        >
          <DrugRepurposingGraph
            graph={graph}
            loading={false}
            error={null}
            onCompoundDetailRequest={onCompoundDetailRequest}
          />
        </AppNavigationProvider>
      </ThemeProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Plot point Compound A" }));
    fireEvent.click(screen.getByRole("button", { name: "Compound A" }));

    expect(onCompoundDetailRequest).toHaveBeenCalledWith("1");
  });

  it("offers one signature search and routes gene searches to Networks", async () => {
    const requestNavigation = vi.fn();

    render(
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <AppNavigationProvider
          value={{
            activePage: "drug",
            activeTabLabel: "M6",
            navigate: vi.fn(),
            setActiveTabLabel: vi.fn(),
            navigationIntent: null,
            requestNavigation
          }}
        >
          <DrugRepurposingGraph graph={graph} loading={false} error={null} />
        </AppNavigationProvider>
      </ThemeProvider>
    );

    const genePoint = screen.getByRole("button", { name: "Plot point target:GENE1" });
    fireEvent.mouseEnter(genePoint);
    fireEvent.contextMenu(genePoint, { clientX: 160, clientY: 220 });

    expect(await screen.findByText("Search in Target/Signature/Gene")).toBeInTheDocument();
    expect(screen.queryByText(/Differential Expression\/Gene ID/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Quantitative Trait Loci\/Gene ID/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Search in Networks"));
    expect(requestNavigation).toHaveBeenCalledWith({ page: "network", gene: "GENE1" });
  });

  it("resets toggled names and highlight selections", async () => {
    render(
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <AppNavigationProvider
          value={{
            activePage: "drug",
            activeTabLabel: "M6",
            navigate: vi.fn(),
            setActiveTabLabel: vi.fn(),
            navigationIntent: null,
            requestNavigation: vi.fn()
          }}
        >
          <DrugRepurposingGraph graph={graph} loading={false} error={null} />
        </AppNavigationProvider>
      </ThemeProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle Names" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Display gene names" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Toggle Names" })).not.toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "Highlight genes" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Highlight genes GENE1" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Highlight Genes" })).not.toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "PPI visibility" }));
    fireEvent.click(screen.getByRole("radio", { name: "1 degree" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "PPI visibility" })).not.toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset", hidden: true }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Highlight Genes" })).not.toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle Names" }));
    expect(screen.getByRole("checkbox", { name: "Display gene names" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Toggle Names" })).not.toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "Highlight genes" }));
    expect(screen.getByRole("checkbox", { name: "Highlight genes GENE1" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Highlight Genes" })).not.toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "PPI visibility" }));
    expect(screen.getByRole("radio", { name: "0 degrees" })).toBeChecked();
  });
});
