#!/usr/bin/env bun
/**
 * Axiom Skill CLI
 * Read-only operations for querying logs and inspecting datasets
 *
 * Usage:
 *   bun /home/node/.claude/skills/axiom/script.ts --action=<action> [options]
 *
 * Actions:
 *   query              - Run an APL query against a dataset
 *   list-datasets      - List all available datasets
 *   get-dataset        - Get dataset details
 *   list-fields        - List fields for a dataset
 *   recent-logs        - Get recent logs (shortcut for simple query)
 *   errors             - Get recent error logs
 *   search             - Search logs for a text pattern
 */

import { parseArgs } from 'util';
import {
  listDatasets,
  getDataset,
  listFields,
  runQuery,
  formatQueryResults,
  buildAplQuery,
  getDefaultDataset,
  AXIOM_CONFIG,
} from './src';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    action: { type: 'string' },
    // Query options
    apl: { type: 'string' },
    dataset: { type: 'string' },
    filter: { type: 'string' },
    search: { type: 'string' },
    fields: { type: 'string' },
    limit: { type: 'string' },
    sort: { type: 'string' },
    // Time range
    start: { type: 'string' },
    end: { type: 'string' },
    range: { type: 'string' },
    // Dataset options
    id: { type: 'string' },
    // Output options
    raw: { type: 'boolean' },
    // Help
    help: { type: 'boolean', short: 'h' },
  },
  strict: false,
});

function printHelp() {
  console.log(`
Axiom Skill CLI - Read-only log queries and dataset inspection

USAGE:
  bun /home/node/.claude/skills/axiom/script.ts --action=<action> [options]

ACTIONS:
  query              Run a raw APL query
  list-datasets      List all available datasets
  get-dataset        Get dataset details (requires --id)
  list-fields        List fields for a dataset (requires --dataset or uses default)
  recent-logs        Get recent logs with optional filtering
  errors             Get recent error logs
  search             Search logs for text (requires --search)

QUERY OPTIONS:
  --apl=<query>      Raw APL query string (for 'query' action)
  --dataset=<name>   Dataset name (default: ${AXIOM_CONFIG.defaultDataset})
  --filter=<expr>    APL where clause expression (e.g. "status == 500")
  --search=<text>    Text to search for in log messages
  --fields=<f1,f2>   Comma-separated list of fields to project
  --limit=<n>        Max results (default: ${AXIOM_CONFIG.defaultLimit})
  --sort=<field>     Field to sort by (default: _time)

TIME RANGE:
  --range=<dur>      Relative time range: 5m, 1h, 24h, 7d (default: 1h)
  --start=<time>     Start time (ISO 8601 or relative like "1h")
  --end=<time>       End time (ISO 8601 or "now")

OUTPUT:
  --raw              Output raw JSON instead of formatted table

EXAMPLES:
  # List all datasets
  bun /home/node/.claude/skills/axiom/script.ts --action=list-datasets

  # List fields in default dataset
  bun /home/node/.claude/skills/axiom/script.ts --action=list-fields

  # Get recent logs (last hour)
  bun /home/node/.claude/skills/axiom/script.ts --action=recent-logs --limit=20

  # Get recent errors
  bun /home/node/.claude/skills/axiom/script.ts --action=errors --range=24h

  # Search logs for a pattern
  bun /home/node/.claude/skills/axiom/script.ts --action=search --search="login" --range=1h

  # Filter by status code
  bun /home/node/.claude/skills/axiom/script.ts --action=recent-logs --filter="status == 500" --range=4h

  # Run raw APL query
  bun /home/node/.claude/skills/axiom/script.ts --action=query --apl="['vercel-logs'] | where status >= 400 | summarize count() by bin_auto(_time)" --range=24h

  # Show specific fields
  bun /home/node/.claude/skills/axiom/script.ts --action=recent-logs --fields="_time,request.path,status" --limit=10
`);
}

