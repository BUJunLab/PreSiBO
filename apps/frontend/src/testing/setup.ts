import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("react-plotly.js", async () => {
  const React = await import("react");

  return {
    default: {
      default: (props: Record<string, unknown>) => {
        const traces = Array.isArray(props.data) ? props.data : [];
        const seen = new Set<string>();
        const points = traces.flatMap((trace) => {
          const customdata = Array.isArray((trace as { customdata?: unknown[] }).customdata)
            ? ((trace as { customdata?: unknown[] }).customdata as unknown[])
            : [];
          const hovertext = Array.isArray((trace as { hovertext?: unknown[] }).hovertext)
            ? ((trace as { hovertext?: unknown[] }).hovertext as unknown[])
            : [];

          return customdata
            .map((value, index) => {
              const id = String(value ?? "").trim();
              if (!id || seen.has(id)) return null;
              seen.add(id);
              return { id, label: String(hovertext[index] ?? value ?? "").replace(/<[^>]+>/g, "") };
            })
            .filter(Boolean) as Array<{ id: string; label: string }>;
        });

        return React.createElement(
          "div",
          { "data-testid": "plotly-chart" },
          points.map((point) =>
            React.createElement(
              "button",
              {
                key: point.id,
                type: "button",
                "aria-label": `Plot point ${point.label}`,
                onClick: () =>
                  (props.onClick as ((payload: unknown) => void) | undefined)?.({
                    points: [{ customdata: point.id }],
                    event: { clientX: 160, clientY: 220 }
                  }),
                onMouseEnter: () =>
                  (props.onHover as ((payload: unknown) => void) | undefined)?.({
                    points: [{ customdata: point.id }]
                  }),
                onMouseLeave: () =>
                  (props.onUnhover as (() => void) | undefined)?.()
              },
              point.label
            )
          )
        );
      }
    }
  };
});
