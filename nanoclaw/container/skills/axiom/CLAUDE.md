# Axiom Skill - Claude Guidelines

## When to Use This Skill

Use this skill when the user asks about:

- "check the logs" / "show me logs"
- "any errors?" / "recent errors" / "error logs"
- "what's happening in production" / "prod logs"
- "search logs for X" / "find in logs"
- "Axiom query" / "run APL"
- "what fields are available" / "log schema"
- "list datasets" / "what datasets do we have"
- "pull logs from Axiom"

## Important Restrictions

**This is a READ-ONLY skill.** It cannot:

- Ingest or write data
- Create, update, or delete datasets
- Modify monitors or alerts
- Change any configuration

## Environment Variables

**Required** (already in `.env.local`):
- `AXIOM_QUERY_TOKEN` — Axiom API token with Query permissions (server-side only)
- `NEXT_PUBLIC_AXIOM_DATASET` — Default dataset name (currently `vercel-logs`)

**Note:** `NEXT_PUBLIC_AXIOM_TOKEN` is a separate ingest-only token used by `next-axiom` on the client side. This skill uses `AXIOM_QUERY_TOKEN` which has read/query permissions.

## Common Workflows

### Check for recent errors

```bash
bun /home/node/.claude/skills/axiom/script.ts --action=errors --range=1h
```

### Investigate a specific endpoint

```bash
bun /home/node/.claude/skills/axiom/script.ts --action=recent-logs --filter="['request.path'] contains '/api/applications'" --range=4h
```

### Check request volume

```bash
bun /home/node/.claude/skills/axiom/script.ts --action=query --apl="['vercel-logs'] | summarize count() by bin_auto(_time)" --range=24h
```

### Find slow requests

```bash
bun /home/node/.claude/skills/axiom/script.ts --action=query --apl="['vercel-logs'] | where ['duration'] > 5000 | sort by duration desc | take 20" --range=24h
```

### Search for a specific error message

```bash
bun /home/node/.claude/skills/axiom/script.ts --action=search --search="TypeError" --range=4h
```

### Discover available fields

```bash
# Always run this first if you're unsure what fields exist
bun /home/node/.claude/skills/axiom/script.ts --action=list-fields
```

## APL Tips

- Dataset names with special characters need quoting: `['vercel-logs']`
- Field names with dots/dashes need quoting: `['request.path']`, `['response.status']`
- Use `search "text"` for full-text search across all fields
- Use `where` for field-specific filtering
- Use `summarize count() by field` for aggregations
- Use `bin_auto(_time)` for automatic time bucketing
- Use `bin(_time, 1h)` for specific time intervals

## Output

- By default, results are formatted as readable text
- Use `--raw` flag for JSON output (useful for further processing)
- The APL query is always printed before results for transparency
