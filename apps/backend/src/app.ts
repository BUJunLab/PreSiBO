import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import cors from "cors";
import express from "express";

import { loadAppConfig } from "./config/env.js";
import { drugRouter } from "./routes/drugRoutes.js";
import { healthRouter } from "./routes/healthRoutes.js";
import { networkRouter } from "./routes/networkRoutes.js";
import { targetRouter } from "./routes/targetRoutes.js";

export function buildApp() {
  const app = express();
  const allowedOrigins = loadAppConfig()
    .corsOrigin.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  const frontendDistPath = resolveFirstExistingPath([
    path.resolve(currentDirectory, "..", "..", "frontend", "dist"),
    path.resolve(process.cwd(), "frontend", "dist"),
    path.resolve(process.cwd(), "New", "frontend", "dist"),
    path.resolve(process.cwd(), "..", "frontend", "dist")
  ]);

  app.use(
    cors({
      origin: allowedOrigins
    })
  );
  app.use(express.json());

  app.get("/api", (_req, res) => {
    res.json({
      name: "PreSiBO Lite Backend",
      version: "1.0.1"
    });
  });

  app.use("/api/health", healthRouter);
  app.use("/api/targets", targetRouter);
  app.use("/api/networks", networkRouter);
  app.use("/api/drugs", drugRouter);
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API route not found." });
  });

  if (frontendDistPath) {
    app.use(express.static(frontendDistPath));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(frontendDistPath, "index.html"));
    });
  }

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const isValidationError = error instanceof Error && /is required\.|Expected a numeric value/.test(error.message);
    res.status(isValidationError ? 400 : 500).json({
      error: isValidationError ? error.message : "Unable to process this request."
    });
  });

  return app;
}

function resolveFirstExistingPath(candidates: readonly string[]) {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}
