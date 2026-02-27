---
name: linear
description: Manage Linear issues including creating, listing, updating, and commenting
---

# Linear Issue Management

Manage Linear issues using the CLI script.

## Quick Commands

| Action | Command |
|--------|---------|
| Get issue | `bun /home/node/.claude/skills/linear/script.ts --action=get-issue --id=MELON-123` |
| List my issues | `bun /home/node/.claude/skills/linear/script.ts --action=list-issues --assignee=me` |
| Create issue | `bun /home/node/.claude/skills/linear/script.ts --action=create-issue --title="Title" --description="Desc"` |
| Update status | `bun /home/node/.claude/skills/linear/script.ts --action=update-issue --id=MELON-123 --state=Done` |
| Add comment | `bun /home/node/.claude/skills/linear/script.ts --action=add-comment --id=MELON-123 --body="Comment"` |
| List teams | `bun /home/node/.claude/skills/linear/script.ts --action=list-teams` |
| List labels | `bun /home/node/.claude/skills/linear/script.ts --action=list-labels` |

## Configuration

- **Default Team**: Cantaloupe Developers
- **Requires**: `LINEAR_API_KEY` in `.env.local`

## Available Labels

Bug, help wanted, Improvement, Feature, Design, Prod, idea, Onboarding, Process, Compliance, Business/design sync needed, QA, Style, Migrated, Product

## Examples

### Get issue details
```bash
bun /home/node/.claude/skills/linear/script.ts --action=get-issue --id=MELON-1289
```

### Create an issue with labels
```bash
bun /home/node/.claude/skills/linear/script.ts --action=create-issue \
  --title="Fix login bug" \
  --description="Users can't login with Google OAuth" \
  --labels=Bug,Prod
```

### Update issue state
```bash
bun /home/node/.claude/skills/linear/script.ts --action=update-issue --id=MELON-123 --state=Done
```

### Add labels to issue
```bash
bun /home/node/.claude/skills/linear/script.ts --action=update-issue --id=MELON-123 --labels=Bug,QA
```

## Important

Always run from **project root** - the script needs `.env.local` for the API key.
