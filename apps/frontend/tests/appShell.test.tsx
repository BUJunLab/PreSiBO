import { CssBaseline, ThemeProvider } from "@mui/material";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "../src/components/layout/AppShell";
import { appTheme } from "../src/theme";

describe("AppShell", () => {
  it("keeps the sidebar toggle button visible and toggles its state", () => {
    render(
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <AppShell
          activeKey="about"
          items={[
            { key: "about", label: "About" },
            { key: "drug", label: "Drug" }
          ]}
          onHome={vi.fn()}
          onNavigate={vi.fn()}
        >
          <div>Page</div>
        </AppShell>
      </ThemeProvider>
    );

    const openButton = screen.getByRole("button", { name: "Open sidebar" });
    fireEvent.click(openButton);
    expect(
      screen.getByRole("button", { name: "Collapse sidebar", hidden: true })
    ).toBeInTheDocument();
  });
});
