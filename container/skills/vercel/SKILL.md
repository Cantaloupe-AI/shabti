---
name: vercel
description: Read-only skill for checking Vercel deployments, build logs, and project status
---

# Vercel Skill

A read-only skill for checking Vercel deployments, build logs, and project status.

## Setup

This skill requires a Vercel API token. The token should already be in your `.env.local` file as `VERCEL_KEY`.

If you need to create a new token:
1. Go to https://vercel.com/account/tokens
2. Create a new token with read access
3. Add to `.env.local`: `VERCEL_KEY=your_token_here`

## Usage

```bash
# List all projects
bun /home/node/.claude/skills/vercel/script.ts --action=list-projects

# Get project details
bun /home/node/.claude/skills/vercel/script.ts --action=get-project --name=union

# List recent deployments
bun /home/node/.claude/skills/vercel/script.ts --action=list-deployments --project=union --limit=10

# List only failed deployments
bun /home/node/.claude/skills/vercel/script.ts --action=list-deployments --project=union --state=ERROR

# Get deployment details
bun /home/node/.claude/skills/vercel/script.ts --action=get-deployment --id=dpl_xxxxx

# Get build logs
bun /home/node/.claude/skills/vercel/script.ts --action=get-build-logs --id=dpl_xxxxx

# List environment variables (keys only)
bun /home/node/.claude/skills/vercel/script.ts --action=list-env-vars --project=union

# List teams
bun /home/node/.claude/skills/vercel/script.ts --action=list-teams
```

## Available Actions

| Action | Description | Options |
|--------|-------------|---------|
| `list-projects` | List all projects | `--team`, `--limit` |
| `get-project` | Get project details | `--name` or `--id` |
| `list-deployments` | List deployments | `--project`, `--state`, `--target`, `--limit` |
| `get-deployment` | Get deployment details | `--id` |
| `get-build-logs` | Get build logs for a deployment | `--id`, `--limit` |
| `list-env-vars` | List environment variables | `--project` |
| `list-teams` | List available teams | None |

## Deployment States

- `BUILDING` - Currently building
- `ERROR` - Build or deployment failed
- `INITIALIZING` - Starting up
- `QUEUED` - Waiting in queue
- `READY` - Successfully deployed
- `CANCELED` - Deployment was canceled

## Security

- This skill is **read-only** - no destructive operations are possible
- Environment variable values are **never exposed** - only keys and metadata
- All API requests are authenticated with your token

## Common Workflows

### Debugging a Failed Deployment

1. Find the failed deployment:
   ```bash
   bun /home/node/.claude/skills/vercel/script.ts --action=list-deployments --project=union --state=ERROR
   ```

2. Get the build logs:
   ```bash
   bun /home/node/.claude/skills/vercel/script.ts --action=get-build-logs --id=<deployment-id>
   ```

### Checking Production Status

```bash
bun /home/node/.claude/skills/vercel/script.ts --action=list-deployments --project=union --target=production --limit=3
```
