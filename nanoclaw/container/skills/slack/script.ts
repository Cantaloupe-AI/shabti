#!/usr/bin/env bun

/**
 * Slack Skill
 *
 * Search, read, and post Slack messages.
 *
 * Requires SLACK_BOT_USER_OAUTH_TOKEN (xoxb-) in .env
 */

// Parse command line arguments
const args = process.argv.slice(2);
const params: Record<string, string> = {};

for (const arg of args) {
  const match = arg.match(/^--(\w+)(?:=(.*))?$/);
  if (match) {
    params[match[1]] = match[2] ?? "true";
  }
}

const action = params.action;

if (!action) {
  console.error("Error: --action is required");
  console.error("\nAvailable actions:");
  console.error("  --action=list-channels [--limit=N]");
  console.error("  --action=read-channel --channel=<id-or-name> [--limit=N]");
  console.error("  --action=read-thread --channel=<id> --thread=<ts>");
  console.error("  --action=search --query=\"search terms\" [--limit=N]");
  console.error("  --action=get-user --id=<user-id>");
  console.error("  --action=post --channel=<id-or-name> --text=\"message\"");
  process.exit(1);
}

const SLACK_TOKEN = process.env.SLACK_BOT_USER_OAUTH_TOKEN;

if (!SLACK_TOKEN) {
  console.error("Error: SLACK_BOT_USER_OAUTH_TOKEN not set in environment");
  process.exit(1);
}

if (!SLACK_TOKEN.startsWith("xoxb-")) {
  console.error("Error: SLACK_BOT_USER_OAUTH_TOKEN should be a bot token (xoxb-)");
  process.exit(1);
}

const BASE_URL = "https://slack.com/api";

// User display name cache (avoids repeated API calls within a single run)
const userCache = new Map<string, string>();

function parseLimit(raw: string | undefined, fallback: number = 20): number {
  const n = parseInt(raw || String(fallback), 10);
  if (isNaN(n) || n < 1) return fallback;
  return Math.min(n, 1000);
}

async function slackGet(method: string, queryParams: Record<string, string> = {}, token?: string): Promise<any> {
  const url = new URL(`${BASE_URL}/${method}`);
  for (const [k, v] of Object.entries(queryParams)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token || SLACK_TOKEN}` },
  });

  if (!res.ok) {
    throw new Error(`Slack API HTTP ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  if (!data.ok) {
    if (data.error === "not_in_channel") {
      throw new Error("Bot is not in this channel. A workspace admin needs to invite the bot to the channel first.");
    }
    if (data.error === "not_allowed_token_type") {
      throw new Error("This action requires a Slack user token (xoxp-). The bot token (xoxb-) does not support search. Add SLACK_USER_OAUTH_TOKEN to .env to enable search.");
    }
    if (data.error === "channel_not_found") {
      throw new Error("Channel not found. Check the channel ID or name.");
    }
    throw new Error(`Slack API error: ${data.error}`);
  }

  return data;
}

async function slackPost(method: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${BASE_URL}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Slack API HTTP ${res.status}: ${res.statusText}`);
  }

  const data = await res.json() as any;
  if (!data.ok) {
    if (data.error === "not_in_channel") {
      throw new Error("Bot is not in this channel. A workspace admin needs to invite the bot to the channel first.");
    }
    if (data.error === "channel_not_found") {
      throw new Error("Channel not found. Check the channel ID or name.");
    }
    throw new Error(`Slack API error: ${data.error}`);
  }

  return data;
}

async function resolveUser(userId: string): Promise<string> {
  if (userCache.has(userId)) return userCache.get(userId)!;

  try {
    const data = await slackGet("users.info", { user: userId });
    const name =
      data.user?.profile?.display_name ||
      data.user?.profile?.real_name ||
      data.user?.name ||
      userId;
    userCache.set(userId, name);
    return name;
  } catch {
    userCache.set(userId, userId);
    return userId;
  }
}

function formatTs(ts: string): string {
  const parsed = parseFloat(ts);
  if (isNaN(parsed)) return "(unknown time)";
  const date = new Date(parsed * 1000);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

async function formatMessage(msg: any): Promise<string> {
  const user = msg.user ? await resolveUser(msg.user) : msg.username || "bot";
  const time = msg.ts ? formatTs(msg.ts) : "(unknown time)";
  const text = msg.text || "(no text)";
  const thread = msg.reply_count ? ` [${msg.reply_count} replies]` : "";
  return `[${time}] ${user}: ${text}${thread}`;
}

// Slack channel IDs: uppercase letter prefix + 8-11 uppercase alphanumeric chars
function looksLikeChannelId(input: string): boolean {
  return /^[CDGW][A-Z0-9]{8,}$/.test(input);
}

const MAX_PAGINATION_PAGES = 50;

async function resolveChannelId(channelInput: string): Promise<string> {
  if (looksLikeChannelId(channelInput)) {
    return channelInput;
  }

  const name = channelInput.replace(/^#/, "");
  let cursor: string | undefined;
  let pages = 0;

  do {
    if (pages >= MAX_PAGINATION_PAGES) {
      throw new Error(`Channel not found after scanning ${pages * 200} channels: ${channelInput}`);
    }

    const reqParams: Record<string, string> = { limit: "200", types: "public_channel,private_channel" };
    if (cursor) reqParams.cursor = cursor;

    const data = await slackGet("conversations.list", reqParams);
    const match = data.channels?.find((c: any) => c.name === name);
    if (match) return match.id;

    cursor = data.response_metadata?.next_cursor || undefined;
    pages++;
  } while (cursor);

  throw new Error(`Channel not found: ${channelInput}`);
}

async function listChannels(): Promise<void> {
  const limit = parseLimit(params.limit);
  const data = await slackGet("conversations.list", {
    limit: String(limit),
    types: "public_channel",
    exclude_archived: "true",
  });

  if (!data.channels?.length) {
    console.log("No channels found.");
    return;
  }

  console.log(`Channels (${data.channels.length}):\n`);
  for (const ch of data.channels) {
    const members = ch.num_members ?? "?";
    const purpose = ch.purpose?.value ? ` - ${ch.purpose.value}` : "";
    console.log(`  #${ch.name}  (${ch.id}, ${members} members)${purpose}`);
  }
}

