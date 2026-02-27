---
name: google-calendar
description: Manage Google Calendar events — list calendars, list/create/update/delete events across work and personal calendars
---

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

## Actions

### List calendars
```bash
bun /home/node/.claude/skills/google-calendar/script.ts --action=list-calendars
```

### List upcoming events
```bash
# From primary calendar
bun /home/node/.claude/skills/google-calendar/script.ts --action=list-events [--limit=10]

# From a specific calendar
bun /home/node/.claude/skills/google-calendar/script.ts --action=list-events --calendar=joshuatanderson1@gmail.com [--limit=10]

# Events in a date range
bun /home/node/.claude/skills/google-calendar/script.ts --action=list-events --after=2026-02-25 --before=2026-02-28
```

### Search events
```bash
bun /home/node/.claude/skills/google-calendar/script.ts --action=search-events --query="standup" [--calendar=primary] [--limit=10] [--after=2026-01-01] [--before=2026-12-31]
```
Searches event titles, descriptions, locations, and attendees. Defaults to 1 year back and 1 year ahead.

### Create an event
```bash
bun /home/node/.claude/skills/google-calendar/script.ts --action=create-event \
  --summary="Team standup" \
  --start="2026-02-26T09:00:00" \
  --end="2026-02-26T09:30:00" \
  [--calendar=joshuatanderson1@gmail.com] \
  [--description="Weekly sync"] \
  [--location="Zoom"]
```

### Update an event
```bash
bun /home/node/.claude/skills/google-calendar/script.ts --action=update-event \
  --event-id=abc123 \
  [--calendar=primary] \
  [--summary="New title"] \
  [--start="2026-02-26T10:00:00"] \
  [--end="2026-02-26T10:30:00"] \
  [--description="Updated notes"] \
  [--location="Room 2"]
```

### Delete an event
```bash
bun /home/node/.claude/skills/google-calendar/script.ts --action=delete-event --event-id=abc123 [--calendar=primary]
```

## Important
- Default calendar is `primary` (the authenticated account's main calendar)
- Use `--calendar=<email>` to target a specific calendar (e.g. a shared/personal one)
- Date/time values use ISO 8601 format; times are interpreted in the system timezone
- The `--after` and `--before` flags accept dates (YYYY-MM-DD) or datetimes (ISO 8601)
- Event IDs are returned by `list-events` and `create-event`
