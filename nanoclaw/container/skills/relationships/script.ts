#!/usr/bin/env bun

/**
 * Relationships Skill — Personal relationship tracker
 *
 * Reads from the shared SQLite database (mounted read-only).
 * Writes via IPC JSON files for the host to process.
 */

import { Database } from 'bun:sqlite';
import { parseArgs } from 'util';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const DB_PATH = '/workspace/project/store/messages.db';
const IPC_DIR = '/workspace/ipc/relationships';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    action: { type: 'string' },
    contact: { type: 'string' },
    name: { type: 'string' },
    tier: { type: 'string' },
    notes: { type: 'string' },
    phone: { type: 'string' },
    email: { type: 'string' },
    whatsapp: { type: 'string' },
    telegram: { type: 'string' },
    type: { type: 'string' },
    source: { type: 'string' },
    target: { type: 'string' },
  },
  strict: false,
});

const action = values.action;

if (!action) {
  console.error('Error: --action is required');
  console.error('Actions: list, get, add, update, log, fading, unresolved, compute-scores, merge');
  process.exit(1);
}

// Open DB read-only for queries
let db: Database;
try {
  db = new Database(DB_PATH, { readonly: true });
} catch (e: any) {
  console.error(`Cannot open database at ${DB_PATH}: ${e.message}`);
  process.exit(1);
}

// --- Scoring constants ---
const TIER_CONFIG: Record<string, { halfLife: number; threshold: number }> = {
  inner_circle: { halfLife: 14, threshold: 15 },
  close_friend: { halfLife: 30, threshold: 10 },
  good_friend: { halfLife: 60, threshold: 5 },
  acquaintance: { halfLife: 120, threshold: 2 },
};

const INTERACTION_WEIGHTS: Record<string, number> = {
  '1on1_meeting': 10,
  call: 8,
  video_call: 8,
  manual_checkin: 6,
  text_1on1: 5,
  group_meeting: 3,
  group_chat: 1,
};

// --- Helpers ---

function writeIpc(data: Record<string, unknown>): void {
  mkdirSync(IPC_DIR, { recursive: true });
  const filename = `rel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.json`;
  writeFileSync(join(IPC_DIR, filename), JSON.stringify(data, null, 2));
}

function resolveContact(contactRef: string): any {
  // Try by ID first
  const byId = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contactRef);
  if (byId) return byId;
  // Try by name (case-insensitive)
  const byName = db.prepare('SELECT * FROM contacts WHERE name = ? COLLATE NOCASE').get(contactRef);
  if (byName) return byName;
  // Try partial name match
  const byPartial = db.prepare('SELECT * FROM contacts WHERE name LIKE ? COLLATE NOCASE').get(`%${contactRef}%`);
  return byPartial;
}

