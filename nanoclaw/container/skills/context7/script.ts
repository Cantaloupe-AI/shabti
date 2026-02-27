#!/usr/bin/env bun
/**
 * Context7 Skill CLI
 *
 * Usage:
 *   bun /home/node/.claude/skills/context7/script.ts --action=search --library=react --query="hooks"
 *   bun /home/node/.claude/skills/context7/script.ts --action=query --id=/facebook/react --query="useState examples"
 */

import { searchLibraries, queryDocs } from './src/index.ts';

type Action = 'search' | 'query';

interface CLIArgs {
  action?: Action;
  library?: string;
  id?: string;
  query?: string;
  tokens?: number;
  format?: 'text' | 'json';
}

/**
 * Parses command line arguments
 */
function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const result: CLIArgs = {};

  const validActions = ['search', 'query'];

  for (const arg of args) {
    if (arg.startsWith('--action=')) {
      const actionValue = arg.split('=')[1] as Action;
      if (validActions.includes(actionValue)) {
        result.action = actionValue;
      } else {
        console.error(
          `Error: Invalid action '${actionValue}'. Must be one of: ${validActions.join(', ')}`
        );
        process.exit(1);
      }
    } else if (arg.startsWith('--library=')) {
      result.library = arg.split('=').slice(1).join('=');
    } else if (arg.startsWith('--id=')) {
      result.id = arg.split('=').slice(1).join('=');
    } else if (arg.startsWith('--query=')) {
      result.query = arg.split('=').slice(1).join('=');
    } else if (arg.startsWith('--tokens=')) {
      result.tokens = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--format=')) {
      const formatValue = arg.split('=')[1];
      if (formatValue === 'text' || formatValue === 'json') {
        result.format = formatValue;
      }
    }
  }

  return result;
}

/**
 * Truncate text to a maximum length
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Main CLI handler
 */
async function main(): Promise<void> {
  const args = parseArgs();
  const format = args.format || 'text';

  if (!args.action) {
    console.log('Context7 Documentation Skill');
    console.log('============================\n');
    console.log('No action specified. Available actions:\n');
    console.log('  --action=search --library=<name> --query="<query>"');
    console.log('    Search for library IDs (replaces mcp__context7__resolve-library-id)\n');
    console.log('  --action=query --id=<library-id> --query="<query>" [--tokens=5000]');
    console.log('    Get documentation for a library (replaces mcp__context7__query-docs)\n');
    console.log('Options:');
    console.log('  --format=text|json    Output format (default: text)\n');
    console.log('Examples:');
    console.log('  bun /home/node/.claude/skills/context7/script.ts --action=search --library=react --query="hooks"');
    console.log('  bun /home/node/.claude/skills/context7/script.ts --action=query --id=/websites/react_dev --query="useState"');
    return;
  }

  console.log(`[Context7] Action: ${args.action}`);

  try {
    switch (args.action) {
      case 'search': {
        if (!args.library) {
          console.error('Error: --library is required for search action');
          process.exit(1);
        }
        if (!args.query) {
          console.error('Error: --query is required for search action');
          process.exit(1);
        }

        console.log(`[Context7] Searching for: ${args.library}`);
        console.log(`[Context7] Query: ${args.query}\n`);

        const libraries = await searchLibraries(args.library, args.query);

        if (format === 'json') {
          console.log(JSON.stringify(libraries, null, 2));
          break;
        }

        if (libraries.length === 0) {
          console.log('No libraries found matching your search.');
          console.log('Try a different library name or more specific query.');
          break;
        }

        console.log(`Found ${libraries.length} matching libraries:\n`);
        for (const lib of libraries) {
          console.log(`  ID: ${lib.id}`);
          console.log(`  Title: ${lib.title}`);
          console.log(`  Description: ${truncate(lib.description || 'No description', 100)}`);
          // Convert numeric trust score (0-10) to label
          const trustLabel = lib.trustScore >= 9 ? 'High' : lib.trustScore >= 7 ? 'Medium' : 'Low';
          console.log(`  Snippets: ${lib.totalSnippets} | Trust: ${trustLabel} | Score: ${lib.benchmarkScore}`);
          if (lib.versions && lib.versions.length > 0) {
            console.log(`  Versions: ${lib.versions.slice(0, 5).join(', ')}${lib.versions.length > 5 ? '...' : ''}`);
          }
          console.log('');
        }

        console.log('To query documentation, use:');
        console.log(`  bun /home/node/.claude/skills/context7/script.ts --action=query --id=${libraries[0]?.id || '<library-id>'} --query="your query"`);
        break;
      }

      case 'query': {
        if (!args.id) {
          console.error('Error: --id is required for query action');
          console.error('Use --action=search first to find the library ID');
          process.exit(1);
        }
        if (!args.query) {
          console.error('Error: --query is required for query action');
          process.exit(1);
        }

        console.log(`[Context7] Library ID: ${args.id}`);
        console.log(`[Context7] Query: ${args.query}`);
        if (args.tokens) {
          console.log(`[Context7] Max tokens: ${args.tokens}`);
        }
        console.log('');

        const result = await queryDocs(args.id, args.query, args.tokens);
        const snippets = result.snippets;

        if (format === 'json') {
          console.log(JSON.stringify(result, null, 2));
          break;
        }

        if (snippets.length === 0) {
          console.log('No documentation snippets found for this query.');
          console.log('Try a different query or check if the library ID is correct.');
          break;
        }

        console.log(`Found ${snippets.length} documentation snippets:\n`);
        console.log('='.repeat(60) + '\n');

        for (let i = 0; i < snippets.length; i++) {
          const snippet = snippets[i];
          if (!snippet) continue;
          console.log(`[${i + 1}] ${snippet.title}`);
          if (snippet.source) {
            console.log(`    Source: ${snippet.source}`);
          }
          console.log('-'.repeat(60));
          console.log(snippet.content);
          console.log('\n' + '='.repeat(60) + '\n');
        }
        break;
      }

      default:
        console.error(`Unknown action: ${args.action}`);
        process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
