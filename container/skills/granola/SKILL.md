---
name: granola
description: Access Granola meeting notes, transcripts, and search via OAuth-authenticated MCP
---

# Granola Skill

## Quick Reference

```bash
# Authenticate (browser OAuth - run once)
bun /home/node/.claude/skills/granola/script.ts --action=auth

# List meetings
bun /home/node/.claude/skills/granola/script.ts --action=list-meetings [--query=FILTER]

# Search across meeting notes
bun /home/node/.claude/skills/granola/script.ts --action=search --query="topic"

# Get meeting details
bun /home/node/.claude/skills/granola/script.ts --action=get-meeting --id=MEETING_ID

# Get meeting transcript (paid Granola tiers)
bun /home/node/.claude/skills/granola/script.ts --action=get-transcript --id=MEETING_ID

# List available MCP tools
bun /home/node/.claude/skills/granola/script.ts --action=list-tools
```

## Actions

### auth
Runs browser OAuth flow. Opens a local callback server on port 8976, prints auth URL for user. Tokens saved to `data/granola-auth.json`.

### list-meetings
List meetings with optional query filter.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `--query` | No | Filter/search meetings |

### search
Semantic search across all meeting notes.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `--query` | Yes | Search query |

### get-meeting
Get full meeting details including notes and attendees.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `--id` | Yes | Meeting ID |

### get-transcript
Get raw transcript for a meeting (paid Granola tiers only).

| Parameter | Required | Description |
|-----------|----------|-------------|
| `--id` | Yes | Meeting ID |

### list-tools
Show all available MCP tools from Granola's server.

## Setup

1. Run `--action=auth`
2. Open the printed URL in your browser
3. Authorize Granola access
4. Browser redirects to localhost - tokens are captured and saved
5. Done! All other actions will use the saved tokens (auto-refreshes)
