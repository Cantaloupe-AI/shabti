/**
 * Axiom API Client
 * Handles authentication and HTTP requests to Axiom API
 * READ-ONLY operations only
 */

import { AXIOM_CONFIG } from './config';

/**
 * Get the Axiom query token from environment.
 * This is separate from NEXT_PUBLIC_AXIOM_TOKEN (ingest-only, client-side).
 * AXIOM_QUERY_TOKEN has read/query permissions for log retrieval.
 */
function getQueryToken(): string {
  const token = process.env.AXIOM_QUERY_TOKEN;
  if (!token) {
    throw new Error(
      'AXIOM_QUERY_TOKEN environment variable is not set.\n' +
      'This token needs Query permissions on your datasets.\n' +
      'Create one at https://app.axiom.co → Settings → API Tokens\n' +
      'and add it to .env.local as AXIOM_QUERY_TOKEN=xaat-...'
    );
  }
  return token;
}

/**
 * Get the default dataset from environment
 */
export function getDefaultDataset(): string {
  return process.env.NEXT_PUBLIC_AXIOM_DATASET || AXIOM_CONFIG.defaultDataset;
}

/**
 * Make an authenticated GET request to the Axiom management API (v2)
 */
export async function axiomGet<T>(
  endpoint: string,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  const token = getQueryToken();

  const url = new URL(`${AXIOM_CONFIG.managementApiUrl}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const rateLimitRemaining = response.headers.get('X-QueryLimit-Remaining');
  if (rateLimitRemaining && parseInt(rateLimitRemaining, 10) < 5) {
    console.warn(`[Axiom API] Rate limit warning: ${rateLimitRemaining} remaining`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Axiom API Error (${response.status}): ${errorText}`
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Make an authenticated POST request to the Axiom APL query endpoint (v1)
 */
export async function axiomQuery<T>(
  body: Record<string, unknown>
): Promise<T> {
  const token = getQueryToken();

  const url = `${AXIOM_CONFIG.queryApiUrl}/datasets/_apl?format=tabular`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const rateLimitRemaining = response.headers.get('X-QueryLimit-Remaining');
  if (rateLimitRemaining && parseInt(rateLimitRemaining, 10) < 5) {
    console.warn(`[Axiom API] Query rate limit warning: ${rateLimitRemaining} remaining`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Axiom Query Error (${response.status}): ${errorText}`
    );
  }

  return response.json() as Promise<T>;
}
