#!/usr/bin/env bun

import { createHash, randomBytes } from "crypto";
import fs from "fs";
import path from "path";

// Parse command line arguments
const args = process.argv.slice(2);
const params: Record<string, string> = {};

for (const arg of args) {
  const match = arg.match(/^--(\w[\w-]*)(?:=(.*))?$/);
  if (match) {
    params[match[1]] = match[2] ?? "true";
  }
}

const action = params.action;

// --- Paths ---
const DATA_DIR = path.resolve(process.cwd(), "data");
const AUTH_FILE = path.join(DATA_DIR, "granola-auth.json");
const REDIRECT_URI = "http://localhost:8976/callback";

// --- OAuth endpoints ---
const MCP_URL = "https://mcp.granola.ai/mcp";
const AUTH_SERVER = "https://mcp-auth.granola.ai";
const AUTHORIZE_URL = `${AUTH_SERVER}/oauth2/authorize`;
const TOKEN_URL = `${AUTH_SERVER}/oauth2/token`;
const REGISTER_URL = `${AUTH_SERVER}/oauth2/register`;

// --- Auth storage ---
interface AuthData {
  client_id: string;
  client_secret?: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

function loadAuth(): AuthData | null {
  if (!fs.existsSync(AUTH_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
  } catch {
    return null;
  }
}

function saveAuth(data: AuthData): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2));
}

// --- PKCE helpers ---
function generateCodeVerifier(): string {
  return randomBytes(32)
    .toString("base64url")
    .replace(/[^a-zA-Z0-9-._~]/g, "")
    .slice(0, 128);
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

// --- Token refresh ---
async function refreshAccessToken(auth: AuthData): Promise<AuthData> {
  if (!auth.refresh_token) {
    console.error("Error: No refresh token. Run --action=auth to re-authenticate.");
    process.exit(1);
  }

  const body: Record<string, string> = {
    grant_type: "refresh_token",
    refresh_token: auth.refresh_token,
    client_id: auth.client_id,
  };
  if (auth.client_secret) body.client_secret = auth.client_secret;

  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error(`Error refreshing token (${resp.status}): ${text}`);
    console.error("Run --action=auth to re-authenticate.");
    process.exit(1);
  }

  const data = await resp.json();
  const updated: AuthData = {
    ...auth,
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? auth.refresh_token,
    expires_at: data.expires_in
      ? Date.now() + data.expires_in * 1000 - 60_000
      : undefined,
  };
  saveAuth(updated);
  return updated;
}

// --- Get valid access token ---
async function getAccessToken(): Promise<string> {
  let auth = loadAuth();
  if (!auth) {
    console.error("Error: Not authenticated. Run --action=auth first.");
    process.exit(1);
  }

  // Refresh if expired (with 60s buffer)
  if (auth.expires_at && Date.now() > auth.expires_at) {
    auth = await refreshAccessToken(auth);
  }

  return auth.access_token;
}

// --- MCP JSON-RPC ---
let sessionId: string | null = null;

async function mcpRequest(method: string, mcpParams?: any): Promise<any> {
  const token = await getAccessToken();

  const body = {
    jsonrpc: "2.0",
    method,
    id: Date.now(),
    params: mcpParams ?? {},
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    Authorization: `Bearer ${token}`,
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const resp = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    if (resp.status === 401) {
      // Try refreshing token once
      const auth = loadAuth();
      if (auth?.refresh_token) {
        const refreshed = await refreshAccessToken(auth);
        headers.Authorization = `Bearer ${refreshed.access_token}`;
        const retry = await fetch(MCP_URL, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        if (!retry.ok) {
          console.error(`Error: MCP returned ${retry.status} after token refresh.`);
          console.error("Run --action=auth to re-authenticate.");
          process.exit(1);
        }
        const sid = retry.headers.get("mcp-session-id");
        if (sid) sessionId = sid;
        return retry.json();
      }
      console.error("Error: Unauthorized. Run --action=auth to re-authenticate.");
      process.exit(1);
    }
    const text = await resp.text();
    console.error(`Error: MCP returned ${resp.status}: ${text}`);
    process.exit(1);
  }

  const sid = resp.headers.get("mcp-session-id");
  if (sid) sessionId = sid;

  // Handle SSE vs JSON response
  const contentType = resp.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    // Parse SSE - collect all data events
    const text = await resp.text();
    const lines = text.split("\n");
    let lastData = "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        lastData = line.slice(6);
      }
    }
    if (lastData) return JSON.parse(lastData);
    console.error("Error: Empty SSE response");
    process.exit(1);
  }

  return resp.json();
}