async function readChannel(): Promise<void> {
  const channel = params.channel;
  if (!channel) {
    console.error("Error: --channel is required for read-channel");
    process.exit(1);
  }

  const channelId = await resolveChannelId(channel);
  const limit = parseLimit(params.limit);

  const data = await slackGet("conversations.history", {
    channel: channelId,
    limit: String(limit),
  });

  if (!data.messages?.length) {
    console.log("No messages found.");
    return;
  }

  // Messages come newest-first; reverse for chronological display
  const messages = data.messages.reverse();
  const lines = await Promise.all(messages.map(formatMessage));
  console.log(lines.join("\n"));
}

async function readThread(): Promise<void> {
  const channel = params.channel;
  const thread = params.thread;

  if (!channel) {
    console.error("Error: --channel is required for read-thread");
    process.exit(1);
  }
  if (!thread) {
    console.error("Error: --thread is required for read-thread (the thread_ts value)");
    process.exit(1);
  }

  const channelId = await resolveChannelId(channel);

  const data = await slackGet("conversations.replies", {
    channel: channelId,
    ts: thread,
  });

  if (!data.messages?.length) {
    console.log("No replies found.");
    return;
  }

  const lines = await Promise.all(data.messages.map(formatMessage));
  console.log(lines.join("\n"));
}

async function searchMessages(): Promise<void> {
  const query = params.query;
  if (!query) {
    console.error("Error: --query is required for search");
    process.exit(1);
  }

  const userToken = process.env.SLACK_USER_OAUTH_TOKEN;
  if (!userToken) {
    console.error("Error: Search requires a Slack user token (xoxp-).");
    console.error("Add SLACK_USER_OAUTH_TOKEN to .env to enable search.");
    console.error("\nAlternative: use --action=read-channel to read messages from a specific channel.");
    process.exit(1);
  }

  if (!userToken.startsWith("xoxp-")) {
    console.error("Error: SLACK_USER_OAUTH_TOKEN should be a user token (xoxp-)");
    process.exit(1);
  }

  const limit = parseLimit(params.limit);

  const data = await slackGet("search.messages", {
    query,
    count: String(limit),
    sort: "timestamp",
    sort_dir: "desc",
  }, userToken);

  const matches = data.messages?.matches;
  if (!matches?.length) {
    console.log("No results found.");
    return;
  }

  console.log(`Search results for "${query}" (${data.messages.total} total):\n`);
  for (const m of matches) {
    const user = m.user ? await resolveUser(m.user) : m.username || "bot";
    const time = m.ts ? formatTs(m.ts) : "(unknown time)";
    const channel = m.channel?.name ? `#${m.channel.name}` : "";
    const text = m.text || "(no text)";
    console.log(`[${time}] ${channel} ${user}: ${text}`);
  }
}

async function postMessage(): Promise<void> {
  const channel = params.channel;
  const text = params.text;

  if (!channel) {
    console.error("Error: --channel is required for post");
    process.exit(1);
  }
  if (!text) {
    console.error("Error: --text is required for post");
    process.exit(1);
  }

  const channelId = await resolveChannelId(channel);

  const data = await slackPost("chat.postMessage", {
    channel: channelId,
    text,
  });

  const ts = data.ts;
  console.log(`Message posted to #${channel} (ts: ${ts})`);
}

async function getUser(): Promise<void> {
  const id = params.id;
  if (!id) {
    console.error("Error: --id is required for get-user");
    process.exit(1);
  }

  const data = await slackGet("users.info", { user: id });
  const u = data.user;
  if (!u) {
    console.error("Error: User not found in API response");
    process.exit(1);
  }
  const p = u.profile || {};

  console.log(`User: ${p.display_name || p.real_name || u.name}`);
  console.log(`  ID: ${u.id}`);
  console.log(`  Real name: ${p.real_name || "N/A"}`);
  console.log(`  Display name: ${p.display_name || "N/A"}`);
  console.log(`  Title: ${p.title || "N/A"}`);
  console.log(`  Email: ${p.email || "N/A"}`);
  console.log(`  Status: ${p.status_emoji || ""} ${p.status_text || ""}`.trim() || "  Status: N/A");
  console.log(`  Timezone: ${u.tz_label || u.tz || "N/A"}`);
}

async function run(): Promise<void> {
  try {
    switch (action) {
      case "list-channels":
        await listChannels();
        break;
      case "read-channel":
        await readChannel();
        break;
      case "read-thread":
        await readThread();
        break;
      case "search":
        await searchMessages();
        break;
      case "get-user":
        await getUser();
        break;
      case "post":
        await postMessage();
        break;
      default:
        console.error(`Error: Unknown action '${action}'`);
        console.error("Available: list-channels, read-channel, read-thread, search, get-user, post");
        process.exit(1);
    }
  } catch (error: any) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

run();
