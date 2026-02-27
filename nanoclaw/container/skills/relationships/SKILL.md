---
name: relationships
description: Track and maintain personal relationships with exponential decay scoring
---

# Relationships

Track contacts across all communication channels (WhatsApp, Telegram, iMessage, phone, FaceTime, calendar). Computes relationship health scores using exponential decay and alerts when relationships need attention.

## When to Use

- User asks about relationships, contacts, or who to reach out to
- User wants to add, update, or manage contacts
- User asks about fading or neglected relationships
- User wants to log a manual interaction (met someone, had a call)
- User asks to check relationship scores or status

## Usage

```bash
bun /home/node/.claude/skills/relationships/script.ts --action=<action> [options]
```

## Actions

### list
List all contacts with current scores and status.
```bash
bun /home/node/.claude/skills/relationships/script.ts --action=list
```

### get
Get detail view for a specific contact.
```bash
bun /home/node/.claude/skills/relationships/script.ts --action=get --contact="Name or ID"
```

### add
Create a new contact.
```bash
bun /home/node/.claude/skills/relationships/script.ts --action=add --name="John Doe" --tier=close_friend [--phone="+15551234567"] [--email="john@example.com"] [--whatsapp="15551234567@s.whatsapp.net"] [--telegram="tg:12345"]
```

Tiers: `inner_circle`, `close_friend`, `good_friend`, `acquaintance`

### update
Update a contact's tier, notes, or other fields.
```bash
bun /home/node/.claude/skills/relationships/script.ts --action=update --contact="Name or ID" [--tier=inner_circle] [--notes="Met at conference"]
```

### log
Log a manual interaction (e.g., met for coffee, had a phone call).
```bash
bun /home/node/.claude/skills/relationships/script.ts --action=log --contact="Name or ID" --type=manual_checkin [--notes="Had lunch together"]
```

Types: `1on1_meeting`, `call`, `video_call`, `manual_checkin`, `group_meeting`

### fading
Show contacts below their tier threshold, sorted by urgency.
```bash
bun /home/node/.claude/skills/relationships/script.ts --action=fading
```

### unresolved
Show Apple sync interactions with no matching contact.
```bash
bun /home/node/.claude/skills/relationships/script.ts --action=unresolved
```

### compute-scores
Trigger score computation for all contacts.
```bash
bun /home/node/.claude/skills/relationships/script.ts --action=compute-scores
```

### merge
Merge duplicate contacts (moves all identifiers and interactions to target).
```bash
bun /home/node/.claude/skills/relationships/script.ts --action=merge --source=3 --target=7
```
