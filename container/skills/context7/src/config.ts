/**
 * Context7 configuration
 * Centralized config for Context7 API access
 */

export const CONTEXT7_CONFIG = {
  baseUrl: 'https://context7.com/api/v2',
  endpoints: {
    search: '/libs/search',
    context: '/context',
  },
  envKey: 'CONTEXT_7_API_KEY',
  apiKeyPrefix: 'ctx7sk',
  maxRetries: 3,
  retryBaseDelay: 1000, // ms
  defaultTokens: 5000,
} as const;