async function mcpInit(): Promise<void> {
  const result = await mcpRequest("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "seshat-granola", version: "1.0.0" },
  });

  if (result.error) {
    console.error("Error initializing MCP session:", result.error.message);
    process.exit(1);
  }

  // Send initialized notification
  await mcpRequest("notifications/initialized");
}

async function mcpCallTool(toolName: string, toolArgs: any): Promise<any> {
  await mcpInit();
  const result = await mcpRequest("tools/call", {
    name: toolName,
    arguments: toolArgs,
  });

  if (result.error) {
    console.error(`Error calling ${toolName}:`, result.error.message);
    process.exit(1);
  }

  return result.result;
}

// --- Pending auth state (saved between auth and auth-callback) ---
const PENDING_AUTH_FILE = path.join(DATA_DIR, "granola-auth-pending.json");

interface PendingAuth {
  client_id: string;
  client_secret?: string;
  code_verifier: string;
  state: string;
}

// --- OAuth auth flow (step 1: generate URL) ---
async function doAuth(): Promise<void> {
  // Step 1: Dynamic client registration
  console.log("[Granola] Registering OAuth client...");
  const regResp = await fetch(REGISTER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Seshat Granola Skill",
      redirect_uris: [REDIRECT_URI],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });

  if (!regResp.ok) {
    const text = await regResp.text();
    console.error(`Error registering client (${regResp.status}): ${text}`);
    process.exit(1);
  }

  const client = await regResp.json();
  const clientId = client.client_id;
  const clientSecret = client.client_secret;
  console.log(`[Granola] Client registered: ${clientId}`);

  // Step 2: Generate PKCE
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = randomBytes(16).toString("hex");

  // Save pending state for the callback step
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const pending: PendingAuth = { client_id: clientId, client_secret: clientSecret, code_verifier: codeVerifier, state };
  fs.writeFileSync(PENDING_AUTH_FILE, JSON.stringify(pending, null, 2));

  // Step 3: Build auth URL
  const authParams = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    scope: "openid profile email offline_access",
  });

  const authUrl = `${AUTHORIZE_URL}?${authParams}`;

  console.log("\n[Granola] Open this URL in your browser to authorize:\n");
  console.log(authUrl);
  console.log("\nAfter authorizing, you'll be redirected to a localhost URL that won't load.");
  console.log("Copy that URL and run:\n");
  console.log(`  bun /home/node/.claude/skills/granola/script.ts --action=auth-callback --url='PASTE_URL_HERE'`);
  console.log("\nOr just pass the code directly:\n");
  console.log(`  bun /home/node/.claude/skills/granola/script.ts --action=auth-callback --code=THE_CODE`);
}

