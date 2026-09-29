import { Router } from "express";

import {
  getAvailableDrugModuleIds,
  getDiseaseAreaBreakdown,
  getNetworkFilterOptions,
  getGeneProfilesNetworkTable,
  getModuleDrugsTable,
  getNetworkGuidedDrugNetworksTable,
  getNetworkGuidedDrugsTable,
  getNetworkProfileTable,
  getPrsAssociationsTable,
  getSignatureGuidedNetworksTable
} from "../services/networkService.js";
import {
  asyncHandler,
  optionalNumber,
  optionalStringList,
  requiredString,
  sendTableResponse
} from "../utils/http.js";

const networkRouter = Router();

networkRouter.get(
  "/signature-guided",
  asyncHandler(async (req, res) => {
    const zMin = optionalNumber(req.query.zMin, -99999) ?? -99999;
    const genes = optionalStringList(req.query.gene);
    const sources = optionalStringList(req.query.source);
    const moduleIds = optionalStringList(req.query.moduleId);
    const table = await getSignatureGuidedNetworksTable({
      genes,
      sources,
      moduleIds,
      zMin
    });
    await sendTableResponse(res, table, String(req.query.format ?? ""));
  })
);

networkRouter.get(
  "/signature-guided/:networkId/profile",
  asyncHandler(async (req, res) => {
    const networkId = requiredString(req.params.networkId, "networkId");
    const table = await getNetworkProfileTable(networkId);
    await sendTableResponse(res, table, String(req.query.format ?? ""));
  })
);

networkRouter.get(
  "/gene-profiles",
  asyncHandler(async (req, res) => {
    const genes = optionalStringList(req.query.gene);
    const sources = optionalStringList(req.query.source);
    const moduleIds = optionalStringList(req.query.moduleId);
    const table = await getGeneProfilesNetworkTable({ genes, sources, moduleIds });
    await sendTableResponse(res, table, String(req.query.format ?? ""));
  })
);

networkRouter.get(
  "/gene-profiles/:networkId/prs-associations",
  asyncHandler(async (req, res) => {
    const networkId = requiredString(req.params.networkId, "networkId");
    const pMax = optionalNumber(req.query.pMax, 1) ?? 1;
    const table = await getPrsAssociationsTable(networkId, pMax);
    await sendTableResponse(res, table, String(req.query.format ?? ""));
  })
);

networkRouter.get(
  "/network-guided-drugs",
  asyncHandler(async (req, res) => {
    const gene = requiredString(req.query.gene, "gene");
    const source = String(req.query.source ?? "All");
    const table = await getNetworkGuidedDrugNetworksTable(gene, source);
    await sendTableResponse(res, table, String(req.query.format ?? ""));
  })
);

networkRouter.get(
  "/network-guided-drugs/:networkId/drugs",
  asyncHandler(async (req, res) => {
    const networkId = requiredString(req.params.networkId, "networkId");
    const table = await getNetworkGuidedDrugsTable(networkId);
    await sendTableResponse(res, table, String(req.query.format ?? ""));
  })
);

networkRouter.get(
  "/network-guided-drugs/:networkId/disease-area-breakdown",
  asyncHandler(async (req, res) => {
    const networkId = requiredString(req.params.networkId, "networkId");
    const slices = await getDiseaseAreaBreakdown(networkId);
    res.json({ slices });
  })
);

networkRouter.get(
  "/options",
  asyncHandler(async (req, res) => {
    const zMin = optionalNumber(req.query.zMin, -99999) ?? -99999;
    const genes = optionalStringList(req.query.gene);
    const sources = optionalStringList(req.query.source);
    const moduleIds = optionalStringList(req.query.moduleId);
    const options = await getNetworkFilterOptions({
      genes,
      sources,
      moduleIds,
      zMin
    });
    res.json(options);
  })
);

networkRouter.get(
  "/modules",
  asyncHandler(async (_req, res) => {
    const modules = await getAvailableDrugModuleIds();
    res.json({ modules });
  })
);

networkRouter.get(
  "/modules/:moduleId/drugs",
  asyncHandler(async (req, res) => {
    const moduleId = requiredString(req.params.moduleId, "moduleId");
    const query = String(req.query.query ?? "");
    const table = await getModuleDrugsTable(moduleId, query);
    await sendTableResponse(res, table, String(req.query.format ?? ""));
  })
);

export { networkRouter };
