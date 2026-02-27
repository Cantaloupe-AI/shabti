#!/usr/bin/env bun
/**
 * Linear Skill CLI
 *
 * Usage:
 *   bun /home/node/.claude/skills/linear/script.ts --action=list-teams
 *   bun /home/node/.claude/skills/linear/script.ts --action=list-labels
 *   bun /home/node/.claude/skills/linear/script.ts --action=list-issues --assignee=me
 *   bun /home/node/.claude/skills/linear/script.ts --action=get-issue --id=MELON-123
 *   bun /home/node/.claude/skills/linear/script.ts --action=create-issue --title="Fix bug" --labels=Bug,Prod
 *   bun /home/node/.claude/skills/linear/script.ts --action=update-issue --id=MELON-123 --state=Done
 *   bun /home/node/.claude/skills/linear/script.ts --action=add-comment --id=MELON-123 --body="Fixed in PR #456"
 */

import {
  LINEAR_CONFIG,
  listTeams,
  getTeamByName,
  listLabels,
  getLabelIdsByNames,
  listIssues,
  getIssue,
  getViewer,
  createIssue,
  updateIssue,
  createComment,
  listComments,
} from './src/index.ts';

type Action =
  | 'list-teams'
  | 'list-labels'
  | 'list-issues'
  | 'get-issue'
  | 'create-issue'
  | 'update-issue'
  | 'add-comment'
  | 'list-comments';

interface CLIArgs {
  action?: Action;
  id?: string;
  title?: string;
  description?: string;
  labels?: string[];
  team?: string;
  assignee?: string;
  state?: string;
  body?: string;
  limit?: number;
}

/**
 * Parses command line arguments
 */
function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const result: CLIArgs = {};

  const validActions = [
    'list-teams',
    'list-labels',
    'list-issues',
    'get-issue',
    'create-issue',
    'update-issue',
    'add-comment',
    'list-comments',
  ];

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
    } else if (arg.startsWith('--id=')) {
      result.id = arg.split('=').slice(1).join('=');
    } else if (arg.startsWith('--title=')) {
      result.title = arg.split('=').slice(1).join('=');
    } else if (arg.startsWith('--description=')) {
      result.description = arg.split('=').slice(1).join('=');
    } else if (arg.startsWith('--labels=')) {
      result.labels = arg
        .split('=')
        .slice(1)
        .join('=')
        .split(',')
        .map((l) => l.trim());
    } else if (arg.startsWith('--team=')) {
      result.team = arg.split('=').slice(1).join('=');
    } else if (arg.startsWith('--assignee=')) {
      result.assignee = arg.split('=').slice(1).join('=');
    } else if (arg.startsWith('--state=')) {
      result.state = arg.split('=').slice(1).join('=');
    } else if (arg.startsWith('--body=')) {
      result.body = arg.split('=').slice(1).join('=');
    } else if (arg.startsWith('--limit=')) {
      result.limit = parseInt(arg.split('=')[1], 10);
    }
  }

  return result;
}

/**
 * Get team ID by name, using default if not specified
 */
async function resolveTeamId(teamName?: string): Promise<string> {
  const name = teamName || LINEAR_CONFIG.defaultTeam;
  const team = await getTeamByName(name);
  if (!team) {
    throw new Error(`Team "${name}" not found`);
  }
  return team.id;
}

/**
 * Get viewer ID if assignee is "me"
 */
async function resolveAssigneeId(assignee?: string): Promise<string | undefined> {
  if (!assignee) return undefined;
  if (assignee.toLowerCase() === 'me') {
    const viewer = await getViewer();
    return viewer.id;
  }
  return assignee;
}

/**
 * Main CLI handler
 */
