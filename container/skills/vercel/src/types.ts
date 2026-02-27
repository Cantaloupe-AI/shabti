/**
 * Vercel API Response Types
 * These types represent the structure of Vercel API responses
 */

import type { DeploymentState } from './config';

// ============================================================================
// Project Types
// ============================================================================

export interface VercelProject {
  id: string;
  name: string;
  accountId: string;
  framework: string | null;
  createdAt: number;
  updatedAt: number;
  latestDeployments?: VercelDeployment[];
  targets?: {
    production?: {
      alias?: string[];
      id?: string;
      url?: string;
    };
  };
  link?: {
    type: string;
    repo: string;
    repoId: number;
    org: string;
    gitCredentialId: string;
    productionBranch: string;
    createdAt: number;
    updatedAt: number;
  };
}

export interface ListProjectsResponse {
  projects: VercelProject[];
  pagination?: {
    count: number;
    next: number | null;
    prev: number | null;
  };
}

// ============================================================================
// Deployment Types
// ============================================================================

export interface VercelDeployment {
  uid: string;
  name: string;
  url: string;
  state: DeploymentState;
  type: string;
  created: number;
  createdAt: number;
  buildingAt?: number;
  ready?: number;
  readyState?: DeploymentState;
  creator?: {
    uid: string;
    email: string;
    username: string;
  };
  meta?: {
    githubCommitSha?: string;
    githubCommitMessage?: string;
    githubCommitAuthorName?: string;
    githubCommitRef?: string;
    githubDeployment?: string;
    githubOrg?: string;
    githubRepo?: string;
    branchAlias?: string;
  };
  target?: string | null;
  aliasAssigned?: number | null;
  aliasError?: { code: string; message: string } | null;
  inspectorUrl?: string;
  source?: string;
}

export interface ListDeploymentsResponse {
  deployments: VercelDeployment[];
  pagination?: {
    count: number;
    next: number | null;
    prev: number | null;
  };
}

export interface GetDeploymentResponse extends VercelDeployment {
  alias?: string[];
  aliasAssigned?: number;
  build?: {
    env?: string[];
  };
  errorCode?: string;
  errorMessage?: string;
  errorStep?: string;
}

// ============================================================================
// Build Log / Event Types
// ============================================================================

export interface VercelBuildEvent {
  type: 'stdout' | 'stderr' | 'command' | 'exit';
  created: number;
  payload: {
    text?: string;
    deploymentId?: string;
    info?: {
      type: string;
      name: string;
      entrypoint?: string;
    };
    exitCode?: number;
  };
  serial?: string;
}

export interface ListBuildEventsResponse {
  events: VercelBuildEvent[];
}

// ============================================================================
// Environment Variable Types
// ============================================================================

export interface VercelEnvVar {
  id: string;
  key: string;
  value: string;
  type: 'system' | 'secret' | 'encrypted' | 'plain' | 'sensitive';
  target: ('production' | 'preview' | 'development')[];
  gitBranch?: string;
  configurationId?: string | null;
  createdAt?: number;
  updatedAt?: number;
  createdBy?: string;
  updatedBy?: string;
  comment?: string;
}

export interface ListEnvVarsResponse {
  envs: VercelEnvVar[];
  pagination?: {
    count: number;
    next: number | null;
    prev: number | null;
  };
}

// ============================================================================
// Team Types
// ============================================================================

export interface VercelTeam {
  id: string;
  slug: string;
  name: string | null;
  avatar: string | null;
  createdAt: number;
  updatedAt: number;
  membership?: {
    role: 'OWNER' | 'MEMBER' | 'DEVELOPER' | 'BILLING' | 'VIEWER';
    confirmed: boolean;
    createdAt: number;
  };
}

export interface ListTeamsResponse {
  teams: VercelTeam[];
  pagination?: {
    count: number;
    next: number | null;
    prev: number | null;
  };
}

// ============================================================================
// Error Types
// ============================================================================

export interface VercelApiError {
  error: {
    code: string;
    message: string;
  };
}

// ============================================================================
// API Options Types
// ============================================================================

export interface ListProjectsOptions {
  teamId?: string;
  limit?: number;
}

export interface ListDeploymentsOptions {
  projectId?: string;
  state?: DeploymentState;
  teamId?: string;
  limit?: number;
  target?: 'production' | 'preview';
}

export interface GetBuildLogsOptions {
  limit?: number;
}

export interface ListEnvVarsOptions {
  decrypt?: boolean; // Always false for safety
}
