#!/usr/bin/env bun

/**
 * Gmail Skill
 *
 * List, read, search messages, and create drafts via Gmail REST API.
 * OAuth credentials at ~/.google-oauth/ (auto-refreshes tokens).
 *
 * NOTE: This skill intentionally does NOT send emails directly.
 * Use create-draft and send manually.
 */

import { readFileSync, writeFileSync } from "fs";

const CREDS_DIR = "/home/node/.google-oauth";
const CLIENT_CREDS_PATH = `${CREDS_DIR}/client_credentials.json`;
const TOKENS_PATH = `${CREDS_DIR}/tokens.json`;
const BASE_URL = "https://gmail.googleapis.com/gmail/v1/users/me";

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
  console.error("  --action=list-messages [--limit=10] [--label=INBOX]");
  console.error("  --action=read-message --id=MESSAGE_ID");
  console.error('  --action=search --query="search terms" [--limit=10]');
  console.error("  --action=create-draft --to=EMAIL --subject=TEXT --body=TEXT");
  console.error("  --action=list-drafts [--limit=10]");
  process.exit(1);
}

// Load OAuth credentials
let clientCreds: {
  client_id: string;
  client_secret: string;
  token_uri: string;
};
let tokens: {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  obtained_at?: number;
};

try {
  const raw = JSON.parse(readFileSync(CLIENT_CREDS_PATH, "utf-8"));
  const installed = raw.installed || raw.web || raw;
  clientCreds = {
    client_id: installed.client_id,
    client_secret: installed.client_secret,
    token_uri: installed.token_uri || "https://oauth2.googleapis.com/token",
  };
} catch {
  console.error(
    `Error: Cannot read client credentials at ${CLIENT_CREDS_PATH}`
  );
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

  const data = (await res.json()) as any;
  tokens.access_token = data.access_token;
  tokens.expires_in = data.expires_in;
  tokens.obtained_at = Date.now();

  try {
    writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
  } catch {
    // Non-fatal
  }
}

async function gmailFetch(path: string, init?: RequestInit): Promise<any> {
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

  if (res.status === 401) {
    await refreshAccessToken();
    res = await doFetch();
  }

  if (res.status === 204) return null;

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail API ${res.status}: ${text}`);
  }

  return res.json();
}

function parseLimit(): number {
  const n = parseInt(params.limit || "10", 10);
  if (isNaN(n) || n < 1) return 10;
  return Math.min(n, 100);
}

function getBody(): string {
  if (params["body-file"]) {
    return readFileSync(params["body-file"], "utf-8");
  }
  return params.body || "";
}

function encodeMessage(headers: Record<string, string>, body: string): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(headers)) {
    lines.push(`${key}: ${value}`);
  }
  lines.push("Content-Type: text/plain; charset=utf-8");
  lines.push("");
  lines.push(body);

  const raw = lines.join("\r\n");
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeBase64Url(str: string): string {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

function extractPlainText(payload: any): string {
  if (!payload) return "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    for (const part of payload.parts) {
      const result = extractPlainText(part);
      if (result) return result;
    }
  }

  if (payload.mimeType === "text/html" && payload.body?.data) {
    const html = decodeBase64Url(payload.body.data);
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  return "";
}

function getHeader(headers: any[], name: string): string {
  const h = headers?.find(
    (h: any) => h.name.toLowerCase() === name.toLowerCase()
  );
  return h?.value || "";
}

// --- Actions ---

async function listMessages(): Promise<void> {
  const limit = parseLimit();
  const label = params.label || "INBOX";
  const qp = new URLSearchParams({
    maxResults: String(limit),
    labelIds: label,
  });

  const data = await gmailFetch(`/messages?${qp}`);

  if (!data.messages?.length) {
    console.log("No messages found.");
    return;
  }

  console.log(`Messages in ${label} (showing ${data.messages.length}):\n`);

  for (const msg of data.messages) {
    const detail = await gmailFetch(
      `/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
    );
    const from = getHeader(detail.payload?.headers, "From");
    const subject = getHeader(detail.payload?.headers, "Subject");
    const date = getHeader(detail.payload?.headers, "Date");
    const snippet = detail.snippet || "";
    const unread = detail.labelIds?.includes("UNREAD") ? " [UNREAD]" : "";

    console.log(`  ${subject || "(no subject)"}${unread}`);
    console.log(`    From: ${from}`);
    console.log(`    Date: ${date}`);
    console.log(`    ID: ${msg.id} | Thread: ${msg.threadId}`);
    if (snippet) console.log(`    Preview: ${snippet.slice(0, 120)}`);
    console.log();
  }
}

