import { Router } from "express";

import type { PredictorSelection } from "../services/targetService.js";
import {
  getDifferentialExpressionTable,
  getPredictorTable,
  getTargetGeneOptions,
  getQuantitativeTraitLociTable
} from "../services/targetService.js";
import {
  asyncHandler,
  optionalNumber,
  optionalStringList,
  sendTableResponse
} from "../utils/http.js";

const targetRouter = Router();

targetRouter.get(
  "/predictors",
  asyncHandler(async (req, res) => {
    const genes = optionalStringList(req.query.gene);
    const selections = optionalStringList(req.query.selection) as PredictorSelection[];
    if (selections.length === 0) {
      throw new Error("selection is required.");
    }
    const pMax = optionalNumber(req.query.pMax, 1) ?? 1;

    const table = await getPredictorTable(genes, selections, pMax);
    await sendTableResponse(res, table, String(req.query.format ?? ""));
  })
);

targetRouter.get(
  "/signatures/diff-expression",
  asyncHandler(async (req, res) => {
    const genes = optionalStringList(req.query.gene);
    const pMax = optionalNumber(req.query.pMax, undefined);
    const table = await getDifferentialExpressionTable(genes, pMax);
    await sendTableResponse(res, table, String(req.query.format ?? ""));
  })
);

targetRouter.get(
  "/signatures/quantitative-trait-loci",
  asyncHandler(async (req, res) => {
    const genes = optionalStringList(req.query.gene);
    const pMax = optionalNumber(req.query.pMax, undefined);
    const table = await getQuantitativeTraitLociTable(genes, pMax);
    await sendTableResponse(res, table, String(req.query.format ?? ""));
  })
);

targetRouter.get(
  "/options",
  asyncHandler(async (_req, res) => {
    const selections = optionalStringList(_req.query.selection) as PredictorSelection[];
    const genes = await getTargetGeneOptions(selections);
    res.json({ genes });
  })
);

export { targetRouter };
