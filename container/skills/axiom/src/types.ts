/**
 * Axiom API Response Types
 */

// ============================================================================
// Dataset Types
// ============================================================================

export interface AxiomDataset {
  id: string;
  name: string;
  description: string;
  created: string;
  who: string;
  kind: string;
  canWrite: boolean;
  retentionDays: number;
  useRetentionPeriod: boolean;
}

// ============================================================================
// Field Types
// ============================================================================

export interface AxiomField {
  name: string;
  type: string;
  description?: string;
  hidden?: boolean;
  unit?: string;
}

// ============================================================================
// Query Types
// ============================================================================

export interface AxiomQueryRequest {
  apl: string;
  startTime?: string;
  endTime?: string;
  cursor?: string;
  includeCursor?: boolean;
}

export interface AxiomQueryStatus {
  elapsedTime: number;
  blocksExamined: number;
  rowsExamined: number;
  rowsMatched: number;
  numGroups: number;
  isPartial: boolean;
  isEstimate: boolean;
  minBlockTime: string;
  maxBlockTime: string;
}

export interface AxiomQueryTable {
  name: string;
  sources: { name: string }[];
  fields: { name: string; type: string }[];
  order: { field: string; desc: boolean }[];
  groups: { name: string }[];
  range?: { field: string; start: string; end: string };
  columns: unknown[][];
}

export interface AxiomQueryResponse {
  format: string;
  status: AxiomQueryStatus;
  tables: AxiomQueryTable[];
  datasetNames: string[];
  fieldsMetaMap: Record<string, { description?: string; unit?: string }>;
}

// ============================================================================
// Error Types
// ============================================================================

export interface AxiomApiError {
  error: {
    code: string;
    message: string;
  };
}
