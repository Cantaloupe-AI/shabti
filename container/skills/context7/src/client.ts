/**
 * Context7 REST API client
 */

import { CONTEXT7_CONFIG } from './config.ts';
import type {
  Context7Library,
  Context7DocSnippet,
  Context7SearchResponse,
  Context7QueryResponse,
  Context7ErrorResponse,
} from './types.ts';

/**
 * Get the Context7 API key from environment variables
 */
function getApiKey(): string {
  const apiKey = process.env[CONTEXT7_CONFIG.envKey];
  if (!apiKey) {
    throw new Error(
      `${CONTEXT7_CONFIG.envKey} environment variable is required. Add it to your project root .env.local file.`
    );
  }
  if (!apiKey.startsWith(CONTEXT7_CONFIG.apiKeyPrefix)) {
    throw new Error(
      `Invalid ${CONTEXT7_CONFIG.envKey}: API key should start with "${CONTEXT7_CONFIG.apiKeyPrefix}"`
    );
  }
  return apiKey;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a request against the Context7 API with retry logic
 */
async function context7Request<T>(
  endpoint: string,
  params: Record<string, string | number | undefined>
): Promise<T> {
  const apiKey = getApiKey();
  const url = new URL(`${CONTEXT7_CONFIG.baseUrl}${endpoint}`);

  // Add query parameters
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < CONTEXT7_CONFIG.maxRetries; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : CONTEXT7_CONFIG.retryBaseDelay * Math.pow(2, attempt);

        console.warn(
          `Rate limited. Retrying in ${delay}ms (attempt ${attempt + 1}/${CONTEXT7_CONFIG.maxRetries})`
        );
        await sleep(delay);
        continue;
      }

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as Context7ErrorResponse;
        throw new Error(
          `Context7 API HTTP error ${response.status}: ${errorBody.error || errorBody.message || response.statusText}`
        );
      }

      const contentType = response.headers.get('content-type') || '';
      let data: unknown;

      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        // Handle text responses (context endpoint can return plain text)
        const text = await response.text();
        // Wrap text in an object for consistent handling
        data = { context: text };
      }

      return data as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on non-retryable errors
      if (
        lastError.message.includes('API key') ||
        lastError.message.includes('HTTP error 4')
      ) {
        throw lastError;
      }

      // Exponential backoff for retryable errors
      if (attempt < CONTEXT7_CONFIG.maxRetries - 1) {
        const delay = CONTEXT7_CONFIG.retryBaseDelay * Math.pow(2, attempt);
        console.warn(
          `Request failed. Retrying in ${delay}ms (attempt ${attempt + 1}/${CONTEXT7_CONFIG.maxRetries})`
        );
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('Context7 API request failed after retries');
}

/**
 * Search for libraries by name
 * Replaces mcp__context7__resolve-library-id
 */
export async function searchLibraries(
  libraryName: string,
  query: string
): Promise<Context7Library[]> {
  const response = await context7Request<Context7SearchResponse>(
    CONTEXT7_CONFIG.endpoints.search,
    {
      libraryName,
      query,
    }
  );

  return response.results || [];
}

/**
 * Query documentation result - either snippets array or plain text
 */
export interface QueryDocsResult {
  snippets: Context7DocSnippet[];
  rawText?: string;
}

/**
 * Query documentation for a library
 * Replaces mcp__context7__query-docs
 */
export async function queryDocs(
  libraryId: string,
  query: string,
  tokens?: number
): Promise<QueryDocsResult> {
  const response = await context7Request<Context7QueryResponse>(
    CONTEXT7_CONFIG.endpoints.context,
    {
      libraryId,
      query,
      tokens: tokens || CONTEXT7_CONFIG.defaultTokens,
    }
  );

  // Handle both JSON array response and plain text response
  if (response.context) {
    // Plain text response - parse into snippets
    const rawText = response.context;
    const snippets = parseTextToSnippets(rawText);
    return { snippets, rawText };
  }

  // JSON response with snippets array
  if (Array.isArray(response)) {
    return { snippets: response as Context7DocSnippet[] };
  }

  return { snippets: response.snippets || [] };
}

/**
 * Parse plain text documentation into snippets
 */
function parseTextToSnippets(text: string): Context7DocSnippet[] {
  const snippets: Context7DocSnippet[] = [];
  // Split on common documentation separators
  const sections = text.split(/\n-{20,}\n|\n={20,}\n/);

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    // Try to extract title from first line or heading
    const lines = trimmed.split('\n');
    const firstLine = lines[0] || '';
    const titleMatch = firstLine.match(/^#+\s*(.+)$/) || firstLine.match(/^(.{1,80})/);
    const title = titleMatch ? titleMatch[1].trim() : 'Documentation';

    // Try to extract source URL
    const sourceMatch = trimmed.match(/Source:\s*(https?:\/\/[^\s]+)/i);
    const source = sourceMatch ? sourceMatch[1] : undefined;

    snippets.push({
      title,
      content: trimmed,
      source,
    });
  }

  return snippets.length > 0 ? snippets : [{ title: 'Documentation', content: text }];
}
