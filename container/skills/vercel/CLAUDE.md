# Vercel Skill - Claude Guidelines

## When to Use This Skill

Use this skill when the user asks about:

- "check the Vercel deployment" / "deployment status"
- "why did the build fail" / "build logs" / "deployment logs"
- "list Vercel projects"
- "show deployment history"
- "what's deployed to production"
- "Vercel environment variables" / "env vars"
- "recent deployments"
- "is the build passing?"
- "what's the deployment URL?"

## Important Restrictions

**This is a READ-ONLY skill.** It cannot:

- Create, update, or delete deployments
- Modify environment variables
- Change project settings
- Trigger new deployments

If the user asks for write operations, explain that this skill is read-only and they should use the Vercel dashboard or CLI directly.

## Available Actions

| Action | Description | Required Options |
|--------|-------------|------------------|
| `list-projects` | List all projects | None |
| `get-project` | Get project details | `--name` or `--id` |
| `list-deployments` | List deployments | None (optional: `--project`, `--state`, `--target`) |
| `get-deployment` | Get deployment details | `--id` |
| `get-build-logs` | Get build logs | `--id` |
| `list-env-vars` | List environment variables (keys only) | `--project` |
| `list-teams` | List available teams | None |

## Common Workflows

### Check why a deployment failed

```bash
# 1. List recent deployments to find the failed one
bun /home/node/.claude/skills/vercel/script.ts --action=list-deployments --project=union --state=ERROR --limit=5

# 2. Get the build logs for the specific deployment
bun /home/node/.claude/skills/vercel/script.ts --action=get-build-logs --id=<deployment-id>
```

### Check what's currently deployed to production

```bash
# List only production deployments
bun /home/node/.claude/skills/vercel/script.ts --action=list-deployments --project=union --target=production --limit=5
```

### Check environment variables exist

```bash
# Lists keys only - values are never exposed
bun /home/node/.claude/skills/vercel/script.ts --action=list-env-vars --project=union
```

## Output Format

All commands output JSON for easy parsing. Build logs also include a formatted text version for readability.

## Security Notes

- Environment variable VALUES are never exposed - only keys and metadata
- The API token is validated on every request
- Rate limits are logged when running low
- This skill cannot modify anything in Vercel

## Project Name

The main project is typically `union` or can be found via `list-projects`.