async function main(): Promise<void> {
  const args = parseArgs();

  console.log(`[Linear] Default team: ${LINEAR_CONFIG.defaultTeam}`);

  if (!args.action) {
    console.log('\nNo action specified. Available actions:');
    console.log('  --action=list-teams');
    console.log('  --action=list-labels');
    console.log('  --action=list-issues [--assignee=me] [--team=...] [--limit=50]');
    console.log('  --action=get-issue --id=MELON-123');
    console.log('  --action=create-issue --title="..." [--description="..."] [--labels=Bug,Prod] [--team=...]');
    console.log('  --action=update-issue --id=MELON-123 [--state=Done] [--labels=...]');
    console.log('  --action=add-comment --id=MELON-123 --body="..."');
    console.log('  --action=list-comments --id=MELON-123');
    return;
  }

  console.log(`\n[Action] ${args.action}`);

  try {
    switch (args.action) {
      case 'list-teams': {
        const teams = await listTeams();
        console.log('\nTeams:');
        for (const team of teams) {
          console.log(`  ${team.key}: ${team.name}${team.description ? ` - ${team.description}` : ''}`);
        }
        break;
      }

      case 'list-labels': {
        const teamId = args.team ? await resolveTeamId(args.team) : undefined;
        const labels = await listLabels(teamId);
        console.log('\nLabels:');
        for (const label of labels) {
          console.log(`  ${label.name} (${label.color})`);
        }
        break;
      }

      case 'list-issues': {
        const teamId = args.team ? await resolveTeamId(args.team) : undefined;
        const assigneeId = await resolveAssigneeId(args.assignee);
        const issues = await listIssues({
          teamId,
          assigneeId,
          limit: args.limit || 50,
        });
        console.log(`\nIssues (${issues.length}):`);
        for (const issue of issues) {
          const labels = issue.labels.nodes.map((l) => l.name).join(', ');
          console.log(`  ${issue.identifier}: ${issue.title}`);
          console.log(`    State: ${issue.state.name} | Labels: ${labels || 'none'}`);
          if (issue.assignee) {
            console.log(`    Assignee: ${issue.assignee.displayName || issue.assignee.name}`);
          }
        }
        break;
      }

      case 'get-issue': {
        if (!args.id) {
          console.error('Error: --id is required for get-issue action');
          process.exit(1);
        }
        const issue = await getIssue(args.id);
        if (!issue) {
          console.error(`Issue "${args.id}" not found`);
          process.exit(1);
        }
        console.log('\nIssue Details:');
        console.log(`  Identifier: ${issue.identifier}`);
        console.log(`  Title: ${issue.title}`);
        console.log(`  State: ${issue.state.name}`);
        console.log(`  Team: ${issue.team.name}`);
        console.log(`  URL: ${issue.url}`);
        console.log(`  Labels: ${issue.labels.nodes.map((l) => l.name).join(', ') || 'none'}`);
        if (issue.assignee) {
          console.log(`  Assignee: ${issue.assignee.displayName || issue.assignee.name}`);
        }
        if (issue.description) {
          console.log(`\n  Description:\n${issue.description.split('\n').map((l) => '    ' + l).join('\n')}`);
        }
        break;
      }

      case 'create-issue': {
        if (!args.title) {
          console.error('Error: --title is required for create-issue action');
          process.exit(1);
        }

        const teamId = await resolveTeamId(args.team);
        let labelIds: string[] | undefined;

        if (args.labels && args.labels.length > 0) {
          labelIds = await getLabelIdsByNames(args.labels, teamId);
          if (labelIds.length === 0) {
            console.warn('Warning: No valid labels found');
          }
        }

        // Default assignee is Joshua unless specified otherwise
        const DEFAULT_ASSIGNEE_ID = '35a174c3-0521-4fad-a6cb-bed8082d638e'; // Joshua
        const assigneeId = await resolveAssigneeId(args.assignee) || DEFAULT_ASSIGNEE_ID;

        console.log(`\nCreating issue...`);
        console.log(`  Title: ${args.title}`);
        console.log(`  Team: ${args.team || LINEAR_CONFIG.defaultTeam}`);
        console.log(`  Assignee: ${args.assignee || 'Joshua (default)'}`);
        if (args.labels) {
          console.log(`  Labels: ${args.labels.join(', ')}`);
        }

        const issue = await createIssue({
          title: args.title,
          description: args.description,
          teamId,
          labelIds,
          assigneeId,
        });

        console.log(`\nIssue created successfully!`);
        console.log(`  Identifier: ${issue.identifier}`);
        console.log(`  URL: ${issue.url}`);
        break;
      }

      case 'update-issue': {
        if (!args.id) {
          console.error('Error: --id is required for update-issue action');
          process.exit(1);
        }

        // First, get the issue to find its ID
        const existingIssue = await getIssue(args.id);
        if (!existingIssue) {
          console.error(`Issue "${args.id}" not found`);
          process.exit(1);
        }

        const updateInput: Record<string, unknown> = {};

        if (args.title) {
          updateInput.title = args.title;
        }

        if (args.description) {
          updateInput.description = args.description;
        }

        if (args.labels && args.labels.length > 0) {
          const labelIds = await getLabelIdsByNames(args.labels, existingIssue.team.id);
          updateInput.labelIds = labelIds;
        }

        if (args.state) {
          // We need to look up the state ID
          const { linearQuery } = await import('./src/client.ts');
          const statesResult = await linearQuery<{
            workflowStates: { nodes: Array<{ id: string; name: string }> };
          }>(`
            query GetStates($teamId: String!) {
              workflowStates(filter: { team: { id: { eq: $teamId } } }) {
                nodes {
                  id
                  name
                }
              }
            }
          `, { teamId: existingIssue.team.id });

          const state = statesResult.workflowStates.nodes.find(
            (s) => s.name.toLowerCase() === args.state?.toLowerCase()
          );
          if (!state) {
            console.error(`State "${args.state}" not found. Available states:`);
            for (const s of statesResult.workflowStates.nodes) {
              console.log(`  - ${s.name}`);
            }
            process.exit(1);
          }
          updateInput.stateId = state.id;
        }

        if (Object.keys(updateInput).length === 0) {
          console.error('Error: No update fields specified');
          process.exit(1);
        }

        console.log(`\nUpdating issue ${args.id}...`);
        const updated = await updateIssue(existingIssue.id, updateInput);

        console.log(`\nIssue updated successfully!`);
        console.log(`  Identifier: ${updated.identifier}`);
        console.log(`  State: ${updated.state.name}`);
        console.log(`  URL: ${updated.url}`);
        break;
      }

      case 'add-comment': {
        if (!args.id) {
          console.error('Error: --id is required for add-comment action');
          process.exit(1);
        }
        if (!args.body) {
          console.error('Error: --body is required for add-comment action');
          process.exit(1);
        }

        // First, get the issue to find its ID
        const issue = await getIssue(args.id);
        if (!issue) {
          console.error(`Issue "${args.id}" not found`);
          process.exit(1);
        }

        console.log(`\nAdding comment to ${args.id}...`);
        const comment = await createComment({
          issueId: issue.id,
          body: args.body,
        });

        console.log(`\nComment added successfully!`);
        console.log(`  ID: ${comment.id}`);
        console.log(`  Created: ${comment.createdAt}`);
        break;
      }

      case 'list-comments': {
        if (!args.id) {
          console.error('Error: --id is required for list-comments action');
          process.exit(1);
        }

        const issue = await getIssue(args.id);
        if (!issue) {
          console.error(`Issue "${args.id}" not found`);
          process.exit(1);
        }

        const comments = await listComments(issue.id);
        console.log(`\nComments on ${args.id} (${comments.length}):`);
        for (const comment of comments) {
          console.log(`\n  [${comment.createdAt}] ${comment.user.displayName || comment.user.name}:`);
          console.log(`  ${comment.body.split('\n').map((l) => '    ' + l).join('\n')}`);
        }
        break;
      }

      default:
        console.error(`Unknown action: ${args.action}`);
        process.exit(1);
    }
  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