// --- OAuth auth flow (step 2: exchange code for tokens) ---
async function doAuthCallback(): Promise<void> {
  // Load pending auth state
  if (!fs.existsSync(PENDING_AUTH_FILE)) {
    console.error("Error: No pending auth. Run --action=auth first.");
    process.exit(1);
  }

  const pending: PendingAuth = JSON.parse(fs.readFileSync(PENDING_AUTH_FILE, "utf-8"));

  // Extract code from --url or --code
  let code: string;
  if (params.url) {
    const url = new URL(params.url.startsWith("http") ? params.url : `http://dummy?${params.url}`);
    const returnedState = url.searchParams.get("state");
    if (returnedState && returnedState !== pending.state) {
      console.error("Error: State mismatch. Run --action=auth again to get a fresh URL.");
      process.exit(1);
    }
    code = url.searchParams.get("code") ?? "";
  } else if (params.code) {
    code = params.code;
  } else {
    console.error("Error: --url or --code is required");
    process.exit(1);
  }

  if (!code) {
    console.error("Error: No authorization code found.");
    process.exit(1);
  }

  console.log("[Granola] Exchanging authorization code for tokens...");

  const tokenBody: Record<string, string> = {
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: pending.client_id,
    code_verifier: pending.code_verifier,
  };
  if (pending.client_secret) tokenBody.client_secret = pending.client_secret;

  const tokenResp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(tokenBody),
  });

  if (!tokenResp.ok) {
    const text = await tokenResp.text();
    console.error(`Error exchanging code (${tokenResp.status}): ${text}`);
    process.exit(1);
  }

  const tokens = await tokenResp.json();

  const authData: AuthData = {
    client_id: pending.client_id,
    client_secret: pending.client_secret,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expires_in
      ? Date.now() + tokens.expires_in * 1000 - 60_000
      : undefined,
  };
  saveAuth(authData);

  // Clean up pending file
  fs.unlinkSync(PENDING_AUTH_FILE);

  console.log("[Granola] Authenticated successfully! Tokens saved.");
}

// --- Help ---
if (!action) {
  console.error("Error: --action is required");
  console.error("\nAvailable actions:");
  console.error("  --action=auth                                    Start OAuth flow (prints URL)");
  console.error("  --action=auth-callback --url='...' | --code=...  Complete OAuth with callback URL/code");
  console.error("  --action=list-meetings [--query=...]              List meetings");
  console.error("  --action=get-meeting --id=MEETING_ID              Get meeting details");
  console.error("  --action=get-transcript --id=MEETING_ID           Get meeting transcript");
  console.error("  --action=search --query='...'                     Search across meeting notes");
  console.error("  --action=list-tools                               Show available MCP tools");
  process.exit(1);
}

// --- Main ---
async function run() {
  try {
    switch (action) {
      case "auth": {
        await doAuth();
        break;
      }

      case "auth-callback": {
        await doAuthCallback();
        break;
      }

      case "list-tools": {
        await mcpInit();
        const result = await mcpRequest("tools/list");
        if (result.error) {
          console.error("Error:", result.error.message);
          process.exit(1);
        }
        console.log("[Granola] Available MCP tools:\n");
        for (const tool of result.result?.tools ?? []) {
          console.log(`  ${tool.name}`);
          if (tool.description) {
            console.log(`    ${tool.description}`);
          }
          console.log();
        }
        break;
      }

      case "list-meetings": {
        const toolArgs: Record<string, any> = {};
        if (params.query) toolArgs.query = params.query;

        const result = await mcpCallTool("list_meetings", toolArgs);

        if (result?.content) {
          for (const item of result.content) {
            if (item.type === "text") {
              console.log(item.text);
            }
          }
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
        break;
      }

      case "get-meeting": {
        if (!params.id) {
          console.error("Error: --id is required");
          process.exit(1);
        }

        const result = await mcpCallTool("get_meetings", {
          meeting_ids: [params.id],
        });

        if (result?.content) {
          for (const item of result.content) {
            if (item.type === "text") {
              console.log(item.text);
            }
          }
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
        break;
      }

      case "get-transcript": {
        if (!params.id) {
          console.error("Error: --id is required");
          process.exit(1);
        }

        const result = await mcpCallTool("get_meeting_transcript", {
          meeting_id: params.id,
        });

        if (result?.content) {
          for (const item of result.content) {
            if (item.type === "text") {
              console.log(item.text);
            }
          }
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
        break;
      }

      case "search": {
        if (!params.query) {
          console.error("Error: --query is required");
          process.exit(1);
        }

        const result = await mcpCallTool("query_granola_meetings", {
          query: params.query,
        });

        if (result?.content) {
          for (const item of result.content) {
            if (item.type === "text") {
              console.log(item.text);
            }
          }
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
        break;
      }

      default:
        console.error(`Error: Unknown action '${action}'`);
        console.error("\nAvailable: auth, auth-callback, list-tools, list-meetings, get-meeting, get-transcript, search");
        process.exit(1);
    }
  } catch (error: any) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

run();
