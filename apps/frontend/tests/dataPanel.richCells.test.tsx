import { CssBaseline, ThemeProvider } from "@mui/material";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { TableResult } from "../src/api/types";
import { DataPanel } from "../src/components/common/DataPanel";
import { AppNavigationProvider } from "../src/navigation/AppNavigationContext";
import { appTheme } from "../src/theme";

function renderDataPanel(table: TableResult) {
  return render(
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
        <DataPanel
          title="Drug repurposing results"
          loading={false}
          error={null}
          table={table}
        />
      </AppNavigationProvider>
    </ThemeProvider>
  );
}

describe("DataPanel rich cells", () => {
  it("renders direct CID links and labeled menu actions", async () => {
    renderDataPanel({
            columns: ["Compound CID", "Clinical Trials"],
            filename: "drug_repurposing_all",
            rows: [
              {
                "Compound CID": {
                  kind: "rich",
                  lines: [
                    {
                      text: "119",
                      href: "https://pubchem.ncbi.nlm.nih.gov/compound/119"
                    }
                  ],
                  exportText: "119"
                },
                "Clinical Trials": {
                  kind: "rich",
                  lines: [
                    {
                      text: "Chronic Pain (Phase 2)",
                      actions: [
                        {
                          label: "ClinicalTrials.gov",
                          href: "https://clinicaltrials.gov/study/NCT04683640"
                        }
                      ]
                    }
                  ],
                  exportText: "Chronic Pain (Phase 2)"
                }
              }
            ]
          });

    expect(screen.getByText("119")).toHaveAttribute(
      "href",
      "https://pubchem.ncbi.nlm.nih.gov/compound/119"
    );

    fireEvent.click(screen.getByRole("button", { name: /Chronic Pain \(Phase2\)/i }));
    expect(await screen.findByRole("menuitem", { name: "ClinicalTrials.gov" })).toBeInTheDocument();
  });

  it("renders pipe-delimited plain strings as multiline cell content", () => {
    renderDataPanel({
            columns: ["Prioritized Targets"],
            filename: "drug_repurposing_all",
            rows: [{ "Prioritized Targets": "GABBR1|GABRG1" }]
          });

    expect(screen.queryByText("GABBR1")).not.toBeInTheDocument();
    expect(screen.queryByText("GABRG1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View all (2)" }));

    expect(screen.getByText("GABBR1")).toBeInTheDocument();
    expect(screen.getByText("GABRG1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));

    expect(screen.queryByText("GABBR1")).not.toBeInTheDocument();
    expect(screen.queryByText("GABRG1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View all (2)" })).toBeInTheDocument();
  });

  it("uses one header-derived default width for every column", () => {
    renderDataPanel({
            columns: ["ID", "Longest Column Header"],
            filename: "drug_repurposing_all",
            rows: [
              {
                ID: "This cell value is much longer than either column header",
                "Longest Column Header": "value"
              }
            ]
          });

    const shortHeader = screen.getByRole("columnheader", { name: /ID/i });
    const longHeader = screen.getByRole("columnheader", { name: /Longest Column Header/i });

    expect(shortHeader.style.width).not.toBe("");
    expect(shortHeader.style.width).toBe(longHeader.style.width);
  });

  it("expands only a truncated column when its ellipsis is clicked", () => {
    const longValue = "This compound name is substantially wider than the default table column";

    renderDataPanel({
            columns: ["Name", "Status"],
            filename: "drug_repurposing_all",
            rows: [{ Name: longValue, Status: "Ready" }]
          });

    const nameHeader = screen.getByRole("columnheader", { name: /Name/i });
    const statusHeader = screen.getByRole("columnheader", { name: /Status/i });
    const initialNameWidth = nameHeader.style.width;
    const initialStatusWidth = statusHeader.style.width;

    fireEvent.click(
      screen.getByRole("button", { name: "Expand Name column to fit this value" })
    );

    expect(nameHeader.style.width).not.toBe(initialNameWidth);
    expect(statusHeader.style.width).toBe(initialStatusWidth);
  });
});
