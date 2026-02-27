/**
 * Context7 skill exports
 */

// Client
export { searchLibraries, queryDocs } from './client.ts';
export type { QueryDocsResult } from './client.ts';

// Config
export { CONTEXT7_CONFIG } from './config.ts';

// Types
export type {
  Context7Library,
  Context7DocSnippet,
  Context7SearchResponse,
  Context7QueryResponse,
  Context7ErrorResponse,
} from './types.ts';