function computeScore(contactId: number, tier: string): {
  score: number;
  threshold: number;
  status: string;
  interactions30d: number;
  lastInteraction: string | null;
  reciprocity: number | null;
} {
  const config = TIER_CONFIG[tier] || TIER_CONFIG.acquaintance;
  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const interactions = db.prepare(
    'SELECT * FROM interactions WHERE contact_id = ? AND timestamp > ? ORDER BY timestamp DESC'
  ).all(contactId, oneYearAgo) as any[];

  let score = 0;
  let inbound = 0;
  let outbound = 0;

  for (const i of interactions) {
    const daysSince = (now.getTime() - new Date(i.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince >= 0) {
      score += i.value * Math.pow(2, -daysSince / config.halfLife);
    }
    if (i.direction === 'inbound') inbound++;
    else if (i.direction === 'outbound') outbound++;
  }

  score = Math.round(score * 100) / 100;
  const interactions30d = interactions.filter(i => i.timestamp > thirtyDaysAgo).length;
  const lastInteraction = interactions.length > 0 ? interactions[0].timestamp : null;

  let reciprocity: number | null = null;
  if (inbound > 0 || outbound > 0) {
    reciprocity = Math.round((Math.min(inbound, outbound) / Math.max(inbound, outbound)) * 100) / 100;
  }

  let status = 'healthy';
  if (score < config.threshold * 0.5 && score > 0) status = 'urgent';
  else if (score < config.threshold) status = score === 0 ? 'dormant' : 'fading';

  return { score, threshold: config.threshold, status, interactions30d, lastInteraction, reciprocity };
}

function daysSince(timestamp: string | null): string {
  if (!timestamp) return 'never';
  const days = Math.floor((Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

// --- Actions ---

async function listContacts(): Promise<void> {
  const contacts = db.prepare('SELECT * FROM contacts ORDER BY name').all() as any[];

  if (contacts.length === 0) {
    console.log('No contacts yet. Use --action=add to create one.');
    return;
  }

  console.log(`\n${'Name'.padEnd(25)} ${'Tier'.padEnd(15)} ${'Score'.padEnd(8)} ${'Status'.padEnd(10)} ${'Last Contact'.padEnd(15)} 30d`);
  console.log('-'.repeat(85));

  for (const c of contacts) {
    const s = computeScore(c.id, c.tier);
    const lastStr = daysSince(s.lastInteraction);
    console.log(
      `${c.name.padEnd(25)} ${c.tier.padEnd(15)} ${String(s.score).padEnd(8)} ${s.status.padEnd(10)} ${lastStr.padEnd(15)} ${s.interactions30d}`
    );
  }
}

async function getContact(): Promise<void> {
  if (!values.contact) {
    console.error('Error: --contact is required');
    process.exit(1);
  }

  const contact = resolveContact(values.contact);
  if (!contact) {
    console.error(`Contact not found: ${values.contact}`);
    process.exit(1);
  }

  const s = computeScore(contact.id, contact.tier);
  const identifiers = db.prepare('SELECT * FROM contact_identifiers WHERE contact_id = ?').all(contact.id) as any[];

  console.log(`\n=== ${contact.name} ===`);
  console.log(`ID: ${contact.id}`);
  console.log(`Tier: ${contact.tier}${contact.desired_tier ? ` (desired: ${contact.desired_tier})` : ''}`);
  console.log(`Score: ${s.score} / ${s.threshold} (${s.status})`);
  console.log(`Last contact: ${daysSince(s.lastInteraction)}`);
  console.log(`Interactions (30d): ${s.interactions30d}`);
  if (s.reciprocity !== null) console.log(`Reciprocity: ${s.reciprocity}`);
  if (contact.notes) console.log(`Notes: ${contact.notes}`);

  if (identifiers.length > 0) {
    console.log(`\nIdentifiers:`);
    for (const id of identifiers) {
      console.log(`  ${id.channel}: ${id.identifier}${id.display_name ? ` (${id.display_name})` : ''}`);
    }
  }

  // Recent interactions
  const recent = db.prepare(
    'SELECT * FROM interactions WHERE contact_id = ? ORDER BY timestamp DESC LIMIT 10'
  ).all(contact.id) as any[];

  if (recent.length > 0) {
    console.log(`\nRecent interactions:`);
    for (const i of recent) {
      const dir = i.direction ? ` [${i.direction}]` : '';
      const dur = i.duration_seconds ? ` (${Math.round(i.duration_seconds / 60)}m)` : '';
      console.log(`  ${i.timestamp.slice(0, 10)} ${i.interaction_type} via ${i.source}${dir}${dur} (value: ${i.value})`);
    }
  }

  // Score history
  const history = db.prepare(
    'SELECT * FROM relationship_scores WHERE contact_id = ? ORDER BY computed_at DESC LIMIT 7'
  ).all(contact.id) as any[];

  if (history.length > 1) {
    console.log(`\nScore history:`);
    for (const h of history) {
      console.log(`  ${h.computed_at.slice(0, 10)}: ${h.score}`);
    }
  }
}

async function addContact(): Promise<void> {
  if (!values.name) {
    console.error('Error: --name is required');
    process.exit(1);
  }

  const tier = values.tier || 'acquaintance';
  if (!TIER_CONFIG[tier]) {
    console.error(`Invalid tier: ${tier}. Valid: ${Object.keys(TIER_CONFIG).join(', ')}`);
    process.exit(1);
  }

  const identifiers: Array<{ channel: string; identifier: string }> = [];
  if (values.phone) {
    identifiers.push({ channel: 'phone', identifier: values.phone });
    identifiers.push({ channel: 'imessage', identifier: values.phone });
  }
  if (values.email) identifiers.push({ channel: 'email', identifier: values.email });
  if (values.whatsapp) {
    identifiers.push({ channel: 'whatsapp', identifier: values.whatsapp });
    // Cross-link phone from WhatsApp JID
    const match = values.whatsapp.match(/^(\d+)@s\.whatsapp\.net$/);
    if (match) {
      const phone = `+${match[1]}`;
      identifiers.push({ channel: 'phone', identifier: phone });
      identifiers.push({ channel: 'imessage', identifier: phone });
    }
  }
  if (values.telegram) identifiers.push({ channel: 'telegram', identifier: values.telegram });

  writeIpc({
    type: 'relationship_add_contact',
    name: values.name,
    tier,
    notes: values.notes || null,
    identifiers,
  });

  console.log(`Contact "${values.name}" (${tier}) queued for creation.`);
  if (identifiers.length > 0) {
    console.log(`Identifiers: ${identifiers.map(i => `${i.channel}:${i.identifier}`).join(', ')}`);
  }
}

async function updateContact(): Promise<void> {
  if (!values.contact) {
    console.error('Error: --contact is required');
    process.exit(1);
  }

  const contact = resolveContact(values.contact);
  if (!contact) {
    console.error(`Contact not found: ${values.contact}`);
    process.exit(1);
  }

  if (values.tier && !TIER_CONFIG[values.tier]) {
    console.error(`Invalid tier: ${values.tier}`);
    process.exit(1);
  }

  writeIpc({
    type: 'relationship_update_contact',
    contact_id: contact.id,
    tier: values.tier || undefined,
    notes: values.notes || undefined,
  });

  console.log(`Contact "${contact.name}" update queued.`);
}

async function logManualInteraction(): Promise<void> {
  if (!values.contact) {
    console.error('Error: --contact is required');
    process.exit(1);
  }

  const contact = resolveContact(values.contact);
  if (!contact) {
    console.error(`Contact not found: ${values.contact}`);
    process.exit(1);
  }

  const interactionType = values.type || 'manual_checkin';
  const weight = INTERACTION_WEIGHTS[interactionType];
  if (weight === undefined) {
    console.error(`Invalid type: ${interactionType}. Valid: ${Object.keys(INTERACTION_WEIGHTS).join(', ')}`);
    process.exit(1);
  }

  writeIpc({
    type: 'relationship_log_interaction',
    contact_id: contact.id,
    interaction_type: interactionType,
    value: weight,
    notes: values.notes || null,
  });

  console.log(`Logged ${interactionType} with "${contact.name}" (value: ${weight}).`);
}

async function showFading(): Promise<void> {
  const contacts = db.prepare('SELECT * FROM contacts ORDER BY name').all() as any[];

  const fading: Array<{
    name: string;
    tier: string;
    score: number;
    threshold: number;
    status: string;
    lastInteraction: string | null;
  }> = [];

  for (const c of contacts) {
    const s = computeScore(c.id, c.tier);
    if (s.status === 'fading' || s.status === 'urgent' || s.status === 'dormant') {
      fading.push({
        name: c.name,
        tier: c.tier,
        score: s.score,
        threshold: s.threshold,
        status: s.status,
        lastInteraction: s.lastInteraction,
      });
    }
  }

  // Sort: urgent first, then fading, then dormant
  const statusOrder: Record<string, number> = { urgent: 0, fading: 1, dormant: 2 };
  fading.sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3));

  if (fading.length === 0) {
    console.log('All relationships are healthy!');
    return;
  }

  console.log(`\n${fading.length} contacts need attention:\n`);
  console.log(`${'Status'.padEnd(10)} ${'Name'.padEnd(25)} ${'Tier'.padEnd(15)} ${'Score'.padEnd(12)} ${'Last Contact'}`);
  console.log('-'.repeat(75));

  for (const f of fading) {
    const scoreStr = `${f.score}/${f.threshold}`;
    console.log(
      `${f.status.padEnd(10)} ${f.name.padEnd(25)} ${f.tier.padEnd(15)} ${scoreStr.padEnd(12)} ${daysSince(f.lastInteraction)}`
    );
  }
}

async function showUnresolved(): Promise<void> {
  const unresolved = db.prepare(
    `SELECT identifier, source, COUNT(*) as count, MAX(timestamp) as last_ts
     FROM unresolved_interactions
     GROUP BY identifier, source
     ORDER BY count DESC`
  ).all() as any[];

  if (unresolved.length === 0) {
    console.log('No unresolved interactions.');
    return;
  }

  console.log(`\n${unresolved.length} unresolved identifiers:\n`);
  console.log(`${'Identifier'.padEnd(25)} ${'Source'.padEnd(12)} ${'Count'.padEnd(8)} Last Seen`);
  console.log('-'.repeat(60));

  for (const u of unresolved) {
    console.log(
      `${u.identifier.padEnd(25)} ${u.source.padEnd(12)} ${String(u.count).padEnd(8)} ${daysSince(u.last_ts)}`
    );
  }

  console.log('\nTo resolve: add a contact with --phone matching the identifier.');
}

async function computeScores(): Promise<void> {
  writeIpc({ type: 'relationship_compute_scores' });
  console.log('Score computation queued. Results will be available shortly.');
}

async function mergeContacts(): Promise<void> {
  if (!values.source || !values.target) {
    console.error('Error: --source and --target (contact IDs) are required');
    process.exit(1);
  }

  const source = db.prepare('SELECT * FROM contacts WHERE id = ?').get(values.source) as any;
  const target = db.prepare('SELECT * FROM contacts WHERE id = ?').get(values.target) as any;

  if (!source) { console.error(`Source contact not found: ${values.source}`); process.exit(1); }
  if (!target) { console.error(`Target contact not found: ${values.target}`); process.exit(1); }

  writeIpc({
    type: 'relationship_merge',
    source_id: Number(values.source),
    target_id: Number(values.target),
  });

  console.log(`Merge queued: "${source.name}" → "${target.name}". All identifiers and interactions will move to target.`);
}

// --- Dispatch ---
async function run(): Promise<void> {
  try {
    switch (action) {
      case 'list': await listContacts(); break;
      case 'get': await getContact(); break;
      case 'add': await addContact(); break;
      case 'update': await updateContact(); break;
      case 'log': await logManualInteraction(); break;
      case 'fading': await showFading(); break;
      case 'unresolved': await showUnresolved(); break;
      case 'compute-scores': await computeScores(); break;
      case 'merge': await mergeContacts(); break;
      default:
        console.error(`Unknown action: ${action}`);
        console.error('Valid actions: list, get, add, update, log, fading, unresolved, compute-scores, merge');
        process.exit(1);
    }
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

run();
