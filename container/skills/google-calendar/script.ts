#!/usr/bin/env bun

/**
 * Google Calendar Skill
 *
 * List calendars, list/create/update/delete events via Google Calendar REST API.
 * OAuth credentials at ~/.google-oauth/ (auto-refreshes tokens).
 */

import { readFileSync, writeFileSync } from "fs";

const CREDS_DIR = "/home/node/.google-oauth";
const CLIENT_CREDS_PATH = `${CREDS_DIR}/client_credentials.json`;
const TOKENS_PATH = `${CREDS_DIR}/tokens.json`;
const BASE_URL = "https://www.googleapis.com/calendar/v3";

// Parse command line arguments
const args = process.argv.slice(2);
const params: Record<string, string> = {};

for (const arg of args) {
  const match = arg.match(/^--([a-z-]+)(?:=(.*))?$/);
  if (match) {
    params[match[1]] = match[2] ?? "true";
  }
}

const action = params.action;

if (!action) {
  console.error("Error: --action is required");
  console.error("\nAvailable actions:");
  console.error("  --action=list-calendars");
  console.error("  --action=list-events [--calendar=<id>] [--limit=N] [--after=DATE] [--before=DATE]");
  console.error("  --action=search-events --query=TEXT [--calendar=<id>] [--limit=N] [--after=DATE] [--before=DATE]");
  console.error("  --action=create-event --summary=TITLE --start=ISO --end=ISO [--calendar=<id>] [--description=...] [--location=...]");
  console.error("  --action=update-event --event-id=ID [--calendar=<id>] [--summary=...] [--start=...] [--end=...] [--description=...] [--location=...]");
  console.error("  --action=delete-event --event-id=ID [--calendar=<id>]");
  process.exit(1);
}

// Load OAuth credentials
let clientCreds: { client_id: string; client_secret: string; token_uri: string };
let tokens: { access_token: string; refresh_token: string; expires_in?: number; obtained_at?: number };

try {
  const raw = JSON.parse(readFileSync(CLIENT_CREDS_PATH, "utf-8"));
  const installed = raw.installed || raw.web || raw;
  clientCreds = {
    client_id: installed.client_id,
    client_secret: installed.client_secret,
    token_uri: installed.token_uri || "https://oauth2.googleapis.com/token",
  };
} catch {
  console.error(`Error: Cannot read client credentials at ${CLIENT_CREDS_PATH}`);
  process.exit(1);
}

try {
  tokens = JSON.parse(readFileSync(TOKENS_PATH, "utf-8"));
} catch {
  console.error(`Error: Cannot read tokens at ${TOKENS_PATH}`);
  process.exit(1);
}

async function refreshAccessToken(): Promise<void> {
  const res = await fetch(clientCreds.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientCreds.client_id,
      client_secret: clientCreds.client_secret,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json() as any;
  tokens.access_token = data.access_token;
  tokens.expires_in = data.expires_in;
  tokens.obtained_at = Date.now();

  // Persist so future invocations use the fresh token
  try {
    writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
  } catch {
    // Non-fatal: token still works for this invocation
  }
}

async function calendarFetch(path: string, init?: RequestInit): Promise<any> {
  const doFetch = async () => {
    const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    return res;
  };

  let res = await doFetch();

  // Auto-refresh on 401
  if (res.status === 401) {
    await refreshAccessToken();
    res = await doFetch();
  }

  if (res.status === 204) return null; // delete returns no content

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar API ${res.status}: ${text}`);
  }

  return res.json();
}

function calendarId(): string {
  return encodeURIComponent(params.calendar || "primary");
}

function parseLimit(): number {
  const n = parseInt(params.limit || "10", 10);
  if (isNaN(n) || n < 1) return 10;
  return Math.min(n, 250);
}

function formatEventTime(event: any): string {
  const start = event.start?.dateTime || event.start?.date || "?";
  const end = event.end?.dateTime || event.end?.date || "";

  if (event.start?.date && !event.start?.dateTime) {
    // All-day event
    if (event.end?.date && event.end.date !== event.start.date) {
      return `${event.start.date} - ${event.end.date} (all day)`;
    }
    return `${event.start.date} (all day)`;
  }

  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;
  const fmt = (d: Date) =>
    d.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  if (endDate && startDate.toDateString() === endDate.toDateString()) {
    // Same day — just show end time
    const endTime = endDate.toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${fmt(startDate)} - ${endTime}`;
  }

  return endDate ? `${fmt(startDate)} - ${fmt(endDate)}` : fmt(startDate);
}

// --- Actions ---

async function listCalendars(): Promise<void> {
  const data = await calendarFetch("/users/me/calendarList");

  if (!data.items?.length) {
    console.log("No calendars found.");
    return;
  }

  console.log(`Calendars (${data.items.length}):\n`);
  for (const cal of data.items) {
    const role = cal.accessRole || "";
    const primary = cal.primary ? " (primary)" : "";
    console.log(`  ${cal.summary}${primary}`);
    console.log(`    ID: ${cal.id}`);
    console.log(`    Access: ${role}`);
    if (cal.description) console.log(`    Description: ${cal.description}`);
    console.log();
  }
}

