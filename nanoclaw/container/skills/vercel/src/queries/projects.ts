/**
 * Vercel Projects API Queries
 * Read-only operations for project information
 */

import { vercelGet } from '../client';
import { VERCEL_CONFIG } from '../config';
import type {
  ListProjectsResponse,
  ListProjectsOptions,
  VercelProject,
  ListEnvVarsResponse,
  ListEnvVarsOptions,
  VercelEnvVar,
} from '../types';

/**
 * List all projects
 */
export async function listProjects(options: ListProjectsOptions = {}): Promise<VercelProject[]> {
  const { teamId, limit = VERCEL_CONFIG.defaultLimit } = options;

  const response = await vercelGet<ListProjectsResponse>('/v9/projects', {
    teamId,
    limit,
  });

  return response.projects;
}

/**
 * Get a specific project by ID or name
 */
export async function getProject(idOrName: string, teamId?: string): Promise<VercelProject> {
  const response = await vercelGet<VercelProject>(`/v9/projects/${encodeURIComponent(idOrName)}`, {
    teamId,
  });

  return response;
}

/**
 * List environment variables for a project
 * Note: decrypt is always false for security - we don't expose secret values
 */
export async function listEnvVars(
  projectIdOrName: string,
  options: ListEnvVarsOptions = {}
): Promise<VercelEnvVar[]> {
  // SECURITY: Always set decrypt to false - we never want to expose secret values
  const response = await vercelGet<ListEnvVarsResponse>(
    `/v10/projects/${encodeURIComponent(projectIdOrName)}/env`,
    {
      decrypt: 'false', // Always false for safety
    }
  );

  return response.envs;
}
