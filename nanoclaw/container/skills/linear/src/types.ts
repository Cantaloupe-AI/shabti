/**
 * Linear API TypeScript types
 */

export interface LinearUser {
  id: string;
  name: string;
  email: string;
  displayName: string;
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
  description?: string;
}

export interface LinearLabel {
  id: string;
  name: string;
  color: string;
}

export interface LinearState {
  id: string;
  name: string;
  type: string;
  color: string;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority: number;
  state: LinearState;
  team: LinearTeam;
  assignee?: LinearUser;
  creator?: LinearUser;
  labels: { nodes: LinearLabel[] };
  createdAt: string;
  updatedAt: string;
  url: string;
}

export interface LinearComment {
  id: string;
  body: string;
  createdAt: string;
  user: LinearUser;
}

export interface LinearGraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

export interface CreateIssueInput {
  title: string;
  description?: string;
  teamId: string;
  labelIds?: string[];
  assigneeId?: string;
  priority?: number;
  stateId?: string;
}

export interface UpdateIssueInput {
  title?: string;
  description?: string;
  labelIds?: string[];
  assigneeId?: string;
  priority?: number;
  stateId?: string;
}

export interface CreateCommentInput {
  issueId: string;
  body: string;
}

export interface ListIssuesFilter {
  teamId?: string;
  assigneeId?: string;
  stateId?: string;
  labelId?: string;
  limit?: number;
}
