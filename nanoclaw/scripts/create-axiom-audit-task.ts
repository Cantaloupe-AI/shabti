#!/usr/bin/env npx tsx
/**
 * One-time script to create a nightly Axiom log audit scheduled task.
 * Runs at 5:00 AM daily, scans for 4xx/5xx errors, and sends a categorized report.
 *
 * Usage: npx tsx scripts/create-axiom-audit-task.ts
 */

import { randomUUID } from 'crypto';
import { CronExpressionParser } from 'cron-parser';
import { createTask, getAllRegisteredGroups, initDatabase } from '../src/db.js';
import { TIMEZONE } from '../src/config.js';

const TASK_PROMPT = `You are running a nightly log audit. Query Axiom for all HTTP errors from the last 24 hours and produce a categorized report.

## Step 1: Gather error data

Run these commands to collect error data:

\`\`\`bash
# Get raw error details (4xx and 5xx)
bun /home/node/.claude/skills/axiom/script.ts --action=errors --range=24h --raw

# Get error counts broken down by status code and endpoint
bun /home/node/.claude/skills/axiom/script.ts --action=query --apl="['vercel-logs'] | where ['response.status'] >= 400 | summarize count() by ['response.status'], ['request.path'] | sort by count_ desc" --range=24h --raw

# Get total counts by status code category
bun /home/node/.claude/skills/axiom/script.ts --action=query --apl="['vercel-logs'] | where ['response.status'] >= 400 | extend category = iff(['response.status'] >= 500, '5xx', '4xx') | summarize count() by category, ['response.status']" --range=24h --raw
\`\`\`

## Step 2: Categorize each error

For each error, classify it as either an **Anomaly** or **Routine**:

**Anomaly (worth investigating):**
- 500 errors on critical API paths (auth, payments, data mutations)
- Unusual spikes — significantly more errors on an endpoint than typical
- New error patterns not seen in previous audits
- 5xx errors that suggest server-side bugs (not upstream timeouts)
- 4xx errors indicating broken client integrations (not bots/crawlers)

**Routine (expected noise):**
- 404s from bots/crawlers hitting non-existent paths (wp-admin, .env, etc.)
- 429 rate limiting responses (working as intended)
- 401/403 from unauthenticated bot probes
- Client disconnections / network timeouts on non-critical paths
- Known flaky upstream dependencies

## Step 3: Send the report

Send a single message with this format:

📊 **Nightly Log Audit** (last 24h)

**Totals:** X errors (Y × 4xx, Z × 5xx)

**Status Code Breakdown:**
- 404: N hits
- 500: N hits
- (etc.)

🔴 **Anomalies (N)**
For each anomaly, include:
- Status code, endpoint path, timestamp
- Brief description of why it's unusual
- Error details if available

🟢 **Routine (N)**
Summary counts only — e.g. "42× bot 404s, 15× rate limits"

If there are zero anomalies, say "No anomalies detected — all errors match routine patterns." and still include the routine summary.
If there are zero errors total, send: "✅ Clean bill of health — no 4xx or 5xx errors in the last 24 hours."`;

// --- Main ---

initDatabase();

const groups = getAllRegisteredGroups();
const mainEntry = Object.entries(groups).find(([, g]) => g.folder === 'main');

if (!mainEntry) {
  console.error('Error: No registered group with folder "main" found.');
  console.error('Available groups:', Object.entries(groups).map(([jid, g]) => `${g.folder} (${jid})`));
  process.exit(1);
}

const [chatJid] = mainEntry;

const cronExpr = '0 5 * * *';
const interval = CronExpressionParser.parse(cronExpr, { tz: TIMEZONE });
const nextRun = interval.next().toISOString();

const task = {
  id: randomUUID(),
  group_folder: 'main',
  chat_jid: chatJid,
  prompt: TASK_PROMPT,
  schedule_type: 'cron' as const,
  schedule_value: cronExpr,
  context_mode: 'isolated' as const,
  next_run: nextRun,
  status: 'active' as const,
  created_at: new Date().toISOString(),
};

createTask(task);

console.log('Axiom audit task created successfully.');
console.log(`  Task ID:  ${task.id}`);
console.log(`  Schedule: ${cronExpr} (daily at 5:00 AM ${TIMEZONE})`);
console.log(`  Next run: ${nextRun}`);
console.log(`  Group:    main (${chatJid})`);
