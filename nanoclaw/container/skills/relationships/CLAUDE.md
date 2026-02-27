# Relationships Skill

Personal relationship tracker with exponential decay scoring across all communication channels.

## When to Use This Skill

Use this skill when the user asks about:
- Who they should reach out to or catch up with
- Adding or managing contacts
- Relationship health, scores, or status
- Logging that they met someone or had a call
- Fading or neglected relationships
- Unresolved contacts from Apple sync data

## Important

- The database is mounted read-only at `/workspace/project/store/messages.db`
- Write operations (add contact, log interaction, compute scores) produce IPC JSON files to `/workspace/ipc/relationships/`
- Always run `compute-scores` before checking `fading` status for accurate results
- When presenting fading contacts, include days since last contact and suggest a specific action

## Tiers and Thresholds

| Tier | Half-life | Score Threshold | Meaning |
|------|-----------|-----------------|---------|
| inner_circle | 14 days | 15 | Closest people — family, partner, best friends |
| close_friend | 30 days | 10 | Close friends you see regularly |
| good_friend | 60 days | 5 | Good friends, less frequent contact |
| acquaintance | 120 days | 2 | Professional contacts, casual friends |

## Status Meanings

- **healthy**: Score >= threshold — relationship is well-maintained
- **fading**: Score >= 50% of threshold — needs attention soon
- **urgent**: Score > 0 but < 50% of threshold — reach out now
- **dormant**: Score = 0 — no recent interactions at all

## Interaction Weights

| Type | Value | Description |
|------|-------|-------------|
| 1on1_meeting | 10 | In-person 1:1 meeting |
| call | 8 | Phone call |
| video_call | 8 | FaceTime/video call |
| manual_checkin | 6 | User-logged check-in |
| text_1on1 | 5 | 1:1 text conversation |
| group_meeting | 3 | Group meeting (calendar) |
| group_chat | 1 | Group chat participation |

## Common Workflows

### Morning nudge check
```bash
bun /home/node/.claude/skills/relationships/script.ts --action=compute-scores
bun /home/node/.claude/skills/relationships/script.ts --action=fading
```

### Add a new contact with cross-channel linking
```bash
bun /home/node/.claude/skills/relationships/script.ts --action=add --name="Jane Smith" --tier=close_friend --phone="+15551234567" --whatsapp="15551234567@s.whatsapp.net"
```

### Log a manual interaction
```bash
bun /home/node/.claude/skills/relationships/script.ts --action=log --contact="Jane Smith" --type=1on1_meeting --notes="Coffee at Blue Bottle"
```
