import type {
  DonutFigureData,
  SunburstFigureData,
  SunburstNodeData
} from "./drugRepurposingInsights";

export interface NumberedChartEntry {
  key: string;
  label: string;
  value: number;
  percentage: number;
  color: string;
  rank: number;
  badgeText: string;
  plotText: string;
  hoverText: string;
}

export interface DonutChartPresentation {
  entries: NumberedChartEntry[];
  height: number;
  outerLabelMargin: number;
}

export interface TieredDonutPresentation {
  innerEntries: NumberedChartEntry[];
  outerEntries: NumberedChartEntry[];
  legendEntries: NumberedChartEntry[];
  height: number;
  outerLabelMargin: number;
}

const minChartHeight = 420;
const maxChartHeight = 660;
const maxPlotLabelLength = 30;

export function buildDonutPresentation(figure: DonutFigureData): DonutChartPresentation {
  const sortedSlices = [...figure.slices]
    .filter((slice) => slice.value > 0)
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));
  const total = sortedSlices.reduce((sum, slice) => sum + slice.value, 0);
  const palette = generateHsvPalette(sortedSlices.length, 0.68, 0.84);

  const entries = sortedSlices.map((slice, index) => {
    const percentage = total > 0 ? slice.value / total : 0;
    const badgeText = getCircledNumber(index + 1);
    const plotLabel = `${badgeText} ${truncateLabel(slice.label, maxPlotLabelLength)} (${formatChartValue(slice.value)} | ${formatChartPercent(percentage)})`;

    return {
      key: slice.label,
      label: slice.label,
      value: slice.value,
      percentage,
      color: palette[index],
      rank: index + 1,
      badgeText,
      plotText: plotLabel,
      hoverText: buildHoverText(slice.label, slice.value, percentage, slice.hoverDetail)
    } satisfies NumberedChartEntry;
  });

  return {
    entries,
    height: computeAdaptiveChartHeight(entries.length),
    outerLabelMargin: computeOuterLabelMargin(entries)
  };
}

export function buildTieredDonutPresentation(
  figure: SunburstFigureData
): TieredDonutPresentation {
  const innerNodes = figure.nodes.filter((node) => node.parent === "");
  const outerNodes = figure.nodes.filter((node) => node.parent !== "");
  const total = innerNodes.reduce((sum, node) => sum + node.value, 0);
  const legendNodes = [...figure.nodes]
    .filter((node) => node.value > 0)
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));
  const palette = generateHsvPalette(legendNodes.length, 0.7, 0.86);
  const colorByNodeId = new Map(
    legendNodes.map((node, index) => [node.id, palette[index]])
  );
  const rankByNodeId = new Map(legendNodes.map((node, index) => [node.id, index + 1]));

  const innerEntries = innerNodes
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label))
    .map((node) => createTierEntry(node, total, colorByNodeId, rankByNodeId));

  const outerEntries = outerNodes
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label))
    .map((node) => createTierEntry(node, total, colorByNodeId, rankByNodeId, node.parent));

  const legendEntries = legendNodes.map((node) =>
    createTierEntry(node, total, colorByNodeId, rankByNodeId, node.parent || undefined)
  );

  return {
    innerEntries,
    outerEntries,
    legendEntries,
    height: computeAdaptiveChartHeight(Math.max(innerEntries.length, outerEntries.length)),
    outerLabelMargin: computeOuterLabelMargin(outerEntries)
  };
}

function createTierEntry(
  node: SunburstNodeData,
  total: number,
  colorByNodeId: ReadonlyMap<string, string>,
  rankByNodeId: ReadonlyMap<string, number>,
  parentLabel?: string
): NumberedChartEntry {
  const percentage = total > 0 ? node.value / total : 0;
  const rank = rankByNodeId.get(node.id) ?? 1;
  const badgeText = getCircledNumber(rank);
  const legendLabel = parentLabel ? `${parentLabel} / ${node.label}` : node.label;

  return {
    key: node.id,
    label: legendLabel,
    value: node.value,
    percentage,
    color: colorByNodeId.get(node.id) ?? node.color,
    rank,
    badgeText,
    plotText: `${badgeText} ${truncateLabel(node.label, maxPlotLabelLength)}`,
    hoverText: buildHoverText(legendLabel, node.value, percentage)
  };
}

