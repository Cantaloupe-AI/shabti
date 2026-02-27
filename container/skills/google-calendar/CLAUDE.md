# Google Calendar Skill

Manage Google Calendar. List calendars, list upcoming events, create, update, and delete events.

## When to Use

- User asks about their schedule or upcoming events
- User wants to create, move, or cancel a meeting
- User asks "what's on my calendar"
- User wants to check availability
- User asks to schedule something

## Usage

```bash
bun /home/node/.claude/skills/google-calendar/script.ts --action=<action> [options]
```

## Quick Reference

| Action | Required flags | Optional flags |
|--------|---------------|----------------|
| `list-calendars` | | |
| `list-events` | | `--calendar`, `--limit`, `--after`, `--before` |
| `search-events` | `--query` | `--calendar`, `--limit`, `--after`, `--before` |
| `create-event` | `--summary`, `--start`, `--end` | `--calendar`, `--description`, `--location` |
| `update-event` | `--event-id` | `--calendar`, `--summary`, `--start`, `--end`, `--description`, `--location` |
| `delete-event` | `--event-id` | `--calendar` |

## Notes
- OAuth tokens are at `/home/node/.google-oauth/` — auto-refreshed by the script
- Default calendar is `primary` (joshua@trycantaloupe.com)
- Personal calendar: use `--calendar=joshuatanderson1@gmail.com`
