import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchTable } from "../src/api/client";

const table = { columns: ["Gene ID"], rows: [{ "Gene ID": "APOE" }], filename: "result" };

describe("read request retries", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps retrying transient failures until data is available", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(new Response("{}", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(table), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );
    const onRetry = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = fetchTable("/targets/predictors", undefined, { onRetry });
    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toEqual(table);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("does not retry a permanent client error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      })
    );
    const onRetry = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchTable("/targets/predictors", undefined, { onRetry })
    ).rejects.toThrow("Invalid request");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });
});