async function readMessage(): Promise<void> {
  const id = params.id;
  if (!id) {
    console.error("Error: --id is required for read-message");
    process.exit(1);
  }

  const data = await gmailFetch(`/messages/${id}?format=full`);
  const headers = data.payload?.headers || [];

  const from = getHeader(headers, "From");
  const to = getHeader(headers, "To");
  const cc = getHeader(headers, "Cc");
  const subject = getHeader(headers, "Subject");
  const date = getHeader(headers, "Date");
  const messageId = getHeader(headers, "Message-ID");

  console.log(`Subject: ${subject}`);
  console.log(`From: ${from}`);
  console.log(`To: ${to}`);
  if (cc) console.log(`Cc: ${cc}`);
  console.log(`Date: ${date}`);
  console.log(`ID: ${data.id} | Thread: ${data.threadId}`);
  if (messageId) console.log(`Message-ID: ${messageId}`);
  console.log(`Labels: ${(data.labelIds || []).join(", ")}`);
  console.log("\n---\n");

  const body = extractPlainText(data.payload);
  if (body) {
    console.log(body);
  } else {
    console.log("(no readable body)");
  }
}

async function searchMessages(): Promise<void> {
  const query = params.query;
  if (!query) {
    console.error("Error: --query is required for search");
    process.exit(1);
  }

  const limit = parseLimit();
  const qp = new URLSearchParams({
    maxResults: String(limit),
    q: query,
  });

  const data = await gmailFetch(`/messages?${qp}`);

  if (!data.messages?.length) {
    console.log(`No messages matching: ${query}`);
    return;
  }

  console.log(
    `Search results for "${query}" (${data.messages.length}):\n`
  );

  for (const msg of data.messages) {
    const detail = await gmailFetch(
      `/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
    );
    const from = getHeader(detail.payload?.headers, "From");
    const subject = getHeader(detail.payload?.headers, "Subject");
    const date = getHeader(detail.payload?.headers, "Date");
    const snippet = detail.snippet || "";
    const unread = detail.labelIds?.includes("UNREAD") ? " [UNREAD]" : "";

    console.log(`  ${subject || "(no subject)"}${unread}`);
    console.log(`    From: ${from}`);
    console.log(`    Date: ${date}`);
    console.log(`    ID: ${msg.id} | Thread: ${msg.threadId}`);
    if (snippet) console.log(`    Preview: ${snippet.slice(0, 120)}`);
    console.log();
  }
}

async function createDraft(): Promise<void> {
  const to = params.to;
  const subject = params.subject;
  const body = getBody();

  if (!to) {
    console.error("Error: --to is required for create-draft");
    process.exit(1);
  }
  if (!subject) {
    console.error("Error: --subject is required for create-draft");
    process.exit(1);
  }
  if (!body) {
    console.error("Error: --body or --body-file is required for create-draft");
    process.exit(1);
  }

  const headers: Record<string, string> = {
    To: to,
    Subject: subject,
  };
  if (params.cc) headers["Cc"] = params.cc;
  if (params.bcc) headers["Bcc"] = params.bcc;

  const raw = encodeMessage(headers, body);

  const data = await gmailFetch("/drafts", {
    method: "POST",
    body: JSON.stringify({ message: { raw } }),
  });

  console.log(`Draft created successfully.`);
  console.log(`  To: ${to}`);
  console.log(`  Subject: ${subject}`);
  console.log(`  Draft ID: ${data.id}`);
  console.log(`  Message ID: ${data.message?.id}`);
}

async function listDrafts(): Promise<void> {
  const limit = parseLimit();
  const qp = new URLSearchParams({ maxResults: String(limit) });

  const data = await gmailFetch(`/drafts?${qp}`);

  if (!data.drafts?.length) {
    console.log("No drafts found.");
    return;
  }

  console.log(`Drafts (${data.drafts.length}):\n`);

  for (const draft of data.drafts) {
    const detail = await gmailFetch(
      `/messages/${draft.message.id}?format=metadata&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`
    );
    const to = getHeader(detail.payload?.headers, "To");
    const subject = getHeader(detail.payload?.headers, "Subject");
    const snippet = detail.snippet || "";

    console.log(`  ${subject || "(no subject)"}`);
    console.log(`    To: ${to}`);
    console.log(`    Draft ID: ${draft.id} | Message ID: ${draft.message.id}`);
    if (snippet) console.log(`    Preview: ${snippet.slice(0, 120)}`);
    console.log();
  }
}

// --- Main ---

async function run(): Promise<void> {
  try {
    switch (action) {
      case "list-messages":
        await listMessages();
        break;
      case "read-message":
        await readMessage();
        break;
      case "search":
        await searchMessages();
        break;
      case "create-draft":
        await createDraft();
        break;
      case "list-drafts":
        await listDrafts();
        break;
      default:
        console.error(`Error: Unknown action '${action}'`);
        console.error(
          "Available: list-messages, read-message, search, create-draft, list-drafts"
        );
        process.exit(1);
    }
  } catch (error: any) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

run();
