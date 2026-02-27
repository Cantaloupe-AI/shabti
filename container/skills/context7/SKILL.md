---
name: context7
description: Fetch up-to-date documentation and code examples for any programming library
---

# Context7 Skill

Fetch up-to-date documentation and code examples for any programming library.

## Quick Reference

### Search for Library ID

```bash
bun /home/node/.claude/skills/context7/script.ts --action=search --library=react --query="hooks"
```

### Query Documentation

```bash
bun /home/node/.claude/skills/context7/script.ts --action=query --id=/websites/react_dev --query="useState examples"
```

### With Token Limit

```bash
bun /home/node/.claude/skills/context7/script.ts --action=query --id=/websites/react_dev --query="hooks" --tokens=10000
```

### JSON Output

```bash
bun /home/node/.claude/skills/context7/script.ts --action=search --library=next.js --query="app router" --format=json
```

## Two-Step Workflow

1. **Search first** to find the correct library ID
2. **Query** with the library ID to get documentation

Example:

```bash
# Step 1: Find library ID
bun /home/node/.claude/skills/context7/script.ts --action=search --library=supabase --query="authentication"

# Output shows: /supabase/supabase

# Step 2: Query documentation
bun /home/node/.claude/skills/context7/script.ts --action=query --id=/supabase/supabase --query="auth.signInWithPassword"
```

## Environment Variables

Requires `CONTEXT_7_API_KEY` in `.env.local`:

```bash
CONTEXT_7_API_KEY=ctx7sk-xxxxxxxxxxxxx
```

## When to Use

Use this skill when you need:

- Current documentation for any library
- Code examples and usage patterns
- API reference information
- Framework-specific guidance

## Replaces MCP Tools

This skill replaces:
- `mcp__context7__resolve-library-id` → `--action=search`
- `mcp__context7__query-docs` → `--action=query`
