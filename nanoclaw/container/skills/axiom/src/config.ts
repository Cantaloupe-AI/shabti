/**
 * Axiom API Configuration
 * Read-only operations only
 */

export const AXIOM_CONFIG = {
  /** Base URL for APL query endpoint (v1) */
  queryApiUrl: 'https://api.axiom.co/v1',
  /** Base URL for dataset/management endpoints (v2) */
  managementApiUrl: 'https://api.axiom.co/v2',
  /** Default dataset from env */
  defaultDataset: 'vercel-logs',
  /** Default query limit */
  defaultLimit: 50,
  /** Max query limit */
  maxLimit: 1000,
  /** Default time range for queries (1 hour) */
  defaultTimeRange: '1h',
} as const;
