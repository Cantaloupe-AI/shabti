/**
 * Vercel Teams API Queries
 * Read-only operations for team information
 */

import { vercelGet } from '../client';
import type { ListTeamsResponse, VercelTeam } from '../types';

/**
 * List all teams the authenticated user has access to
 */
export async function listTeams(): Promise<VercelTeam[]> {
  const response = await vercelGet<ListTeamsResponse>('/v2/teams');
  return response.teams;
}
