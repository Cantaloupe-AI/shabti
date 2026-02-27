# Gmail Skill

Read, search, and draft emails via the Gmail API.

## When to Use

- User asks about their email or inbox
- User asks to draft a response
- User wants to search for an email or find a thread
- User asks "check my email" or "any important emails"
- Morning briefing or digest needs email context

## Usage

```bash
bun /home/node/.claude/skills/gmail/script.ts --action=<action> [options]
```

## Quick Reference

| Action | Required flags | Optional flags |
|--------|---------------|----------------|
| `list-messages` | | `--limit`, `--label` |
| `read-message` | `--id` | |
| `search` | `--query` | `--limit` |
| `create-draft` | `--to`, `--subject`, `--body` | `--cc`, `--bcc`, `--body-file` |
| `list-drafts` | | `--limit` |

## Notes
- OAuth tokens at `/home/node/.google-oauth/` — auto-refreshed
- Primary account: joshua@trycantaloupe.com
- Gmail search syntax works in `--query` (e.g., `from:someone is:unread newer_than:1d`)
- This skill can only READ and DRAFT emails. It cannot send directly — drafts must be sent manually by Josh.
