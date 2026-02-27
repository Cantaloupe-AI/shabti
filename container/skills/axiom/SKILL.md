---
name: axiom
description: Read-only skill for querying logs and inspecting datasets via the Axiom API
---

# Axiom Log Query Skill

Read-only skill for querying logs and inspecting datasets via the Axiom API.

## Setup

Requires `AXIOM_QUERY_TOKEN` (query-scoped token) and `NEXT_PUBLIC_AXIOM_DATASET` in `.env.local` (already configured).

**Note:** This is separate from `NEXT_PUBLIC_AXIOM_TOKEN` which is the ingest-only client-side token used by `next-axiom`.

## Usage

```bash
# List all datasets
bun /home/node/.claude/skills/axiom/script.ts --action=list-datasets

# List fields in default dataset
bun /home/node/.claude/skills/axiom/script.ts --action=list-fields

# List fields in a specific dataset
bun /home/node/.claude/skills/axiom/script.ts --action=list-fields --dataset=vercel-logs

# Get recent logs (last hour, 50 results)
bun /home/node/.claude/skills/axiom/script.ts --action=recent-logs

# Get recent logs with limit and time range
bun /home/node/.claude/skills/axiom/script.ts --action=recent-logs --limit=20 --range=4h

# Get error logs from the last 24 hours
bun /home/node/.claude/skills/axiom/script.ts --action=errors --range=24h

# Search logs for a text pattern
bun /home/node/.claude/skills/axiom/script.ts --action=search --search="login" --range=1h

# Filter logs by field values
bun /home/node/.claude/skills/axiom/script.ts --action=recent-logs --filter="status == 500" --range=4h

# Show specific fields only
bun /home/node/.claude/skills/axiom/script.ts --action=recent-logs --fields="_time,request.path,status" --limit=10

# Run a raw APL query
bun /home/node/.claude/skills/axiom/script.ts --action=query --apl="['vercel-logs'] | where status >= 400 | summarize count() by bin_auto(_time)" --range=24h

# Output raw JSON
bun /home/node/.claude/skills/axiom/script.ts --action=recent-logs --raw
```

## Available Actions

| Action | Description | Required Options |
|--------|-------------|------------------|
| `list-datasets` | List all datasets | None |
| `get-dataset` | Get dataset details | `--id` or `--dataset` |
| `list-fields` | List fields for a dataset | None (uses default dataset) |
| `query` | Run a raw APL query | `--apl` |
| `recent-logs` | Get recent logs | None (optional: `--filter`, `--fields`, `--limit`) |
| `errors` | Get recent error logs | None (optional: `--filter`, `--range`) |
| `search` | Search logs for text | `--search` |

## Time Range Options

- `--range=5m` — last 5 minutes
- `--range=1h` — last 1 hour (default)
- `--range=24h` — last 24 hours
- `--range=7d` — last 7 days
- `--start=<ISO>` / `--end=<ISO>` — explicit time range

## APL Quick Reference

APL (Axiom Processing Language) uses pipe-delimited operators:

```
['dataset-name']
| where status >= 400
| summarize count() by bin_auto(_time)
| sort by _time desc
| take 50
```

**Common operators:** `where`, `summarize`, `sort`, `take`, `project`, `extend`, `search`, `distinct`, `count`, `top`

**Common aggregations:** `count()`, `sum()`, `avg()`, `min()`, `max()`, `dcount()`, `percentile()`

**Time binning:** `bin_auto(_time)`, `bin(_time, 1h)`, `bin(_time, 5m)`

## Security

- This skill is **read-only** — no data ingestion or modification
- API token is read from `.env.local`, never logged