async function main() {
  if (values.help || !values.action) {
    printHelp();
    process.exit(values.help ? 0 : 1);
  }

  const action = values.action;
  const dataset = values.dataset || getDefaultDataset();
  const limit = values.limit ? parseInt(values.limit, 10) : AXIOM_CONFIG.defaultLimit;
  const range = values.range || AXIOM_CONFIG.defaultTimeRange;
  const startTime = values.start || range;
  const endTime = values.end || 'now';
  const outputRaw = values.raw || false;

  try {
    switch (action) {
      case 'list-datasets': {
        const datasets = await listDatasets();
        console.log(JSON.stringify({ datasets }, null, 2));
        break;
      }

      case 'get-dataset': {
        const datasetId = values.id || dataset;
        const info = await getDataset(datasetId);
        console.log(JSON.stringify({ dataset: info }, null, 2));
        break;
      }

      case 'list-fields': {
        const fieldList = await listFields(dataset);
        // Filter out hidden fields
        const visibleFields = fieldList.filter(f => !f.hidden);
        console.log(`\nFields for dataset '${dataset}' (${visibleFields.length} visible):\n`);
        for (const field of visibleFields) {
          const desc = field.description ? ` — ${field.description}` : '';
          const unit = field.unit ? ` (${field.unit})` : '';
          console.log(`  ${field.name} [${field.type}]${unit}${desc}`);
        }
        if (outputRaw) {
          console.log('\n' + JSON.stringify({ fields: fieldList }, null, 2));
        }
        break;
      }

      case 'query': {
        if (!values.apl) {
          console.error('Error: --apl is required for query action');
          process.exit(1);
        }
        const result = await runQuery({
          apl: values.apl,
          startTime,
          endTime,
        });
        if (outputRaw) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(formatQueryResults(result));
        }
        break;
      }

      case 'recent-logs': {
        const fields = values.fields ? values.fields.split(',').map(f => f.trim()) : undefined;
        const apl = buildAplQuery({
          dataset,
          filter: values.filter,
          project: fields,
          limit,
          sort: '_time',
          sortDesc: true,
        });
        console.log(`[APL] ${apl}\n`);
        const result = await runQuery({ apl, startTime, endTime });
        if (outputRaw) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(formatQueryResults(result));
        }
        break;
      }

      case 'errors': {
        // First discover which error-related fields exist in the dataset
        const { listFields: getFields } = await import('./src');
        const datasetFields = await getFields(dataset);
        const fieldNameSet = new Set(datasetFields.map(f => f.name));

        const errorConditions: string[] = [];
        if (fieldNameSet.has('level')) errorConditions.push(`['level'] == "error"`);
        if (fieldNameSet.has('response.status')) errorConditions.push(`['response.status'] >= 400`);
        if (fieldNameSet.has('status')) errorConditions.push(`['status'] >= 400`);
        if (fieldNameSet.has('webVital.rating')) errorConditions.push(`['webVital.rating'] == "poor"`);

        if (errorConditions.length === 0) {
          console.error(`No known error fields found in dataset '${dataset}'. Available fields:`);
          for (const f of datasetFields) {
            console.error(`  ${f.name} [${f.type}]`);
          }
          console.error('\nUse --action=query with a custom APL filter instead.');
          process.exit(1);
        }

        let errorFilter = errorConditions.join(' or ');
        if (values.filter) {
          errorFilter = `(${values.filter}) and (${errorFilter})`;
        }

        const apl = buildAplQuery({
          dataset,
          filter: errorFilter,
          limit,
          sort: '_time',
          sortDesc: true,
        });
        console.log(`[APL] ${apl}\n`);
        const result = await runQuery({ apl, startTime, endTime });
        if (outputRaw) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(formatQueryResults(result));
        }
        break;
      }

      case 'search': {
        if (!values.search) {
          console.error('Error: --search is required for search action');
          process.exit(1);
        }
        const searchText = values.search;
        // Use APL search operator for full-text search
        const apl = `['${dataset}']\n| search "${searchText}"\n| sort by _time desc\n| take ${limit}`;
        console.log(`[APL] ${apl}\n`);
        const result = await runQuery({ apl, startTime, endTime });
        if (outputRaw) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(formatQueryResults(result));
        }
        break;
      }

      default:
        console.error(`Error: Unknown action "${action}"`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('An unexpected error occurred');
    }
    process.exit(1);
  }
}

main();
