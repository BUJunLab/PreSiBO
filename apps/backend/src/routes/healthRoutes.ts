import { Router } from "express";

import { pingDatabase } from "../lib/db.js";
import { asyncHandler } from "../utils/http.js";

const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    status: "ok"
  });
});

healthRouter.get(
  "/database",
  asyncHandler(async (_req, res) => {
    await pingDatabase();
    res.json({ status: "ok" });
  })
);

export { healthRouter };
