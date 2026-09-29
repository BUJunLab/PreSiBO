import { DependencyList, useEffect, useState } from "react";

import type { AsyncResourceState } from "./types";

interface Options<T> {
  enabled?: boolean;
  initialData?: T | null;
}

export function useAsyncResource<T>(
  loader: (signal: AbortSignal, onRetry: () => void) => Promise<T>,
  deps: DependencyList,
  options?: Options<T>
): AsyncResourceState<T> {
  const enabled = options?.enabled ?? true;
  const [state, setState] = useState<AsyncResourceState<T>>({
    data: options?.initialData ?? null,
    loading: enabled,
    retrying: false,
    error: null,
    retry: () => undefined
  });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setState({
        data: options?.initialData ?? null,
        loading: false,
        retrying: false,
        error: null,
        retry: () => setRetryCount((current) => current + 1)
      });
      return undefined;
    }

    const controller = new AbortController();
    const retry = () => setRetryCount((current) => current + 1);
    let cancelled = false;
    setState((current) => ({
      data: current.data,
      loading: true,
      retrying: false,
      error: null,
      retry
    }));

    loader(controller.signal, () => {
      if (!cancelled) {
        setState((current) => ({ ...current, retrying: true }));
      }
    })
      .then((data) => {
        if (!cancelled) {
          setState({
            data,
            loading: false,
            retrying: false,
            error: null,
            retry
          });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            data: options?.initialData ?? null,
            loading: false,
            retrying: false,
            error: "Unable to load these results.",
            retry
          });
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, ...deps, retryCount]);

  return state;
}
