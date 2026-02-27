# Context7 Skill - Claude Instructions

## WHEN TO USE THIS SKILL

**Use this skill for ALL documentation lookup operations.** This includes:

- Finding library IDs for any npm/programming library
- Fetching current documentation and code examples
- Getting API reference information
- Looking up framework-specific patterns

## Environment Variables

**CRITICAL**: This skill requires `CONTEXT_7_API_KEY` in the project root `.env.local` file.

```bash
# Add to .env.local
CONTEXT_7_API_KEY=ctx7sk-xxxxxxxxxxxxx
```

## Quick Reference

### Search for Library ID (Step 1)

Always search first to find the correct library ID:

```bash
bun /home/node/.claude/skills/context7/script.ts --action=search --library=react --query="hooks"
```

Output includes:
- Library ID (e.g., `/facebook/react` or `/websites/react_dev`)
- Name and description
- Total snippets available
- Trust score and benchmark score

### Query Documentation (Step 2)

Use the library ID from search to get documentation:

```bash
bun /home/node/.claude/skills/context7/script.ts --action=query --id=/websites/react_dev --query="useState hook"
```

Options:
- `--tokens=10000` - Increase max tokens for more content (default: 5000)
- `--format=json` - Get JSON output for programmatic use

## Replaces MCP Tools

| MCP Tool | Skill Action |
|----------|--------------|
| `mcp__context7__resolve-library-id` | `--action=search` |
| `mcp__context7__query-docs` | `--action=query` |

## Trigger Phrases

When you see these phrases, **use this skill**:

- "look up the docs for X"
- "what's the API for X"
- "how do I use X library"
- "fetch documentation for X"
- "get current docs for X"
- "check the X documentation"
- "find code examples for X"

## Common Library IDs

| Library | Search For | Common ID |
|---------|------------|-----------|
| React | `react` | `/websites/react_dev` |
| Next.js | `next.js` | `/vercel/next.js` |
| Supabase | `supabase` | `/supabase/supabase` |
| TypeScript | `typescript` | `/microsoft/typescript` |
| Tailwind | `tailwind` | `/tailwindlabs/tailwindcss` |

**Note**: Always verify IDs with `--action=search` as they may change.

## Running from Project Root

Always run scripts from the **project root directory**:

```bash
# CORRECT - Run from project root
bun /home/node/.claude/skills/context7/script.ts --action=search --library=react --query="hooks"

# WRONG - Environment variables won't be found
cd .claude/skills/context7 && bun script.ts
```

## Error Handling

The client includes:
- Automatic retry with exponential backoff
- Rate limit handling (429 responses)
- API key validation

If you see rate limit errors, the script will automatically retry.