function computeAdaptiveChartHeight(itemCount: number) {
  const normalized = 1 - Math.exp(-0.24 * Math.max(0, itemCount - 1));
  return Math.round(minChartHeight + (maxChartHeight - minChartHeight) * normalized);
}

function computeOuterLabelMargin(entries: readonly NumberedChartEntry[]) {
  const longestLabelLength = entries.reduce((longest, entry) => {
    return Math.max(longest, entry.plotText.length);
  }, 0);

  return clamp(48 + longestLabelLength * 3, 72, 180);
}

function buildHoverText(
  label: string,
  value: number,
  percentage: number,
  detail?: string
) {
  const lines = [
    label,
    `Value: ${formatChartValue(value)}`,
    `Percent: ${formatChartPercent(percentage)}`
  ];

  if (detail) {
    lines.push(detail);
  }

  return lines.join("<br>");
}

function generateHsvPalette(count: number, saturation: number, value: number) {
  if (count <= 0) {
    return [];
  }

  return Array.from({ length: count }, (_value, index) => {
    const hue = (index / count) * 360;
    return hsvToHex(hue, saturation, value);
  });
}

function hsvToHex(hue: number, saturation: number, value: number) {
  const chroma = value * saturation;
  const huePrime = hue / 60;
  const secondary = chroma * (1 - Math.abs((huePrime % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;

  if (huePrime >= 0 && huePrime < 1) {
    red = chroma;
    green = secondary;
  } else if (huePrime < 2) {
    red = secondary;
    green = chroma;
  } else if (huePrime < 3) {
    green = chroma;
    blue = secondary;
  } else if (huePrime < 4) {
    green = secondary;
    blue = chroma;
  } else if (huePrime < 5) {
    red = secondary;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondary;
  }

  const match = value - chroma;
  return toHex(red + match, green + match, blue + match);
}

function toHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue]
    .map((channel) => Math.round(channel * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function truncateLabel(label: string, maxLength: number) {
  if (label.length <= maxLength) {
    return label;
  }

  return `${label.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

export function formatChartValue(value: number) {
  return Number(value.toFixed(2)).toString();
}

export function formatChartPercent(value: number) {
  const percentage = value * 100;
  if (!Number.isFinite(percentage) || percentage === 0) {
    return "0%";
  }

  if (Math.abs(percentage) < 0.01) {
    return `${percentage.toExponential(2)}%`;
  }

  return `${Number(percentage.toPrecision(3)).toString()}%`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getCircledNumber(value: number) {
  const enclosed = [
    "",
    "①",
    "②",
    "③",
    "④",
    "⑤",
    "⑥",
    "⑦",
    "⑧",
    "⑨",
    "⑩",
    "⑪",
    "⑫",
    "⑬",
    "⑭",
    "⑮",
    "⑯",
    "⑰",
    "⑱",
    "⑲",
    "⑳",
    "㉑",
    "㉒",
    "㉓",
    "㉔",
    "㉕",
    "㉖",
    "㉗",
    "㉘",
    "㉙",
    "㉚",
    "㉛",
    "㉜",
    "㉝",
    "㉞",
    "㉟",
    "㊱",
    "㊲",
    "㊳",
    "㊴",
    "㊵",
    "㊶",
    "㊷",
    "㊸",
    "㊹",
    "㊺",
    "㊻",
    "㊼",
    "㊽",
    "㊾",
    "㊿"
  ];

  return enclosed[value] ?? `(${value})`;
}
