/**
 * Linear GraphQL client
 */

import { LINEAR_CONFIG } from './config.ts';
import type { LinearGraphQLResponse } from './types.ts';

/**
 * Get the Linear API key from environment variables
 */
function getApiKey(): string {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    throw new Error(
      'LINEAR_API_KEY environment variable is required. Add it to your project root .env.local file.'
    );
  }
  return apiKey;
}

/**
 * Execute a GraphQL query against the Linear API
 */
export async function linearQuery<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const apiKey = getApiKey();

  const response = await fetch(LINEAR_CONFIG.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Linear API HTTP error ${response.status}: ${text}`);
  }

  const result = (await response.json()) as LinearGraphQLResponse<T>;

  if (result.errors && result.errors.length > 0) {
    const errorMessages = result.errors.map((e) => e.message).join(', ');
    throw new Error(`Linear API error: ${errorMessages}`);
  }

  if (!result.data) {
    throw new Error('Linear API returned no data');
  }

  return result.data;
}
