/**
 * Vercel API Configuration
 * Read-only operations only - no destructive actions
 */

export const VERCEL_CONFIG = {
  apiUrl: 'https://api.vercel.com',
  defaultProject: 'union',
  defaultLimit: 20,
  maxLimit: 100,
  deploymentStates: ['BUILDING', 'ERROR', 'INITIALIZING', 'QUEUED', 'READY', 'CANCELED'] as const,
} as const;

export type DeploymentState = (typeof VERCEL_CONFIG.deploymentStates)[number];
