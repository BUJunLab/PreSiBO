import { fireEvent, render, screen } from "@testing-library/react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { describe, expect, it } from "vitest";

import App from "../src/App";
import { SmokeStepTracker } from "../src/testing/smoke";
import { appTheme } from "../src/theme";

describe("frontend smoke", () => {
  it("renders the initial landing page", () => {
    const tracker = new SmokeStepTracker();
    tracker.step("start");

    render(
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    );
    tracker.step("rendered");

    expect(screen.getByRole("heading", { name: "PreSiBO" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Explore Target" })).toBeDisabled();
    expect(screen.getByRole("heading", { name: "References" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Target" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Network" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Drug" })).toBeInTheDocument();
    expect(screen.queryByText("Data Sources and Methods")).not.toBeInTheDocument();
    expect(screen.queryByText("Target / Predictor")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Explore Database" }));
    expect(screen.getByText("Target / Predictor")).toBeInTheDocument();
    expect(tracker.records.map((record) => record.name)).toEqual(["start", "rendered"]);
  });
});
