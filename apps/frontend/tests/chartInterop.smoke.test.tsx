import { CssBaseline, ThemeProvider } from "@mui/material";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DonutChart } from "../src/components/charts/DonutChart";
import { SmokeStepTracker } from "../src/testing/smoke";
import { appTheme } from "../src/theme";

const sampleDonut = {
  slices: [
    { label: "Neurology", value: 5 },
    { label: "Immunology", value: 2 }
  ]
};

function renderWithTheme(element: React.ReactElement) {
  return render(
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      {element}
    </ThemeProvider>
  );
}

async function runRenderWithTimeout(renderLabel: string, renderCallback: () => void) {
  await Promise.race([
    Promise.resolve().then(renderCallback),
    new Promise<never>((_resolve, reject) => {
      setTimeout(() => {
        reject(new Error(`${renderLabel} timed out`));
      }, 2_000);
    })
  ]);
}

describe("chart interop smoke", () => {
  it("renders the donut chart panel when plotly is provided through a default export wrapper", async () => {
    const tracker = new SmokeStepTracker();
    tracker.step("start");

    await runRenderWithTimeout("donut chart render", () => {
      expect(() =>
        renderWithTheme(
          <DonutChart
            title="Module Drug Breakdown"
            data={sampleDonut}
            loading={false}
            error={null}
          />
        )
      ).not.toThrow();
    });
    tracker.step("rendered");

    expect(screen.getByText("Module Drug Breakdown")).toBeInTheDocument();
    expect(tracker.records.map((record) => record.name)).toEqual(["start", "rendered"]);
  });
});
