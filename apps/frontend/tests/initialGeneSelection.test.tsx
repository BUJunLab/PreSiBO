import { CssBaseline, ThemeProvider } from "@mui/material";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchTargetFilterOptions, fetchNetworkFilterOptions, fetchTable } = vi.hoisted(() => ({
  fetchTargetFilterOptions: vi.fn(async () => ({
    genes: ["APOE", "C4A"],
    selections: [],
    analyses: []
  })),
  fetchNetworkFilterOptions: vi.fn(async () => ({
    genes: ["APOE", "C4A"],
    moduleIds: ["M6"],
    sources: ["Bulk RNA-seq"]
  })),
  fetchTable: vi.fn(async () => ({
    columns: ["Module ID", "Omics Source", "Discovery Study"],
    filename: "table",
    rows: []
  }))
}));

vi.mock("../src/api/client", () => ({
  fetchTargetFilterOptions,
  fetchNetworkFilterOptions,
  fetchTable
}));

import { GeneNetworkLookupPanel } from "../src/features/network/GeneNetworkLookupPanel";
import { TargetPage } from "../src/features/target/TargetPage";
import {
  AppNavigationProvider,
  type AppNavigationIntent,
  type PageKey
} from "../src/navigation/AppNavigationContext";
import { appTheme } from "../src/theme";

interface TestNavigationValue {
  activePage: PageKey;
  activeTabLabel: string;
  initialGene?: string | null;
  sharedGene?: string | null;
  setSharedGene?: (gene: string | null) => void;
  navigate: (page: PageKey) => void;
  setActiveTabLabel: (label: string) => void;
  navigationIntent: AppNavigationIntent | null;
  requestNavigation: (intent: Omit<AppNavigationIntent, "id">) => void;
}

function TargetWithSharedGene() {
  const [sharedGene, setSharedGene] = useState<string | null>("APOE");

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <AppNavigationProvider
        value={{
          ...baseNavigationValue,
          initialGene: "APOE",
          sharedGene,
          setSharedGene,
          navigationIntent: { id: 1, page: "target", tab: "Predictor", gene: "APOE" }
        }}
      >
        <TargetPage />
      </AppNavigationProvider>
    </ThemeProvider>
  );
}

function NetworkWithSharedGene() {
  const [sharedGene, setSharedGene] = useState<string | null>("APOE");

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <AppNavigationProvider
        value={{
          ...baseNavigationValue,
          initialGene: "APOE",
          sharedGene,
          setSharedGene
        }}
      >
        <GeneNetworkLookupPanel />
      </AppNavigationProvider>
    </ThemeProvider>
  );
}

const baseNavigationValue: TestNavigationValue = {
  activePage: "target",
  activeTabLabel: "Predictor",
  navigate: vi.fn(),
  setActiveTabLabel: vi.fn(),
  navigationIntent: null,
  requestNavigation: vi.fn()
};

function renderWithNavigation(
  ui: ReactNode,
  navigationOverrides: Partial<TestNavigationValue> = {}
) {
  render(
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <AppNavigationProvider value={{ ...baseNavigationValue, ...navigationOverrides }}>
        {ui}
      </AppNavigationProvider>
    </ThemeProvider>
  );
}

describe("initial landing gene selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses an unrestricted landing gene as the initial Target predictor and signature gene", async () => {
    renderWithNavigation(<TargetPage />, {
      navigationIntent: {
        id: 1,
        page: "target",
        tab: "Predictor",
        gene: "NR2E1"
      }
    });

    expect(await screen.findByDisplayValue("NR2E1")).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchTable).toHaveBeenCalledWith(
        "/targets/predictors",
        expect.objectContaining({ gene: ["NR2E1"] }),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    );
  });

  it("automatically searches modules for an initial network lookup gene", async () => {
    renderWithNavigation(<GeneNetworkLookupPanel />, {
      initialGene: "NR2E1"
    });

    expect(await screen.findByDisplayValue("NR2E1")).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchTable).toHaveBeenCalledWith(
        "/networks/signature-guided",
        { gene: ["NR2E1"] },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    );
  });

  it("uses the current shared gene in network lookup fields", async () => {
    renderWithNavigation(<GeneNetworkLookupPanel />, {
      initialGene: "NR2E1",
      sharedGene: "APOE"
    });

    expect(await screen.findByDisplayValue("APOE")).toBeInTheDocument();
  });

  it("keeps a cleared Target gene empty and shows guidance instead of restoring the landing gene", async () => {
    render(<TargetWithSharedGene />);

    const input = await screen.findByRole("textbox", { name: "Gene" });
    fireEvent.change(input, { target: { value: "" } });

    await waitFor(() => expect(input).toHaveValue(""));
    expect(await screen.findByText("Enter a gene name to view records.")).toBeInTheDocument();
  });

  it("clears the shared network lookup when the current gene is emptied", async () => {
    render(<NetworkWithSharedGene />);

    const input = await screen.findByRole("textbox", { name: "Find modules by gene" });
    fireEvent.change(input, { target: { value: "" } });

    await waitFor(() => expect(input).toHaveValue(""));
    expect(
      await screen.findByText("Choose a gene to see the modules and methods that contain it.")
    ).toBeInTheDocument();
  });
});