async function listEvents(): Promise<void> {
  const limit = parseLimit();
  const queryParams = new URLSearchParams({
    maxResults: String(limit),
    singleEvents: "true",
    orderBy: "startTime",
  });

  if (params.after) {
    const d = new Date(params.after);
    queryParams.set("timeMin", d.toISOString());
  } else {
    // Default: from now
    queryParams.set("timeMin", new Date().toISOString());
  }

  if (params.before) {
    const d = new Date(params.before);
    // If just a date, set to end of day
    if (params.before.length === 10) {
      d.setHours(23, 59, 59, 999);
    }
    queryParams.set("timeMax", d.toISOString());
  }

  const data = await calendarFetch(
    `/calendars/${calendarId()}/events?${queryParams}`
  );

  if (!data.items?.length) {
    console.log("No upcoming events found.");
    return;
  }

  const calName = params.calendar || "primary";
  console.log(`Events on ${calName} (${data.items.length}):\n`);
  for (const event of data.items) {
    const time = formatEventTime(event);
    const location = event.location ? ` @ ${event.location}` : "";
    console.log(`  ${event.summary || "(no title)"}`);
    console.log(`    When: ${time}${location}`);
    console.log(`    ID: ${event.id}`);
    if (event.description) {
      const desc = event.description.length > 100
        ? event.description.slice(0, 100) + "..."
        : event.description;
      console.log(`    Notes: ${desc}`);
    }
    console.log();
  }
}

async function searchEvents(): Promise<void> {
  const query = params.query;
  if (!query) {
    console.error("Error: --query is required for search-events");
    process.exit(1);
  }

  const limit = parseLimit();
  const queryParams = new URLSearchParams({
    maxResults: String(limit),
    singleEvents: "true",
    orderBy: "startTime",
    q: query,
  });

  // Default: search from 1 year ago to 1 year ahead
  if (params.after) {
    queryParams.set("timeMin", new Date(params.after).toISOString());
  } else {
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    queryParams.set("timeMin", yearAgo.toISOString());
  }

  if (params.before) {
    const d = new Date(params.before);
    if (params.before.length === 10) d.setHours(23, 59, 59, 999);
    queryParams.set("timeMax", d.toISOString());
  } else {
    const yearAhead = new Date();
    yearAhead.setFullYear(yearAhead.getFullYear() + 1);
    queryParams.set("timeMax", yearAhead.toISOString());
  }

  const data = await calendarFetch(
    `/calendars/${calendarId()}/events?${queryParams}`
  );

  if (!data.items?.length) {
    console.log(`No events matching "${query}".`);
    return;
  }

  const calName = params.calendar || "primary";
  console.log(`Search results for "${query}" on ${calName} (${data.items.length}):\n`);
  for (const event of data.items) {
    const time = formatEventTime(event);
    const location = event.location ? ` @ ${event.location}` : "";
    console.log(`  ${event.summary || "(no title)"}`);
    console.log(`    When: ${time}${location}`);
    console.log(`    ID: ${event.id}`);
    if (event.description) {
      const desc = event.description.length > 100
        ? event.description.slice(0, 100) + "..."
        : event.description;
      console.log(`    Notes: ${desc}`);
    }
    console.log();
  }
}

async function createEvent(): Promise<void> {
  const summary = params.summary;
  const start = params.start;
  const end = params.end;

  if (!summary) {
    console.error("Error: --summary is required for create-event");
    process.exit(1);
  }
  if (!start) {
    console.error("Error: --start is required for create-event (ISO 8601)");
    process.exit(1);
  }
  if (!end) {
    console.error("Error: --end is required for create-event (ISO 8601)");
    process.exit(1);
  }

  const body: any = {
    summary,
    start: { dateTime: new Date(start).toISOString() },
    end: { dateTime: new Date(end).toISOString() },
  };

  if (params.description) body.description = params.description;
  if (params.location) body.location = params.location;

  const data = await calendarFetch(`/calendars/${calendarId()}/events`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  console.log(`Event created: ${data.summary}`);
  console.log(`  ID: ${data.id}`);
  console.log(`  When: ${formatEventTime(data)}`);
  console.log(`  Link: ${data.htmlLink}`);
}

async function updateEvent(): Promise<void> {
  const eventId = params["event-id"];
  if (!eventId) {
    console.error("Error: --event-id is required for update-event");
    process.exit(1);
  }

  // Fetch current event first to merge changes
  const current = await calendarFetch(
    `/calendars/${calendarId()}/events/${encodeURIComponent(eventId)}`
  );

  const body: any = { ...current };
  // Remove read-only fields
  delete body.etag;
  delete body.kind;
  delete body.created;
  delete body.updated;
  delete body.creator;
  delete body.organizer;
  delete body.htmlLink;
  delete body.iCalUID;

  if (params.summary) body.summary = params.summary;
  if (params.description) body.description = params.description;
  if (params.location) body.location = params.location;
  if (params.start) body.start = { dateTime: new Date(params.start).toISOString() };
  if (params.end) body.end = { dateTime: new Date(params.end).toISOString() };

  const data = await calendarFetch(
    `/calendars/${calendarId()}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PUT",
      body: JSON.stringify(body),
    }
  );

  console.log(`Event updated: ${data.summary}`);
  console.log(`  ID: ${data.id}`);
  console.log(`  When: ${formatEventTime(data)}`);
}

async function deleteEvent(): Promise<void> {
  const eventId = params["event-id"];
  if (!eventId) {
    console.error("Error: --event-id is required for delete-event");
    process.exit(1);
  }

  await calendarFetch(
    `/calendars/${calendarId()}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" }
  );

  console.log(`Event deleted: ${eventId}`);
}

// --- Main ---

async function run(): Promise<void> {
  try {
    switch (action) {
      case "list-calendars":
        await listCalendars();
        break;
      case "list-events":
        await listEvents();
        break;
      case "search-events":
        await searchEvents();
        break;
      case "create-event":
        await createEvent();
        break;
      case "update-event":
        await updateEvent();
        break;
      case "delete-event":
        await deleteEvent();
        break;
      default:
        console.error(`Error: Unknown action '${action}'`);
        console.error("Available: list-calendars, list-events, search-events, create-event, update-event, delete-event");
        process.exit(1);
    }
  } catch (error: any) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

run();
