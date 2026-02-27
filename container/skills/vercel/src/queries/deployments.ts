/**
 * Vercel Deployments API Queries
 * Read-only operations for deployment information
 */

import { vercelGet } from '../client';
import { VERCEL_CONFIG } from '../config';
import type {
  ListDeploymentsResponse,
  ListDeploymentsOptions,
  VercelDeployment,
  GetDeploymentResponse,
  ListBuildEventsResponse,
  VercelBuildEvent,
  GetBuildLogsOptions,
} from '../types';

/**
 * List deployments with optional filters
 */
export async function listDeployments(
  options: ListDeploymentsOptions = {}
): Promise<VercelDeployment[]> {
  const { projectId, state, teamId, limit = VERCEL_CONFIG.defaultLimit, target } = options;

  const response = await vercelGet<ListDeploymentsResponse>('/v6/deployments', {
    projectId,
    state,
    teamId,
    limit,
    target,
  });

  return response.deployments;
}

/**
 * Get detailed information about a specific deployment
 */
export async function getDeployment(
  idOrUrl: string,
  teamId?: string
): Promise<GetDeploymentResponse> {
  const response = await vercelGet<GetDeploymentResponse>(
    `/v13/deployments/${encodeURIComponent(idOrUrl)}`,
    { teamId }
  );

  return response;
}

/**
 * Get build logs/events for a deployment
 */
export async function getBuildLogs(
  idOrUrl: string,
  options: GetBuildLogsOptions = {}
): Promise<VercelBuildEvent[]> {
  const { limit } = options;

  // The events endpoint returns build logs
  const response = await vercelGet<ListBuildEventsResponse>(
    `/v3/deployments/${encodeURIComponent(idOrUrl)}/events`,
    { limit }
  );

  return response.events || [];
}

/**
 * Format build logs for display
 */
export function formatBuildLogs(events: VercelBuildEvent[]): string {
  return events
    .map((event) => {
      const timestamp = new Date(event.created).toISOString();
      const prefix = event.type === 'stderr' ? '[ERR]' : event.type === 'command' ? '[CMD]' : '';
      const text = event.payload.text || '';
      return `${timestamp} ${prefix} ${text}`.trim();
    })
    .filter((line) => line.length > 0)
    .join('\n');
}
