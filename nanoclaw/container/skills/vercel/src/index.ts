/**
 * Vercel Skill - Barrel Exports
 * Read-only operations for Vercel deployments, projects, and teams
 */

// Config
export { VERCEL_CONFIG } from './config';
export type { DeploymentState } from './config';

// Client
export { vercelGet, vercelGetPaginated } from './client';

// Types
export type {
  VercelProject,
  ListProjectsResponse,
  VercelDeployment,
  ListDeploymentsResponse,
  GetDeploymentResponse,
  VercelBuildEvent,
  ListBuildEventsResponse,
  VercelEnvVar,
  ListEnvVarsResponse,
  VercelTeam,
  ListTeamsResponse,
  VercelApiError,
  ListProjectsOptions,
  ListDeploymentsOptions,
  GetBuildLogsOptions,
  ListEnvVarsOptions,
} from './types';

// Queries
export { listTeams } from './queries/teams';
export { listProjects, getProject, listEnvVars } from './queries/projects';
export { listDeployments, getDeployment, getBuildLogs, formatBuildLogs } from './queries/deployments';
