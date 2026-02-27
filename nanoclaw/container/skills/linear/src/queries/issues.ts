/**
 * Linear issue queries and mutations
 */

import { linearQuery } from '../client.ts';
import type {
  LinearIssue,
  LinearComment,
  CreateIssueInput,
  UpdateIssueInput,
  CreateCommentInput,
  ListIssuesFilter,
} from '../types.ts';

const ISSUE_FRAGMENT = `
  id
  identifier
  title
  description
  priority
  url
  createdAt
  updatedAt
  state {
    id
    name
    type
    color
  }
  team {
    id
    name
    key
  }
  assignee {
    id
    name
    email
    displayName
  }
  creator {
    id
    name
    email
    displayName
  }
  labels {
    nodes {
      id
      name
      color
    }
  }
`;

const LIST_ISSUES_QUERY = `
  query ListIssues($filter: IssueFilter, $first: Int) {
    issues(
      filter: $filter
      first: $first
      orderBy: updatedAt
    ) {
      nodes {
        ${ISSUE_FRAGMENT}
      }
    }
  }
`;

const GET_ISSUE_QUERY = `
  query GetIssue($id: ID!) {
    issue(id: $id) {
      ${ISSUE_FRAGMENT}
    }
  }
`;

const SEARCH_ISSUES_QUERY = `
  query SearchIssues($term: String!, $first: Int) {
    searchIssues(term: $term, first: $first) {
      nodes {
        ${ISSUE_FRAGMENT}
      }
    }
  }
`;

const CREATE_ISSUE_MUTATION = `
  mutation CreateIssue($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      success
      issue {
        ${ISSUE_FRAGMENT}
      }
    }
  }
`;

const UPDATE_ISSUE_MUTATION = `
  mutation UpdateIssue($id: ID!, $input: IssueUpdateInput!) {
    issueUpdate(id: $id, input: $input) {
      success
      issue {
        ${ISSUE_FRAGMENT}
      }
    }
  }
`;

const CREATE_COMMENT_MUTATION = `
  mutation CreateComment($input: CommentCreateInput!) {
    commentCreate(input: $input) {
      success
      comment {
        id
        body
        createdAt
        user {
          id
          name
          email
          displayName
        }
      }
    }
  }
`;

const LIST_COMMENTS_QUERY = `
  query ListComments($issueId: ID!) {
    issue(id: $issueId) {
      comments {
        nodes {
          id
          body
          createdAt
          user {
            id
            name
            email
            displayName
          }
        }
      }
    }
  }
`;

const GET_VIEWER_QUERY = `
  query GetViewer {
    viewer {
      id
      name
      email
      displayName
    }
  }
`;

interface IssuesResponse {
  issues: {
    nodes: LinearIssue[];
  };
}

interface SearchIssuesResponse {
  searchIssues: {
    nodes: LinearIssue[];
  };
}

interface IssueResponse {
  issue: LinearIssue;
}

interface CreateIssueResponse {
  issueCreate: {
    success: boolean;
    issue: LinearIssue;
  };
}

interface UpdateIssueResponse {
  issueUpdate: {
    success: boolean;
    issue: LinearIssue;
  };
}

interface CreateCommentResponse {
  commentCreate: {
    success: boolean;
    comment: LinearComment;
  };
}

interface CommentsResponse {
  issue: {
    comments: {
      nodes: LinearComment[];
    };
  };
}

interface ViewerResponse {
  viewer: {
    id: string;
    name: string;
    email: string;
    displayName: string;
  };
}

/**
 * Build filter object dynamically, only including non-null conditions
 */
function buildIssueFilter(filter?: ListIssuesFilter): Record<string, unknown> | null {
  if (!filter) return null;

  const result: Record<string, unknown> = {};

  if (filter.teamId) {
    result.team = { id: { eq: filter.teamId } };
  }
  if (filter.assigneeId) {
    result.assignee = { id: { eq: filter.assigneeId } };
  }
  if (filter.stateId) {
    result.state = { id: { eq: filter.stateId } };
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * List issues with optional filters
 */
export async function listIssues(filter?: ListIssuesFilter): Promise<LinearIssue[]> {
  const data = await linearQuery<IssuesResponse>(LIST_ISSUES_QUERY, {
    filter: buildIssueFilter(filter),
    first: filter?.limit || 50,
  });
  return data.issues.nodes;
}

/**
 * Get an issue by ID or identifier (e.g., MELON-123)
 */
export async function getIssue(idOrIdentifier: string): Promise<LinearIssue | null> {
  // Check if it's an identifier (contains a dash like MELON-123)
  if (idOrIdentifier.includes('-')) {
    const data = await linearQuery<SearchIssuesResponse>(SEARCH_ISSUES_QUERY, {
      term: idOrIdentifier,
      first: 10,
    });
    // Find exact match
    const issue = data.searchIssues.nodes.find(
      (i) => i.identifier.toUpperCase() === idOrIdentifier.toUpperCase()
    );
    return issue || null;
  }

  try {
    const data = await linearQuery<IssueResponse>(GET_ISSUE_QUERY, { id: idOrIdentifier });
    return data.issue;
  } catch {
    return null;
  }
}

/**
 * Get the current user (viewer)
 */
export async function getViewer(): Promise<ViewerResponse['viewer']> {
  const data = await linearQuery<ViewerResponse>(GET_VIEWER_QUERY);
  return data.viewer;
}

/**
 * Create a new issue
 */
export async function createIssue(input: CreateIssueInput): Promise<LinearIssue> {
  const data = await linearQuery<CreateIssueResponse>(CREATE_ISSUE_MUTATION, {
    input: {
      title: input.title,
      description: input.description,
      teamId: input.teamId,
      labelIds: input.labelIds,
      assigneeId: input.assigneeId,
      priority: input.priority,
      stateId: input.stateId,
    },
  });

  if (!data.issueCreate.success) {
    throw new Error('Failed to create issue');
  }

  return data.issueCreate.issue;
}

/**
 * Update an existing issue
 */
export async function updateIssue(
  id: string,
  input: UpdateIssueInput
): Promise<LinearIssue> {
  const data = await linearQuery<UpdateIssueResponse>(UPDATE_ISSUE_MUTATION, {
    id,
    input,
  });

  if (!data.issueUpdate.success) {
    throw new Error('Failed to update issue');
  }

  return data.issueUpdate.issue;
}

/**
 * Add a comment to an issue
 */
export async function createComment(input: CreateCommentInput): Promise<LinearComment> {
  const data = await linearQuery<CreateCommentResponse>(CREATE_COMMENT_MUTATION, {
    input: {
      issueId: input.issueId,
      body: input.body,
    },
  });

  if (!data.commentCreate.success) {
    throw new Error('Failed to create comment');
  }

  return data.commentCreate.comment;
}

/**
 * List comments on an issue
 */
export async function listComments(issueId: string): Promise<LinearComment[]> {
  const data = await linearQuery<CommentsResponse>(LIST_COMMENTS_QUERY, { issueId });
  return data.issue.comments.nodes;
}
