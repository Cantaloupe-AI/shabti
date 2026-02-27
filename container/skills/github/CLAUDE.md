# GitHub Skill

Wrapper around `gh` CLI for GitHub operations.

## Important Rules

- Merge PRs (`--action=merge-pr` is blocked) — humans must merge
- Approve PRs (`--action=approve-pr` is blocked) — humans must approve

## Usage

```bash
bun /home/node/.claude/skills/github/script.ts --action=<action> [options]
```

## PR Operations

### Create PR

```bash
bun /home/node/.claude/skills/github/script.ts --action=create-pr \
  --title="Add new feature" \
  --body="Description of changes" \
  --base=main \
  --head=feature-branch
```

Options:
- `--title` (required): PR title
- `--body`: PR description (optional)
- `--base`: Target branch (default: main)
- `--head`: Source branch (default: current branch)

### List PRs

```bash
bun /home/node/.claude/skills/github/script.ts --action=list-prs --state=open
```

Options:
- `--state`: open, closed, or all (default: open)

### View PR

```bash
bun /home/node/.claude/skills/github/script.ts --action=view-pr --number=123
```

### View PR Diff

```bash
bun /home/node/.claude/skills/github/script.ts --action=pr-diff --number=123
```

### Check PR Status

```bash
bun /home/node/.claude/skills/github/script.ts --action=pr-checks --number=123
```

### Comment on PR

```bash
bun /home/node/.claude/skills/github/script.ts --action=comment-pr \
  --number=123 \
  --body="Thanks for the contribution!"
```

### Close PR

```bash
bun /home/node/.claude/skills/github/script.ts --action=close-pr --number=123
```

### Checkout PR Locally

```bash
bun /home/node/.claude/skills/github/script.ts --action=checkout-pr --number=123
```

## Repo Operations

### View Repo Info

```bash
bun /home/node/.claude/skills/github/script.ts --action=repo-info
```

### Clone Repo

```bash
bun /home/node/.claude/skills/github/script.ts --action=clone \
  --repo=owner/repo \
  --dir=local-name
```

Options:
- `--repo` (required): Repository in owner/repo format
- `--dir`: Local directory name (optional)

## Error Handling

The script will exit with code 1 and print an error message if:
- Required parameters are missing
- The gh CLI command fails
- A blocked action is attempted

## Notes

- Issues are managed in Linear, not GitHub
- The gh CLI must be installed and authenticated
- All operations respect GitHub's rate limits