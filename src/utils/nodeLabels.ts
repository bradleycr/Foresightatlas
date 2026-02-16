import { PrimaryNode } from "../types";

export const NODE_LABELS: Record<PrimaryNode, string> = {
  Global: "Global",
  "Berlin Node": "Berlin Node",
  "Bay Area Node": "San Francisco Node",
  Alumni: "Alumni",
};

export const getNodeLabel = (node: PrimaryNode): string => NODE_LABELS[node] || node;
