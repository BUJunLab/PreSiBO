import type {
  DonutResponse,
  DrugModuleListResponse,
  DrugRepurposingGraph,
  NetworkFilterOptions,
  TableResult
} from "./types";
import type { TargetFilterOptions } from "./types";

const apiRoot = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");
const transientStatusCodes = new Set([429, 502, 503, 504]);
const maximumRetryDelayMs = 30_000;

export interface ReadRequestOptions {
  signal?: AbortSignal;
  onRetry?: () => void;
}

function buildUrl(
  path: string,
  params?: Record<string, string | number | readonly string[] | undefined>
) {
  const url = new URL(`${apiRoot}${path}`, window.location.origin);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === "") {
      return;
    }

    if (Array.isArray(value)) {
      if (value.length > 0) {
        url.searchParams.set(key, value.join(","));
      }
      return;
    }

    url.searchParams.set(key, String(value));
  });
  return url;
}

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new HttpError(payload?.error || `Request failed with status ${response.status}`, response.status);
  }

  return (await response.json()) as T;
}

function isTransientReadError(error: unknown) {
  if (error instanceof HttpError) {
    return transientStatusCodes.has(error.status);
  }

  return error instanceof TypeError;
}

function waitForRetry(attempt: number, signal?: AbortSignal) {
  const exponentialDelayMs = 500 * 2 ** Math.min(attempt, 6);
  const baseDelayMs = Math.min(maximumRetryDelayMs, exponentialDelayMs);
  const jitterMs = Math.floor(Math.random() * 250);
  return new Promise<void>((resolve, reject) => {
    const handleAbort = () => {
      window.clearTimeout(timeoutId);
      reject(signal?.reason);
    };
    const timeoutId = window.setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, baseDelayMs + jitterMs);
    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

async function fetchReadJson<T>(url: URL, options?: ReadRequestOptions): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      // Results can change when the local backend switches between the
      // fixture and RDS configurations. Do not reuse a stale graph/table
      // response from the browser's HTTP cache.
      return await readJson<T>(await fetch(url, { signal: options?.signal, cache: "no-store" }));
    } catch (error) {
      if (options?.signal?.aborted || !isTransientReadError(error)) {
        throw error;
      }
      options?.onRetry?.();
      await waitForRetry(attempt, options?.signal);
    }
  }
}

export async function fetchTable(
  path: string,
  params?: Record<string, string | number | readonly string[] | undefined>,
  options?: ReadRequestOptions
): Promise<TableResult> {
  return fetchReadJson<TableResult>(buildUrl(path, params), options);
}

export async function fetchDrugRepurposingGraph(
  path: string,
  params?: Record<string, string | number | readonly string[] | undefined>,
  options?: ReadRequestOptions
): Promise<DrugRepurposingGraph> {
  return fetchReadJson<DrugRepurposingGraph>(buildUrl(path, params), options);
}

export async function fetchDrugRepurposingDetail(
  compoundCid: string,
  query: string,
  options?: ReadRequestOptions
): Promise<TableResult> {
  return fetchTable(
    `/drugs/repurposing/${encodeURIComponent(compoundCid)}`,
    { query },
    options
  );
}

export async function fetchDonut(
  path: string,
  params?: Record<string, string | number | readonly string[] | undefined>,
  options?: ReadRequestOptions
): Promise<DonutResponse> {
  return fetchReadJson<DonutResponse>(buildUrl(path, params), options);
}

export async function fetchNetworkFilterOptions(
  params?: Record<string, string | number | readonly string[] | undefined>,
  options?: ReadRequestOptions
): Promise<NetworkFilterOptions> {
  return fetchReadJson<NetworkFilterOptions>(buildUrl("/networks/options", params), options);
}

export async function fetchTargetFilterOptions(
  params?: Record<string, string | number | readonly string[] | undefined>,
  options?: ReadRequestOptions
): Promise<TargetFilterOptions> {
  return fetchReadJson<TargetFilterOptions>(buildUrl("/targets/options", params), options);
}

export async function fetchDrugModules(options?: ReadRequestOptions): Promise<DrugModuleListResponse> {
  return fetchReadJson<DrugModuleListResponse>(buildUrl("/drugs/modules"), options);
}

export async function downloadTable(
  path: string,
  params: Record<string, string | number | readonly string[] | undefined>,
  format: "xlsx" | "csv" = "xlsx"
) {
  const response = await fetch(buildUrl(path, { ...params, format }));
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error || `Download failed with status ${response.status}`);
  }

  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const contentDisposition = response.headers.get("Content-Disposition");
  const filenameMatch = contentDisposition?.match(/filename="([^"]+)"/);
  anchor.href = href;
  anchor.download = filenameMatch?.[1] ?? `presibo-lite-export.${format}`;
  anchor.click();
  URL.revokeObjectURL(href);
}
