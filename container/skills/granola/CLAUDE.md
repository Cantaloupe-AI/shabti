# Granola Skill

Access Granola meeting notes via MCP. Requires OAuth authentication (browser flow).

## Setup

Run `--action=auth` first. It will print an OAuth URL for the user to open in their browser. Once authorized, tokens are saved to `data/granola-auth.json` and auto-refresh.

## When to Use

- User asks about meeting notes, recent meetings, or meeting summaries
- User wants to look up what was discussed in a meeting
- User needs transcripts from past meetings
- User wants to search across all their meeting notes

## Usage

```bash
# Authenticate (first time only)
bun /home/node/.claude/skills/granola/script.ts --action=auth

# List recent meetings
bun /home/node/.claude/skills/granola/script.ts --action=list-meetings

# Search across meetings
bun /home/node/.claude/skills/granola/script.ts --action=search --query="product roadmap"

# Get meeting details
bun /home/node/.claude/skills/granola/script.ts --action=get-meeting --id=MEETING_ID

# Get transcript
bun /home/node/.claude/skills/granola/script.ts --action=get-transcript --id=MEETING_ID

# Show available MCP tools
bun /home/node/.claude/skills/granola/script.ts --action=list-tools
```

## Auth

Uses OAuth 2.0 with PKCE via Granola's MCP auth server. Tokens stored in `data/granola-auth.json`. Refresh tokens are used automatically when access tokens expire.
