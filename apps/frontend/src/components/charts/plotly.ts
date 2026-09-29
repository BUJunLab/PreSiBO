import { createElement, lazy, Suspense, type ComponentType } from "react";

interface DefaultWrappedModule {
  default?: unknown;
}

function unwrapDefaultExport(value: unknown): unknown {
  let current = value;
  const visited = new Set<unknown>();

  // Vite can expose CommonJS default exports as nested module objects.
  while (
    current &&
    typeof current === "object" &&
    "default" in (current as DefaultWrappedModule) &&
    !visited.has(current)
  ) {
    visited.add(current);
    const next = (current as DefaultWrappedModule).default;
    if (next === undefined || next === current) {
      break;
    }
    current = next;
  }

  return current;
}

const LazyPlotlyChart = lazy(async () => {
  const module = await import("react-plotly.js");
  return {
    default: unwrapDefaultExport(module) as ComponentType<Record<string, unknown>>
  };
});

export function PlotlyChart(props: Record<string, unknown>) {
  return createElement(
    Suspense,
    { fallback: createElement("div", { style: { minHeight: 180 } }) },
    createElement(LazyPlotlyChart, props)
  );
}
