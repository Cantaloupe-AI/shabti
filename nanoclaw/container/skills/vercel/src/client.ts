/**
 * Vercel API Client
 * Handles authentication and HTTP requests to Vercel API
 * READ-ONLY operations only
 */

import { VERCEL_CONFIG } from './config';
import type { VercelApiError } from './types';

/**
 * Get the Vercel API token from environment
 * Validates that the token exists before making requests
 */
function getApiToken(): string {
  const token = process.env.VERCEL_KEY;
  if (!token) {
    throw new Error(
      'VERCEL_KEY environment variable is not set.\n' +
      'Please create a token at https://vercel.com/account/tokens\n' +
      'and add it to your .env.local file as VERCEL_KEY=your_token_here'
    );
  }
  return token;
}

/**
 * Rate limit information from Vercel API headers
 */
interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Parse rate limit headers from response
 */
function parseRateLimitHeaders(headers: Headers): RateLimitInfo | null {
  const limit = headers.get('X-RateLimit-Limit');
  const remaining = headers.get('X-RateLimit-Remaining');
  const reset = headers.get('X-RateLimit-Reset');

  if (limit && remaining && reset) {
    return {
      limit: parseInt(limit, 10),
      remaining: parseInt(remaining, 10),
      reset: parseInt(reset, 10),
    };
  }
  return null;
}

/**
 * Make an authenticated GET request to the Vercel API
 */
export async function vercelGet<T>(
  endpoint: string,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  const token = getApiToken();

  // Build URL with query parameters
  const url = new URL(`${VERCEL_CONFIG.apiUrl}${endpoint}`);
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

  // Log rate limit info for debugging
  const rateLimit = parseRateLimitHeaders(response.headers);
  if (rateLimit && rateLimit.remaining < 10) {
    console.warn(`[Vercel API] Rate limit warning: ${rateLimit.remaining}/${rateLimit.limit} remaining`);
  }

  if (!response.ok) {
    const errorBody = await response.json() as VercelApiError;
    throw new Error(
      `Vercel API Error (${response.status}): ${errorBody.error?.message || response.statusText}`
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Helper to handle paginated responses
 * Returns all items from all pages up to maxItems
 */
export async function vercelGetPaginated<T, R extends { pagination?: { next: number | null } }>(
  endpoint: string,
  params: Record<string, string | number | undefined>,
  extractItems: (response: R) => T[],
  maxItems: number = VERCEL_CONFIG.maxLimit
): Promise<T[]> {
  const allItems: T[] = [];
  let until: number | null = null;

  while (allItems.length < maxItems) {
    const queryParams = { ...params };
    if (until !== null) {
      queryParams.until = until;
    }

    const response = await vercelGet<R>(endpoint, queryParams);
    const items = extractItems(response);
    allItems.push(...items);

    if (!response.pagination?.next || items.length === 0) {
      break;
    }

    until = response.pagination.next;
  }

  return allItems.slice(0, maxItems);
}
