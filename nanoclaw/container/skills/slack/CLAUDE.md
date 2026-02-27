# Slack Skill

Access Slack workspace. Search, read, and post messages in channels and threads.

## When to Use

- User asks about Slack conversations or messages
- User wants to find a discussion that happened in Slack
- User needs context from a Slack channel or thread
- User asks "what's happening in #channel"
- User asks to post a message to a Slack channel

## Usage

```bash
bun /home/node/.claude/skills/slack/script.ts --action=<action> [options]
```

## Actions

### List channels
```bash
bun /home/node/.claude/skills/slack/script.ts --action=list-channels [--limit=20]
```

### Read recent messages from a channel
```bash
# By name
bun /home/node/.claude/skills/slack/script.ts --action=read-channel --channel=general [--limit=20]

# By ID
bun /home/node/.claude/skills/slack/script.ts --action=read-channel --channel=C01ABC123 [--limit=20]
```

### Read a thread
```bash
bun /home/node/.claude/skills/slack/script.ts --action=read-thread --channel=C01ABC123 --thread=1234567890.123456
```
The `--thread` value is the `thread_ts` from a parent message.

### Search messages
```bash
bun /home/node/.claude/skills/slack/script.ts --action=search --query="product roadmap" [--limit=20]
```

### Look up a user
```bash
bun /home/node/.claude/skills/slack/script.ts --action=get-user --id=U01ABC123
```

### Post a message
```bash
bun /home/node/.claude/skills/slack/script.ts --action=post --channel=general --text="Hello!"
```

## Important
- **Search requires a user token** -- `SLACK_USER_OAUTH_TOKEN` (xoxp-) must be set for search to work. Other actions use the bot token.
- **Bot must be in the channel** -- a workspace admin needs to invite the bot to channels before `read-channel` works
- User IDs in messages are automatically resolved to display names
- Channel names can be used instead of IDs for `read-channel`
- Search uses Slack's built-in search (supports Slack search operators)
