import { CssBaseline, ThemeProvider } from "@mui/material";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const {
  fetchTable,
  fetchDrugRepurposingGraph,
  fetchNetworkFilterOptions,
  downloadTable
} = vi.hoisted(() => ({
  fetchTable: vi.fn(async (path: string, params?: Record<string, string>) => ({
    columns: ["Column A"],
    filename: "drug_repurposing",
    rows: [{ "Column A": params?.query || path }]
  })),
  fetchDrugRepurposingGraph: vi.fn(async () => ({
    title: "Graph",
    nodes: [],
    edges: [],
    legend: []
  })),
  fetchNetworkFilterOptions: vi.fn(async () => ({
    genes: ["APOE"],
    moduleIds: ["M6"],
    sources: ["Bulk RNA-seq"]
  })),
  downloadTable: vi.fn()
}));

vi.mock("../src/api/client", () => ({
  fetchTable,
  fetchDrugRepurposingGraph,
  fetchNetworkFilterOptions,
  downloadTable
}));

import { DrugPage } from "../src/features/drug/DrugPage";
import { AppNavigationProvider } from "../src/navigation/AppNavigationContext";
import { appTheme } from "../src/theme";

describe("DrugPage", () => {
  it("renders a single M6 subtab with shared search", async () => {
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
          <DrugPage />
        </AppNavigationProvider>
      </ThemeProvider>
    );

    const networkLookupHeading = await screen.findByRole("heading", {
      name: "Find Networks by Gene"
    });
    const m6Tab = screen.getByRole("tab", { name: "M6", selected: true });
    expect(networkLookupHeading).toBeInTheDocument();
    expect(networkLookupHeading.compareDocumentPosition(m6Tab)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(screen.queryByRole("tab", { name: "Drug Repurposing" })).not.toBeInTheDocument();

    expect(
      screen.getByRole("textbox", {
        name: "Search any values, names or keywords in the table"
      })
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(fetchTable).toHaveBeenCalledWith(
        "/drugs/repurposing",
        { query: "" },
        expect.objectContaining({ signal: expect.any(AbortSignal), onRetry: expect.any(Function) })
      )
    );

    fireEvent.change(
      screen.getByPlaceholderText("Search any values, names or keywords in the table"),
      { target: { value: "ADCY2" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() =>
      expect(fetchTable).toHaveBeenCalledWith(
        "/drugs/repurposing",
        { query: "ADCY2" },
        expect.objectContaining({ signal: expect.any(AbortSignal), onRetry: expect.any(Function) })
      )
    );
  }, 15_000);
});
