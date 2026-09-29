export type ActivityDirection = "lower" | "higher";

export interface ParsedActivityValue {
  raw: string;
  displayText: string;
  target: string | null;
  type: string | null;
  comparator: string | null;
  valueText: string | null;
  numericValue: number | null;
  direction: ActivityDirection | null;
}

const activityDirections: Record<string, ActivityDirection> = {
  AC50: "lower",
  Activity: "higher",
  EC50: "lower",
  fIC50: "lower",
  GI50: "lower",
  IC50: "lower",
  INH: "higher",
  Kd: "lower",
  Ki: "lower",
  Km: "lower",
  Potency: "higher"
};

const comparisonOperators = ["<=", ">=", "!=", "=", "<", ">"] as const;
const knownActivityTypes = Object.keys(activityDirections).sort((left, right) => {
  return right.length - left.length;
});

export function splitPipeDelimitedText(value: unknown): string[] {
  const text = normalizeText(value);
  if (!text) {
    return [];
  }

  return text
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function normalizePhase(value: string | number | null | undefined): string | null {
  const text = normalizeText(value);
  return text ? text.replace(/^phase\s+/i, "") : null;
}

export function parseActivityText(value: string | null): ParsedActivityValue[] {
  return splitPipeDelimitedText(value).map(parseActivityEntry);
}

export function getActivityDirection(type: string): ActivityDirection | null {
  return activityDirections[type] ?? null;
}

function parseActivityEntry(value: string): ParsedActivityValue {
  const raw = value.trim();
  const match = raw.match(/^(.*?)\s*\((.+)\)$/);

  if (!match) {
    return {
      raw,
      displayText: raw,
      target: null,
      type: null,
      comparator: null,
      valueText: null,
      numericValue: null,
      direction: null
    };
  }

  const target = normalizeText(match[1]);
  const descriptor = normalizeText(match[2]);
  if (!target || !descriptor) {
    return {
      raw,
      displayText: raw,
      target: target ?? null,
      type: null,
      comparator: null,
      valueText: null,
      numericValue: null,
      direction: null
    };
  }

  const compactDescriptor = descriptor.replace(/\s+/g, "");
  const activityType = findActivityType(compactDescriptor);
  if (!activityType) {
    return {
      raw,
      displayText: `${target} (${descriptor})`,
      target,
      type: null,
      comparator: null,
      valueText: null,
      numericValue: null,
      direction: null
    };
  }

  const remainder = compactDescriptor.slice(activityType.length);
  const matchedComparator = comparisonOperators.find((operator) => {
    return remainder.startsWith(operator);
  });
  const comparator = matchedComparator ?? "=";
  const valueText = (
    matchedComparator ? remainder.slice(matchedComparator.length) : remainder
  ).trim();
  const numericValue = valueText ? Number.parseFloat(valueText) : Number.NaN;

  return {
    raw,
    displayText: valueText
      ? `${target} (${activityType}${comparator}${valueText})`
      : `${target} (${activityType})`,
    target,
    type: activityType,
    comparator,
    valueText: valueText || null,
    numericValue: Number.isFinite(numericValue) ? numericValue : null,
    direction: activityDirections[activityType]
  };
}

function findActivityType(value: string): string | null {
  const lowerValue = value.toLowerCase();
  for (const activityType of knownActivityTypes) {
    if (lowerValue.startsWith(activityType.toLowerCase())) {
      return activityType;
    }
  }

  return null;
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}
