/**
 * APL Query operations
 */

import { axiomQuery, getDefaultDataset } from '../client';
import { AXIOM_CONFIG } from '../config';
import type { AxiomQueryRequest, AxiomQueryResponse } from '../types';

/**
 * Parse a relative time expression like "1h", "30m", "7d" into an ISO timestamp
 */
function relativeTimeToISO(relative: string): string {
  const match = relative.match(/^(\d+)([mhdw])$/);
  if (!match) {
    // Assume it's already an ISO string or "now"
    if (relative === 'now') return new Date().toISOString();
    return relative;
  }

  const amount = parseInt(match[1], 10);
  const unit = match[2];
  const now = new Date();

  switch (unit) {
    case 'm':
      now.setMinutes(now.getMinutes() - amount);
      break;
    case 'h':
      now.setHours(now.getHours() - amount);
      break;
    case 'd':
      now.setDate(now.getDate() - amount);
      break;
    case 'w':
      now.setDate(now.getDate() - amount * 7);
      break;
  }

  return now.toISOString();
}

/**
 * Run an APL query
 */
export async function runQuery(options: {
  apl: string;
  startTime?: string;
  endTime?: string;
}): Promise<AxiomQueryResponse> {
  const body: AxiomQueryRequest = {
    apl: options.apl,
  };

  if (options.startTime) {
    body.startTime = relativeTimeToISO(options.startTime);
  }
  if (options.endTime) {
    body.endTime = relativeTimeToISO(options.endTime);
  }

  return axiomQuery<AxiomQueryResponse>(body);
}

/**
 * Format query results into a readable table
 */
export function formatQueryResults(response: AxiomQueryResponse): string {
  const lines: string[] = [];

  // Status summary
  lines.push('=== Query Status ===');
  lines.push(`Rows examined: ${response.status.rowsExamined}`);
  lines.push(`Rows matched: ${response.status.rowsMatched}`);
  lines.push(`Elapsed: ${response.status.elapsedTime}ms`);
  lines.push(`Time range: ${response.status.minBlockTime} to ${response.status.maxBlockTime}`);
  if (response.status.isPartial) {
    lines.push('WARNING: Results are partial');
  }
  lines.push('');

  // Tables
  for (const table of response.tables) {
    lines.push(`=== ${table.name} ===`);

    if (table.fields.length === 0 || table.columns.length === 0) {
      lines.push('(no results)');
      continue;
    }

    const fieldNames = table.fields.map(f => f.name);
    const columns = table.columns;

    // Determine number of rows from first column
    const rowCount = columns[0]?.length ?? 0;

    if (rowCount === 0) {
      lines.push('(no results)');
      continue;
    }

    // Build rows for display
    for (let row = 0; row < rowCount; row++) {
      lines.push(`--- Row ${row + 1} ---`);
      for (let col = 0; col < fieldNames.length; col++) {
        const value = columns[col]?.[row];
        const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
        // Truncate long values
        const truncated = displayValue.length > 200
          ? displayValue.substring(0, 200) + '...'
          : displayValue;
        lines.push(`  ${fieldNames[col]}: ${truncated}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Build a simple APL query string for common operations
 */
export function buildAplQuery(options: {
  dataset?: string;
  filter?: string;
  project?: string[];
  limit?: number;
  sort?: string;
  sortDesc?: boolean;
  summarize?: string;
}): string {
  const dataset = options.dataset || getDefaultDataset();
  const parts: string[] = [`['${dataset}']`];

  if (options.filter) {
    parts.push(`where ${options.filter}`);
  }

  if (options.summarize) {
    parts.push(`summarize ${options.summarize}`);
  }

  if (options.sort) {
    const direction = options.sortDesc !== false ? 'desc' : 'asc';
    parts.push(`sort by ${options.sort} ${direction}`);
  }

  if (options.project && options.project.length > 0) {
    parts.push(`project ${options.project.join(', ')}`);
  }

  if (options.limit) {
    parts.push(`take ${options.limit}`);
  }

  return parts.join('\n| ');
}
