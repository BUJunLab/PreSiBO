import type {
  DrugRepurposingGraph,
  DrugRepurposingGraphEdge,
  DrugRepurposingGraphNode
} from "../../api/types";

export interface DrugGraphVisibilityOptions {
  highlightedNodeIds: ReadonlySet<string>;
  hiddenNodeIds: ReadonlySet<string>;
  ppiDepth: number;
}

export interface DrugGraphVisibilityResult {
  nodes: DrugRepurposingGraphNode[];
  edges: DrugRepurposingGraphEdge[];
  nodeOpacityById: Map<string, number>;
  edgeOpacityById: Map<string, number>;
}

interface HighlightClasses {
  primaryGeneIds: Set<string>;
  primaryCompoundIds: Set<string>;
  geneDepthById: Map<string, number>;
  compoundOpacityById: Map<string, number>;
  ppiDepth: number;
}

export function applyDrugGraphVisibility(
  graph: DrugRepurposingGraph | null,
  options: DrugGraphVisibilityOptions
): DrugGraphVisibilityResult | null {
  if (!graph) {
    return null;
  }

  const baseNodes = graph.nodes.filter((node) => !options.hiddenNodeIds.has(node.id));
  const baseNodeIds = new Set(baseNodes.map((node) => node.id));
  const baseEdges = graph.edges.filter(
    (edge) => baseNodeIds.has(edge.source) && baseNodeIds.has(edge.target)
  );
  const highlightedNodeIds = [...options.highlightedNodeIds].filter((nodeId) =>
    baseNodeIds.has(nodeId)
  );

  if (highlightedNodeIds.length === 0) {
    const pruned = pruneIsolatedGraph(baseNodes, baseEdges);
    return {
      nodes: pruned.nodes,
      edges: pruned.edges,
      nodeOpacityById: new Map(pruned.nodes.map((node) => [node.id, 1])),
      edgeOpacityById: new Map(pruned.edges.map((edge) => [edge.id, 1]))
    };
  }

  const classes = classifyHighlightedNodes(
    baseNodes,
    baseEdges,
    highlightedNodeIds,
    options.ppiDepth
  );
  const visibleNodeIds = new Set<string>([
    ...classes.primaryGeneIds,
    ...classes.primaryCompoundIds,
    ...classes.geneDepthById.keys(),
    ...classes.compoundOpacityById.keys()
  ]);
  const edges = baseEdges.filter((edge) => resolveEdgeOpacity(edge, classes) > 0);
  const connectedNodeIds = new Set<string>();

  for (const edge of edges) {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  }

  const nodes = baseNodes.filter(
    (node) => visibleNodeIds.has(node.id) && connectedNodeIds.has(node.id)
  );
  const nodeOpacityById = new Map<string, number>();
  const edgeOpacityById = new Map<string, number>();

  for (const node of nodes) {
    if (classes.primaryGeneIds.has(node.id) || classes.primaryCompoundIds.has(node.id)) {
      nodeOpacityById.set(node.id, 1);
      continue;
    }

    if (node.kind === "target") {
      const degree = classes.geneDepthById.get(node.id);
      if (degree !== undefined) {
        nodeOpacityById.set(node.id, opacityForDegree(degree, classes.ppiDepth));
      }
      continue;
    }

    const compoundOpacity = classes.compoundOpacityById.get(node.id);
    if (compoundOpacity !== undefined) {
      nodeOpacityById.set(node.id, compoundOpacity);
    }
  }

  for (const edge of edges) {
    edgeOpacityById.set(edge.id, resolveEdgeOpacity(edge, classes));
  }

  return {
    nodes,
    edges,
    nodeOpacityById,
    edgeOpacityById
  };
}

function classifyHighlightedNodes(
  nodes: readonly DrugRepurposingGraphNode[],
  edges: readonly DrugRepurposingGraphEdge[],
  highlightedNodeIds: readonly string[],
  ppiDepth: number
): HighlightClasses {
  const nodeLookup = new Map(nodes.map((node) => [node.id, node]));
  const highlightedGeneRoots = new Set<string>();
  const highlightedCompoundRoots = new Set<string>();

  for (const nodeId of highlightedNodeIds) {
    const node = nodeLookup.get(nodeId);
    if (node?.kind === "target") {
      highlightedGeneRoots.add(nodeId);
    }
    if (node?.kind === "compound") {
      highlightedCompoundRoots.add(nodeId);
    }
  }

  const primaryGeneIds = new Set<string>(highlightedGeneRoots);
  const primaryCompoundIds = new Set<string>(highlightedCompoundRoots);

  for (const edge of edges) {
    if (edge.kind !== "compound-target") {
      continue;
    }

    if (highlightedGeneRoots.has(edge.target)) {
      primaryCompoundIds.add(edge.source);
    }

    if (highlightedCompoundRoots.has(edge.source)) {
      primaryGeneIds.add(edge.target);
    }
  }

  const geneDepthById = buildGeneDepthMap(primaryGeneIds, edges, ppiDepth);
  const compoundOpacityById = buildCompoundOpacityMap(
    primaryCompoundIds,
    geneDepthById,
    edges,
    ppiDepth
  );

  return {
    primaryGeneIds,
    primaryCompoundIds,
    geneDepthById,
    compoundOpacityById,
    ppiDepth
  };
}

