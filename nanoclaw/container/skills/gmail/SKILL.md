---
name: gmail
description: Read, search, and draft emails via Gmail REST API
---

# Gmail Skill

Manage Gmail: list, read, search messages, and create drafts.

## Usage

```bash
bun /home/node/.claude/skills/gmail/script.ts --action=<action> [options]
```

## Actions

### List recent messages
```bash
bun /home/node/.claude/skills/gmail/script.ts --action=list-messages [--limit=10] [--label=INBOX]
```

### Read a specific message
```bash
bun /home/node/.claude/skills/gmail/script.ts --action=read-message --id=MESSAGE_ID
```

### Search messages
```bash
bun /home/node/.claude/skills/gmail/script.ts --action=search --query="from:someone subject:meeting" [--limit=10]
```

### Create a draft
```bash
bun /home/node/.claude/skills/gmail/script.ts --action=create-draft --to=recipient@example.com --subject="Draft subject" --body="Draft body"
```

### List drafts
```bash
bun /home/node/.claude/skills/gmail/script.ts --action=list-drafts [--limit=10]
```

## Notes

- OAuth tokens at `/home/node/.google-oauth/` (auto-refreshed)
- Primary account: joshua@trycantaloupe.com
- Gmail search query syntax: https://support.google.com/mail/answer/7190
- Body supports plain text. For longer bodies, use `--body-file=/path/to/file.txt`
- This skill does NOT send emails directly. Use `create-draft` and Josh will send manually.
