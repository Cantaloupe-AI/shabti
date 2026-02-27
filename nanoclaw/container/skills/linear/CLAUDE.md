# Linear Skill - Claude Instructions

## WHEN TO USE THIS SKILL

**Use this skill for ALL Linear issue management operations.** This includes:

- Creating issues
- Listing/searching issues
- Getting issue details
- Updating issue status, labels, assignees
- Adding comments to issues
- Listing teams and labels

## Configuration

| Setting | Value |
|---------|-------|
| Default Team | `Cantaloupe Developers` |
| Default Assignee | Joshua (`35a174c3-0521-4fad-a6cb-bed8082d638e`) |
| API Endpoint | `https://api.linear.app/graphql` |

**Note:** When creating issues, assign to Joshua by default unless otherwise specified.

## Available Labels

Bug, help wanted, Improvement, Feature, Design, Prod, idea, Onboarding,
Process, Compliance, Business/design sync needed, QA, Style, Migrated, Product

## Environment Variables

**CRITICAL**: This skill requires `LINEAR_API_KEY` in the project root `.env.local` file.

```bash
# Add to .env.local
LINEAR_API_KEY=lin_api_xxxxxxxxxxxxx
```

## Quick Reference

### Creating an Issue

```bash
# Creates issue assigned to Joshua by default
bun /home/node/.claude/skills/linear/script.ts --action=create-issue \
  --title="Fix login bug" \
  --description="Users can't login with Google OAuth" \
  --labels=Bug,Prod

# Assign to someone else
bun /home/node/.claude/skills/linear/script.ts --action=create-issue \
  --title="Review PR" \
  --assignee=me
```

### Listing Issues

```bash
# My issues
bun /home/node/.claude/skills/linear/script.ts --action=list-issues --assignee=me

# Team issues
bun /home/node/.claude/skills/linear/script.ts --action=list-issues --team="Cantaloupe Developers"

# With limit
bun /home/node/.claude/skills/linear/script.ts --action=list-issues --limit=10
```

### Getting Issue Details

```bash
bun /home/node/.claude/skills/linear/script.ts --action=get-issue --id=MELON-123
```

### Updating an Issue

```bash
bun /home/node/.claude/skills/linear/script.ts --action=update-issue --id=MELON-123 --state=Done
bun /home/node/.claude/skills/linear/script.ts --action=update-issue --id=MELON-123 --labels=Bug,QA
```

### Adding a Comment

```bash
bun /home/node/.claude/skills/linear/script.ts --action=add-comment --id=MELON-123 --body="Fixed in PR #456"
```

### Listing Teams/Labels

```bash
bun /home/node/.claude/skills/linear/script.ts --action=list-teams
bun /home/node/.claude/skills/linear/script.ts --action=list-labels
```

### Listing Comments

```bash
bun /home/node/.claude/skills/linear/script.ts --action=list-comments --id=MELON-123
```

## Trigger Phrases

When you see these phrases, **use this skill**:

- "create a Linear issue" / "file an issue"
- "list my issues" / "show issues"
- "update the issue" / "change status"
- "add a comment to the issue"
- "what's the status of MELON-XXX"

## Running from Project Root

Always run scripts from the **project root directory**:

```bash
# CORRECT - Run from project root
bun /home/node/.claude/skills/linear/script.ts --action=list-teams

# WRONG - Environment variables won't be found
cd .claude/skills/linear && bun script.ts
```
