/**
 * Linear configuration
 * Centralized config from CLAUDE.md
 */

export const LINEAR_CONFIG = {
  apiUrl: 'https://api.linear.app/graphql',
  defaultTeam: 'Cantaloupe Developers',
  labels: [
    'Bug',
    'help wanted',
    'Improvement',
    'Feature',
    'Design',
    'Prod',
    'idea',
    'Onboarding',
    'Process',
    'Compliance',
    'Business/design sync needed',
    'QA',
    'Style',
    'Migrated',
    'Product',
  ],
} as const;

export type LinearLabel = (typeof LINEAR_CONFIG.labels)[number];
