import { Button, CssBaseline, Stack, ThemeProvider } from "@mui/material";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { GeneSearchField } from "../src/components/common/GeneSearchField";
import { appTheme } from "../src/theme";

function StrictGeneSelection() {
  const [gene, setGene] = useState<string | null>(null);
  return (
    <Stack>
      <GeneSearchField
        label="Search genes"
        value={gene}
        onChange={setGene}
      />
      <Button disabled={!gene}>Explore Target</Button>
    </Stack>
  );
}

describe("landing gene selection", () => {
  it("enables exploration after typing any non-empty gene", async () => {
    render(
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <StrictGeneSelection />
      </ThemeProvider>
    );

    const input = screen.getByRole("textbox", { name: "Search genes" });
    const button = screen.getByRole("button", { name: "Explore Target" });
    expect(button).toBeDisabled();

    fireEvent.change(input, { target: { value: "NR2E1" } });
    expect(button).toBeEnabled();

    fireEvent.change(input, { target: { value: "" } });
    expect(button).toBeDisabled();
  });

  it("submits a gene search when Enter is pressed", () => {
    const onSubmit = vi.fn();
    render(
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <GeneSearchField label="Search genes" value="APOE" onChange={vi.fn()} onSubmit={onSubmit} />
      </ThemeProvider>
    );

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Search genes" }), { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