function buildGeneDepthMap(
  primaryGeneIds: ReadonlySet<string>,
  edges: readonly DrugRepurposingGraphEdge[],
  maxDepth: number
) {
  const depthById = new Map<string, number>();
  if (maxDepth <= 0 || primaryGeneIds.size === 0) {
    return depthById;
  }

  const neighborsByGeneId = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (edge.kind !== "target-target") {
      continue;
    }

    getOrCreateSet(neighborsByGeneId, edge.source).add(edge.target);
    getOrCreateSet(neighborsByGeneId, edge.target).add(edge.source);
  }

  const queue = [...primaryGeneIds].map((nodeId) => ({ nodeId, depth: 0 }));
  const visited = new Set(primaryGeneIds);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    if (current.depth >= maxDepth) {
      continue;
    }

    for (const neighborId of neighborsByGeneId.get(current.nodeId) ?? []) {
      if (visited.has(neighborId)) {
        continue;
      }

      const nextDepth = current.depth + 1;
      visited.add(neighborId);
      depthById.set(neighborId, nextDepth);
      queue.push({ nodeId: neighborId, depth: nextDepth });
    }
  }

  return depthById;
}

function buildCompoundOpacityMap(
  primaryCompoundIds: ReadonlySet<string>,
  geneDepthById: ReadonlyMap<string, number>,
  edges: readonly DrugRepurposingGraphEdge[],
  ppiDepth: number
) {
  const opacityById = new Map<string, number>();

  for (const edge of edges) {
    if (edge.kind !== "compound-target" || primaryCompoundIds.has(edge.source)) {
      continue;
    }

    const degree = geneDepthById.get(edge.target);
    if (degree === undefined) {
      continue;
    }

    const nextOpacity = opacityForDegree(degree, ppiDepth);
    opacityById.set(edge.source, Math.max(opacityById.get(edge.source) ?? 0, nextOpacity));
  }

  return opacityById;
}

function resolveEdgeOpacity(edge: DrugRepurposingGraphEdge, classes: HighlightClasses) {
  if (edge.kind === "target-target") {
    const leftDegree = resolveGeneDegree(edge.source, classes);
    const rightDegree = resolveGeneDegree(edge.target, classes);
    if (leftDegree === null || rightDegree === null) {
      return 0;
    }

    if (leftDegree === 0 && rightDegree === 0) {
      return 1;
    }

    if (Math.abs(leftDegree - rightDegree) !== 1) {
      return 0;
    }

    return opacityForDegree(Math.min(leftDegree, rightDegree), classes.ppiDepth);
  }

  const targetDegree = resolveGeneDegree(edge.target, classes);
  if (targetDegree === null) {
    return 0;
  }

  if (targetDegree === 0) {
    return classes.primaryCompoundIds.has(edge.source) ? 1 : 0;
  }

  if (
    classes.primaryCompoundIds.has(edge.source) ||
    classes.compoundOpacityById.has(edge.source)
  ) {
    return opacityForDegree(targetDegree, classes.ppiDepth);
  }

  return 0;
}

function resolveGeneDegree(nodeId: string, classes: HighlightClasses) {
  if (classes.primaryGeneIds.has(nodeId)) {
    return 0;
  }

  return classes.geneDepthById.get(nodeId) ?? null;
}

function opacityForDegree(degree: number, maxDepth: number) {
  if (degree <= 0 || maxDepth <= 0) {
    return 1;
  }

  return 1 - (0.5 * degree) / maxDepth;
}

function getOrCreateSet(map: Map<string, Set<string>>, key: string) {
  let values = map.get(key);
  if (!values) {
    values = new Set<string>();
    map.set(key, values);
  }
  return values;
}

function pruneIsolatedGraph(
  nodes: readonly DrugRepurposingGraphNode[],
  edges: readonly DrugRepurposingGraphEdge[]
) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  let nextEdges = [...edges];

  while (true) {
    const degreeByNodeId = new Map<string, number>(
      [...nodeMap.keys()].map((nodeId) => [nodeId, 0])
    );

    for (const edge of nextEdges) {
      degreeByNodeId.set(edge.source, (degreeByNodeId.get(edge.source) ?? 0) + 1);
      degreeByNodeId.set(edge.target, (degreeByNodeId.get(edge.target) ?? 0) + 1);
    }

    const isolatedNodeIds = [...degreeByNodeId.entries()]
      .filter(([, degree]) => degree === 0)
      .map(([nodeId]) => nodeId);

    if (isolatedNodeIds.length === 0) {
      break;
    }

    const isolatedSet = new Set(isolatedNodeIds);
    for (const nodeId of isolatedNodeIds) {
      nodeMap.delete(nodeId);
    }
    nextEdges = nextEdges.filter(
      (edge) => !isolatedSet.has(edge.source) && !isolatedSet.has(edge.target)
    );

    if (nodeMap.size === 0 || nextEdges.length === 0) {
      break;
    }
  }

  return {
    nodes: [...nodeMap.values()],
    edges: nextEdges
  };
}
