import { CssBaseline, ThemeProvider } from "@mui/material";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompoundDetailDialog } from "../src/features/drug/CompoundDetailDialog";
import { AppNavigationProvider } from "../src/navigation/AppNavigationContext";
import { appTheme } from "../src/theme";

describe("CompoundDetailDialog", () => {
  it("renders every line from multi-value cells without table compaction", () => {
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
          <CompoundDetailDialog
            open
            onClose={vi.fn()}
            columns={["Compound Name", "Prioritized Targets"]}
            row={{
              "Compound Name": "Example Compound",
              "Prioritized Targets": "GABBR1|GABRG1"
            }}
          />
        </AppNavigationProvider>
      </ThemeProvider>
    );

    expect(screen.getByText("GABBR1")).toBeInTheDocument();
    expect(screen.getByText("GABRG1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View all (2)" })).not.toBeInTheDocument();
  });
});
