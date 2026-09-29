import { Router } from "express";

import { getAvailableDrugModuleIds, getModuleDrugsTable } from "../services/networkService.js";
import { searchDrugRepurposingGraph } from "../services/drugRepurposingGraphService.js";
import {
  getDrugRepurposingDetail,
  getDrugRepurposingClinicalSummary,
  searchDrugRepurposing
} from "../services/drugRepurposingService.js";
import { searchDrugs } from "../services/drugService.js";
import { asyncHandler, requiredString, sendTableResponse } from "../utils/http.js";

const drugRouter = Router();

drugRouter.get(
  "/repurposing",
  asyncHandler(async (req, res) => {
    const query = String(req.query.query ?? "");
    const table = await searchDrugRepurposing(query);
    await sendTableResponse(res, table, String(req.query.format ?? ""));
  })
);

drugRouter.get(
  "/repurposing/graph",
  asyncHandler(async (req, res) => {
    const query = String(req.query.query ?? "");
    const graph = await searchDrugRepurposingGraph(query);
    res.json(graph);
  })
);

drugRouter.get(
  "/repurposing/clinical-summary",
  asyncHandler(async (req, res) => {
    const table = await getDrugRepurposingClinicalSummary(String(req.query.query ?? ""));
    await sendTableResponse(res, table, String(req.query.format ?? ""));
  })
);

drugRouter.get(
  "/repurposing/:compoundCid",
  asyncHandler(async (req, res) => {
    const compoundCid = requiredString(req.params.compoundCid, "compoundCid");
    const query = String(req.query.query ?? "");
    const table = await getDrugRepurposingDetail(compoundCid, query);
    await sendTableResponse(res, table, String(req.query.format ?? ""));
  })
);

drugRouter.get(
  "/search",
  asyncHandler(async (req, res) => {
    const query = String(req.query.query ?? "");
    const table = await searchDrugs(query);
    await sendTableResponse(res, table, String(req.query.format ?? ""));
  })
);

drugRouter.get(
  "/modules",
  asyncHandler(async (_req, res) => {
    const modules = await getAvailableDrugModuleIds();
    res.json({ modules });
  })
);

drugRouter.get(
  "/modules/:moduleId",
  asyncHandler(async (req, res) => {
    const moduleId = requiredString(req.params.moduleId, "moduleId");
    const query = String(req.query.query ?? "");
    const table = await getModuleDrugsTable(moduleId, query);
    await sendTableResponse(res, table, String(req.query.format ?? ""));
  })
);

export { drugRouter };
