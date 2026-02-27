---
name: github
description: Manage GitHub PRs and repos using the gh CLI
---

# GitHub Skill

Manage GitHub PRs and repos using the `gh` CLI.

## Quick Reference

```bash
# List open PRs
bun /home/node/.claude/skills/github/script.ts --action=list-prs

# View PR details
bun /home/node/.claude/skills/github/script.ts --action=view-pr --number=123

# Create PR
bun /home/node/.claude/skills/github/script.ts --action=create-pr --title="Add feature" --body="Description"

# Comment on PR
bun /home/node/.claude/skills/github/script.ts --action=comment-pr --number=123 --body="LGTM"

# View repo info
bun /home/node/.claude/skills/github/script.ts --action=repo-info
```

## Blocked Actions

- `merge-pr` - Humans must merge
- `approve-pr` - Humans must approve

See `CLAUDE.md` for full documentation.