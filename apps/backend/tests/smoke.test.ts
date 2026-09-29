import request from "supertest";
import { describe, expect, it } from "vitest";

import { SmokeStepTracker, runWithTimeout } from "../src/testing/smoke.js";

describe("backend smoke", () => {
  it("serves the unauthenticated health endpoint", async () => {
    process.env.DB_HOST = "smoke-test-host";
    process.env.DB_USER = "smoke-test-user";

    const { buildApp } = await import("../src/app.js");
    const tracker = new SmokeStepTracker();
    tracker.step("start");

    const app = buildApp();
    tracker.step("app_built");

    const response = await runWithTimeout(
      "health request",
      request(app).get("/api/health"),
      10_000
    );
    tracker.step("health_checked");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(tracker.records.map((record) => record.name)).toEqual([
      "start",
      "app_built",
      "health_checked"
    ]);
  });

  it("restricts cross-origin API access and returns sanitized 404 responses", async () => {
    const { buildApp } = await import("../src/app.js");
    const app = buildApp();

    const allowedResponse = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:5173");
    const untrustedResponse = await request(app)
      .get("/api/health")
      .set("Origin", "https://untrusted.example");
    const missingRouteResponse = await request(app).get("/api/not-a-route");

    expect(allowedResponse.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173"
    );
    expect(untrustedResponse.headers["access-control-allow-origin"]).toBeUndefined();
    expect(missingRouteResponse.status).toBe(404);
    expect(missingRouteResponse.body).toEqual({ error: "API route not found." });
  });
});
