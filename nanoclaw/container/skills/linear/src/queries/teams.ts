/**
 * Linear team queries
 */

import { linearQuery } from '../client.ts';
import type { LinearTeam } from '../types.ts';

const LIST_TEAMS_QUERY = `
  query ListTeams {
    teams {
      nodes {
        id
        name
        key
        description
      }
    }
  }
`;

const GET_TEAM_QUERY = `
  query GetTeam($name: String!) {
    teams(filter: { name: { eq: $name } }) {
      nodes {
        id
        name
        key
        description
      }
    }
  }
`;

interface TeamsResponse {
  teams: {
    nodes: LinearTeam[];
  };
}

/**
 * List all teams in the workspace
 */
export async function listTeams(): Promise<LinearTeam[]> {
  const data = await linearQuery<TeamsResponse>(LIST_TEAMS_QUERY);
  return data.teams.nodes;
}

/**
 * Get a team by name
 */
export async function getTeamByName(name: string): Promise<LinearTeam | null> {
  const data = await linearQuery<TeamsResponse>(GET_TEAM_QUERY, { name });
  return data.teams.nodes[0] || null;
}
