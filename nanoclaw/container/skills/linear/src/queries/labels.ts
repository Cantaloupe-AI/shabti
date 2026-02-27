/**
 * Linear label queries
 */

import { linearQuery } from '../client.ts';
import type { LinearLabel } from '../types.ts';

const LIST_LABELS_QUERY = `
  query ListLabels($teamId: ID) {
    issueLabels(filter: { team: { id: { eq: $teamId } } }) {
      nodes {
        id
        name
        color
      }
    }
  }
`;

const LIST_WORKSPACE_LABELS_QUERY = `
  query ListWorkspaceLabels {
    issueLabels {
      nodes {
        id
        name
        color
      }
    }
  }
`;

interface LabelsResponse {
  issueLabels: {
    nodes: LinearLabel[];
  };
}

/**
 * List all labels in the workspace or for a specific team
 */
export async function listLabels(teamId?: string): Promise<LinearLabel[]> {
  if (teamId) {
    const data = await linearQuery<LabelsResponse>(LIST_LABELS_QUERY, { teamId });
    return data.issueLabels.nodes;
  }
  const data = await linearQuery<LabelsResponse>(LIST_WORKSPACE_LABELS_QUERY);
  return data.issueLabels.nodes;
}

/**
 * Get label IDs by names
 */
export async function getLabelIdsByNames(
  names: string[],
  teamId?: string
): Promise<string[]> {
  const labels = await listLabels(teamId);
  const labelMap = new Map(labels.map((l) => [l.name.toLowerCase(), l.id]));

  const ids: string[] = [];
  for (const name of names) {
    const id = labelMap.get(name.toLowerCase());
    if (id) {
      ids.push(id);
    } else {
      console.warn(`Warning: Label "${name}" not found`);
    }
  }

  return ids;
}
