#!/usr/bin/env bun
/**
 * Vercel Skill CLI
 * Read-only operations for checking deployments, build logs, and project status
 *
 * Usage:
 *   bun /home/node/.claude/skills/vercel/script.ts --action=<action> [options]
 *
 * Actions:
 *   list-projects      - List all projects
 *   get-project        - Get project details
 *   list-deployments   - List deployments
 *   get-deployment     - Get deployment details
 *   get-build-logs     - Get build logs for a deployment
 *   list-env-vars      - List environment variables (keys only, not values)
 *   list-teams         - List available teams
 *   logs-url           - Get URL to view runtime logs in dashboard
 */

import { parseArgs } from 'util';
import {
  listTeams,
  listProjects,
  getProject,
  listDeployments,
  getDeployment,
  getBuildLogs,
  formatBuildLogs,
  listEnvVars,
  VERCEL_CONFIG,
} from './src';
import type { DeploymentState } from './src';

// Parse command line arguments
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    action: { type: 'string' },
    // Project options
    name: { type: 'string' },
    id: { type: 'string' },
    project: { type: 'string' },
    // Filter options
    state: { type: 'string' },
    target: { type: 'string' },
    team: { type: 'string' },
    limit: { type: 'string' },
    // Help
    help: { type: 'boolean', short: 'h' },
  },
  strict: false,
});

function printHelp() {
  console.log(`
Vercel Skill CLI - Read-only operations for Vercel

USAGE:
  bun /home/node/.claude/skills/vercel/script.ts --action=<action> [options]

ACTIONS:
  list-projects      List all projects
  get-project        Get project details (requires --name or --id)
  list-deployments   List deployments (optional --project, --state, --target)
  get-deployment     Get deployment details (requires --id)
  get-build-logs     Get build logs for a deployment (requires --id)
  list-env-vars      List environment variables (requires --project)
  list-teams         List available teams
  logs-url           Get URL to view runtime logs (requires --project)

OPTIONS:
  --name=<name>      Project name (for get-project)
  --id=<id>          ID (for get-project, get-deployment, get-build-logs)
  --project=<name>   Project name or ID (defaults to "${VERCEL_CONFIG.defaultProject}")
  --state=<state>    Filter by deployment state: ${VERCEL_CONFIG.deploymentStates.join(', ')}
  --target=<target>  Filter by target: production, preview
  --team=<id>        Team ID (optional, defaults to personal account)
  --limit=<n>        Limit results (default: ${VERCEL_CONFIG.defaultLimit})
  -h, --help         Show this help

EXAMPLES:
  # List all projects
  bun /home/node/.claude/skills/vercel/script.ts --action=list-projects

  # Get project details
  bun /home/node/.claude/skills/vercel/script.ts --action=get-project --name=union

  # List recent deployments for a project
  bun /home/node/.claude/skills/vercel/script.ts --action=list-deployments --project=union --limit=10

  # List only failed deployments
  bun /home/node/.claude/skills/vercel/script.ts --action=list-deployments --project=union --state=ERROR

  # Get deployment details
  bun /home/node/.claude/skills/vercel/script.ts --action=get-deployment --id=dpl_xxxxx

  # Get build logs
  bun /home/node/.claude/skills/vercel/script.ts --action=get-build-logs --id=dpl_xxxxx

  # List environment variables
  bun /home/node/.claude/skills/vercel/script.ts --action=list-env-vars --project=union
`);
}

async function main() {
  if (values.help || !values.action) {
    printHelp();
    process.exit(values.help ? 0 : 1);
  }

  const action = values.action;
  const teamId = values.team;
  const limit = values.limit ? parseInt(values.limit, 10) : undefined;

  try {
    switch (action) {
      case 'list-teams': {
        const teams = await listTeams();
        console.log(JSON.stringify({ teams }, null, 2));
        break;
      }

      case 'list-projects': {
        const projects = await listProjects({ teamId, limit });
        console.log(JSON.stringify({ projects }, null, 2));
        break;
      }

      case 'get-project': {
        const idOrName = values.name || values.id;
        if (!idOrName) {
          console.error('Error: --name or --id is required for get-project');
          process.exit(1);
        }
        const project = await getProject(idOrName, teamId);
        console.log(JSON.stringify({ project }, null, 2));
        break;
      }

      case 'list-deployments': {
        const state = values.state as DeploymentState | undefined;
        if (state && !VERCEL_CONFIG.deploymentStates.includes(state)) {
          console.error(`Error: Invalid state. Must be one of: ${VERCEL_CONFIG.deploymentStates.join(', ')}`);
          process.exit(1);
        }
        const target = values.target as 'production' | 'preview' | undefined;
        if (target && !['production', 'preview'].includes(target)) {
          console.error('Error: Invalid target. Must be "production" or "preview"');
          process.exit(1);
        }
        const deployments = await listDeployments({
          projectId: values.project || VERCEL_CONFIG.defaultProject,
          state,
          target,
          teamId,
          limit,
        });
        console.log(JSON.stringify({ deployments }, null, 2));
        break;
      }

      case 'get-deployment': {
        const deploymentId = values.id;
        if (!deploymentId) {
          console.error('Error: --id is required for get-deployment');
          process.exit(1);
        }
        const deployment = await getDeployment(deploymentId, teamId);
        console.log(JSON.stringify({ deployment }, null, 2));
        break;
      }

      case 'get-build-logs': {
        const deploymentId = values.id;
        if (!deploymentId) {
          console.error('Error: --id is required for get-build-logs');
          process.exit(1);
        }
        const events = await getBuildLogs(deploymentId, { limit });
        // Output both formatted logs and raw events
        console.log('=== BUILD LOGS ===\n');
        console.log(formatBuildLogs(events));
        console.log('\n=== RAW EVENTS ===');
        console.log(JSON.stringify({ events }, null, 2));
        break;
      }

      case 'list-env-vars': {
        const projectIdOrName = values.project || VERCEL_CONFIG.defaultProject;
        const envVars = await listEnvVars(projectIdOrName);
        // Only show keys and metadata, never values (security)
        const safeEnvVars = envVars.map(({ id, key, type, target, gitBranch }) => ({
          id,
          key,
          type,
          target,
          gitBranch,
        }));
        console.log(JSON.stringify({ envVars: safeEnvVars }, null, 2));
        break;
      }

      case 'logs-url': {
        const projectName = values.project || VERCEL_CONFIG.defaultProject;
        // Get the team slug for the URL
        const teams = await listTeams();
        const teamSlug = teams[0]?.slug || 'cantaloupe-atar';

        const logsUrl = `https://vercel.com/${teamSlug}/${projectName}/logs`;
        const functionsUrl = `https://vercel.com/${teamSlug}/${projectName}/logs?type=functions`;

        console.log(`
Runtime Logs URLs (open in browser):

  All Logs:       ${logsUrl}
  Function Logs:  ${functionsUrl}

Note: Runtime logs are not available via REST API.
      Use Log Drains (Pro plan) for programmatic access.
      Or use Vercel CLI: vercel logs <deployment-url>
`);
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
