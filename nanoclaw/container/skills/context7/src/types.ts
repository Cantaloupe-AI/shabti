/**
 * Context7 API TypeScript types
 */

/**
 * Library search result from Context7
 */
export interface Context7Library {
  id: string; // e.g., "/websites/react_dev"
  title: string;
  description: string;
  branch?: string;
  lastUpdateDate?: string;
  state?: string;
  totalTokens?: number;
  totalSnippets: number;
  stars?: number;
  trustScore: number; // 0-10 numeric score
  benchmarkScore: number; // 0-100
  versions: string[];
  score?: number; // relevance score
  vip?: boolean;
}

/**
 * Documentation snippet from Context7
 */
export interface Context7DocSnippet {
  title: string;
  content: string;
  source?: string;
}

/**
 * Response from library search endpoint
 */
export interface Context7SearchResponse {
  results: Context7Library[];
}

/**
 * Response from documentation query endpoint
 */
export interface Context7QueryResponse {
  context?: string; // Plain text format
  snippets?: Context7DocSnippet[]; // JSON format
}

/**
 * Error response from Context7 API
 */
export interface Context7ErrorResponse {
  error: string;
  message?: string;
}
