export interface TableNavigationAction {
  page: "about" | "target" | "network" | "geneProfiles" | "drug";
  tab?: string;
  gene?: string;
  query?: string;
}

export interface TableCellAction {
  label: string;
  kind?: "link" | "navigate" | "detail";
  href?: string;
  navigation?: TableNavigationAction;
  detailId?: string;
}

export interface RichTableCellLine {
  text: string;
  href?: string;
  actions?: TableCellAction[];
  clickAction?: TableCellAction;
  imageUrl?: string;
  imageAlt?: string;
}

export interface RichTableCell {
  kind: "rich";
  lines: RichTableCellLine[];
  exportText: string;
}

export type TableCell = string | number | boolean | null | RichTableCell;

export type TableRow = Record<string, TableCell>;

export interface TableResult {
  columns: string[];
  rows: TableRow[];
  filename: string;
}

export interface DonutSlice {
  label: string;
  value: number;
}

export interface DrugRepurposingLegendItem {
  key: string;
  label: string;
  color: string;
  fadedColor?: string;
  dashRatio?: number;
  shape?: "circle" | "triangle" | "square";
}

export interface DrugRepurposingLegendSection {
  title: string;
  items: DrugRepurposingLegendItem[];
}

export interface DrugRepurposingGraphNode {
  id: string;
  label: string;
  kind: "compound" | "target";
  color: string;
  phase?: "2" | "3" | "4" | null;
  compoundCid?: string | null;
  x: number;
  y: number;
  z: number;
}

export interface DrugRepurposingGraphActivity {
  type: string;
  value: number;
  dashRatio: number;
}

export interface DrugRepurposingGraphEdge {
  id: string;
  source: string;
  target: string;
  kind: "compound-target" | "target-target";
  legendKey: string;
  color: string;
  fadedColor: string;
  dashRatio: number;
  hoverText: string;
  weight: number;
  activities?: DrugRepurposingGraphActivity[];
}

export interface DrugRepurposingGraph {
  title: string;
  nodes: DrugRepurposingGraphNode[];
  edges: DrugRepurposingGraphEdge[];
  legend: DrugRepurposingLegendSection[];
}
