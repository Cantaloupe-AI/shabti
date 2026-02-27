import Database from 'better-sqlite3';
import path from 'path';

import { STORE_DIR } from './config.js';
import { logger } from './logger.js';

// --- Types ---

export interface Contact {
  id: number;
  name: string;
  tier: string;
  desired_tier: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactIdentifier {
  id: number;
  contact_id: number;
  channel: string;
  identifier: string;
  display_name: string | null;
}

export interface Interaction {
  id: number;
  contact_id: number;
  source: string;
  interaction_type: string;
  timestamp: string;
  direction: string | null;
  duration_seconds: number | null;
  value: number;
  metadata: string | null;
}

export interface RelationshipScore {
  id: number;
  contact_id: number;
  score: number;
  tier_threshold: number | null;
  computed_at: string;
  interactions_30d: number;
  last_interaction: string | null;
  reciprocity_ratio: number | null;
}

export interface UnresolvedInteraction {
  id: number;
  source: string;
  identifier: string;
  interaction_type: string;
  timestamp: string;
  direction: string | null;
  duration_seconds: number | null;
  metadata: string | null;
}

// --- Schema ---

export function createRelationshipSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      tier TEXT NOT NULL DEFAULT 'acquaintance',
      desired_tier TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS contact_identifiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL,
      channel TEXT NOT NULL,
      identifier TEXT NOT NULL,
      display_name TEXT,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
      UNIQUE(channel, identifier)
    );
    CREATE INDEX IF NOT EXISTS idx_contact_identifiers_contact ON contact_identifiers(contact_id);
    CREATE TABLE IF NOT EXISTS interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL,
      source TEXT NOT NULL,
      interaction_type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      direction TEXT,
      duration_seconds INTEGER,
      value INTEGER NOT NULL DEFAULT 1,
      metadata TEXT,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
      UNIQUE(contact_id, source, timestamp)
    );
    CREATE INDEX IF NOT EXISTS idx_interactions_contact ON interactions(contact_id);
    CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON interactions(timestamp);
    CREATE TABLE IF NOT EXISTS relationship_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL,
      score REAL NOT NULL,
      tier_threshold REAL,
      computed_at TEXT NOT NULL,
      interactions_30d INTEGER DEFAULT 0,
      last_interaction TEXT,
      reciprocity_ratio REAL,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_scores_contact ON relationship_scores(contact_id);
    CREATE INDEX IF NOT EXISTS idx_scores_computed ON relationship_scores(computed_at);
    CREATE TABLE IF NOT EXISTS unresolved_interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      identifier TEXT NOT NULL,
      interaction_type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      direction TEXT,
      duration_seconds INTEGER,
      metadata TEXT
    );
    CREATE TABLE IF NOT EXISTS apple_sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      synced_at TEXT NOT NULL,
      source TEXT NOT NULL,
      records_count INTEGER NOT NULL,
      last_record_timestamp TEXT
    );
  `);
}

// --- Accessor functions ---
// These open their own connection to avoid coupling with the main db module's
// private `db` variable. The DB file is the same (messages.db).

function getDb(): Database.Database {
  const dbPath = path.join(STORE_DIR, 'messages.db');
  return new Database(dbPath);
}

function getInteractionValue(type: string): number {
  const weights: Record<string, number> = {
    '1on1_meeting': 10,
    'call': 8,
    'video_call': 8,
    'manual_checkin': 6,
    'text_1on1': 5,
    'group_meeting': 3,
    'group_chat': 1,
  };
  return weights[type] || 1;
}

export function createContact(contact: {
  name: string;
  tier?: string;
  desired_tier?: string;
  notes?: string;
}): number {
  const db = getDb();
  try {
    const now = new Date().toISOString();
    const result = db.prepare(
      `INSERT INTO contacts (name, tier, desired_tier, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      contact.name,
      contact.tier || 'acquaintance',
      contact.desired_tier || null,
      contact.notes || null,
      now,
      now,
    );
    return Number(result.lastInsertRowid);
  } finally {
    db.close();
  }
}

export function updateContact(
  id: number,
  updates: Partial<Pick<Contact, 'name' | 'tier' | 'desired_tier' | 'notes'>>,
): void {
  const db = getDb();
  try {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.tier !== undefined) { fields.push('tier = ?'); values.push(updates.tier); }
    if (updates.desired_tier !== undefined) { fields.push('desired_tier = ?'); values.push(updates.desired_tier); }
    if (updates.notes !== undefined) { fields.push('notes = ?'); values.push(updates.notes); }

    if (fields.length === 0) return;

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    db.prepare(`UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  } finally {
    db.close();
  }
}

export function getContactById(id: number): Contact | undefined {
  const db = getDb();
  try {
    return db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as Contact | undefined;
  } finally {
    db.close();
  }
}

export function getContactByName(name: string): Contact | undefined {
  const db = getDb();
  try {
    return db.prepare('SELECT * FROM contacts WHERE name = ? COLLATE NOCASE').get(name) as Contact | undefined;
  } finally {
    db.close();
  }
}

export function getContactByIdentifier(channel: string, identifier: string): Contact | undefined {
  const db = getDb();
  try {
    return db.prepare(
      `SELECT c.* FROM contacts c JOIN contact_identifiers ci ON c.id = ci.contact_id
       WHERE ci.channel = ? AND ci.identifier = ?`,
    ).get(channel, identifier) as Contact | undefined;
  } finally {
    db.close();
  }
}

export function getAllContacts(): Contact[] {
  const db = getDb();
  try {
    return db.prepare('SELECT * FROM contacts ORDER BY name').all() as Contact[];
  } finally {
    db.close();
  }
}

export function addContactIdentifier(contactId: number, channel: string, identifier: string, displayName?: string): void {
  const db = getDb();
  try {
    db.prepare(
      `INSERT OR IGNORE INTO contact_identifiers (contact_id, channel, identifier, display_name) VALUES (?, ?, ?, ?)`,
    ).run(contactId, channel, identifier, displayName || null);
  } finally {
    db.close();
  }
}

export function getContactIdentifiers(contactId: number): ContactIdentifier[] {
  const db = getDb();
  try {
    return db.prepare('SELECT * FROM contact_identifiers WHERE contact_id = ?').all(contactId) as ContactIdentifier[];
  } finally {
    db.close();
  }
}

export function logInteraction(interaction: {
  contact_id: number;
  source: string;
  interaction_type: string;
  timestamp: string;
  direction?: string;
  duration_seconds?: number;
  value: number;
  metadata?: string;
}): void {
  const db = getDb();
  try {
    db.prepare(
      `INSERT OR IGNORE INTO interactions (contact_id, source, interaction_type, timestamp, direction, duration_seconds, value, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      interaction.contact_id,
      interaction.source,
      interaction.interaction_type,
      interaction.timestamp,
      interaction.direction || null,
      interaction.duration_seconds || null,
      interaction.value,
      interaction.metadata || null,
    );
  } finally {
    db.close();
  }
}

export function getInteractionsSince(contactId: number, sinceTimestamp: string): Interaction[] {
  const db = getDb();
  try {
    return db.prepare(
      'SELECT * FROM interactions WHERE contact_id = ? AND timestamp > ? ORDER BY timestamp DESC',
    ).all(contactId, sinceTimestamp) as Interaction[];
  } finally {
    db.close();
  }
}

export function getAllInteractionsSince(sinceTimestamp: string): Interaction[] {
  const db = getDb();
  try {
    return db.prepare(
      'SELECT * FROM interactions WHERE timestamp > ? ORDER BY timestamp DESC',
    ).all(sinceTimestamp) as Interaction[];
  } finally {
    db.close();
  }
}

export function storeRelationshipScore(score: {
  contact_id: number;
  score: number;
  tier_threshold: number;
  interactions_30d: number;
  last_interaction: string | null;
  reciprocity_ratio: number | null;
}): void {
  const db = getDb();
  try {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO relationship_scores (contact_id, score, tier_threshold, computed_at, interactions_30d, last_interaction, reciprocity_ratio)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(score.contact_id, score.score, score.tier_threshold, now, score.interactions_30d, score.last_interaction, score.reciprocity_ratio);
  } finally {
    db.close();
  }
}

export function getLatestScores(): (RelationshipScore & { name: string; tier: string })[] {
  const db = getDb();
  try {
    return db.prepare(
      `SELECT rs.*, c.name, c.tier FROM relationship_scores rs
       JOIN contacts c ON rs.contact_id = c.id
       WHERE rs.computed_at = (SELECT MAX(rs2.computed_at) FROM relationship_scores rs2 WHERE rs2.contact_id = rs.contact_id)
       ORDER BY rs.score DESC`,
    ).all() as (RelationshipScore & { name: string; tier: string })[];
  } finally {
    db.close();
  }
}

export function getScoreHistory(contactId: number, limit: number = 30): RelationshipScore[] {
  const db = getDb();
  try {
    return db.prepare(
      'SELECT * FROM relationship_scores WHERE contact_id = ? ORDER BY computed_at DESC LIMIT ?',
    ).all(contactId, limit) as RelationshipScore[];
  } finally {
    db.close();
  }
}

export function getLastAppleSync(source: string): { synced_at: string; last_record_timestamp: string | null } | undefined {
  const db = getDb();
  try {
    return db.prepare(
      'SELECT synced_at, last_record_timestamp FROM apple_sync_log WHERE source = ? ORDER BY synced_at DESC LIMIT 1',
    ).get(source) as { synced_at: string; last_record_timestamp: string | null } | undefined;
  } finally {
    db.close();
  }
}

export function logAppleSync(source: string, recordsCount: number, lastRecordTimestamp: string | null): void {
  const db = getDb();
  try {
    db.prepare(
      'INSERT INTO apple_sync_log (synced_at, source, records_count, last_record_timestamp) VALUES (?, ?, ?, ?)',
    ).run(new Date().toISOString(), source, recordsCount, lastRecordTimestamp);
  } finally {
    db.close();
  }
}

export function addUnresolvedInteraction(interaction: {
  source: string;
  identifier: string;
  interaction_type: string;
  timestamp: string;
  direction?: string;
  duration_seconds?: number;
  metadata?: string;
}): void {
  const db = getDb();
  try {
    db.prepare(
      `INSERT INTO unresolved_interactions (source, identifier, interaction_type, timestamp, direction, duration_seconds, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      interaction.source,
      interaction.identifier,
      interaction.interaction_type,
      interaction.timestamp,
      interaction.direction || null,
      interaction.duration_seconds || null,
      interaction.metadata || null,
    );
  } finally {
    db.close();
  }
}

export function getUnresolvedInteractions(): UnresolvedInteraction[] {
  const db = getDb();
  try {
    return db.prepare('SELECT * FROM unresolved_interactions ORDER BY timestamp DESC').all() as UnresolvedInteraction[];
  } finally {
    db.close();
  }
}

export function resolveInteractions(identifier: string, contactId: number): number {
  const db = getDb();
  try {
    const unresolved = db.prepare(
      'SELECT * FROM unresolved_interactions WHERE identifier = ?',
    ).all(identifier) as UnresolvedInteraction[];

    let resolved = 0;
    for (const u of unresolved) {
      try {
        db.prepare(
          `INSERT OR IGNORE INTO interactions (contact_id, source, interaction_type, timestamp, direction, duration_seconds, value, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          contactId,
          u.source,
          u.interaction_type,
          u.timestamp,
          u.direction || null,
          u.duration_seconds || null,
          getInteractionValue(u.interaction_type),
          u.metadata || null,
        );
        resolved++;
      } catch {
        // duplicate
      }
    }

    if (resolved > 0) {
      db.prepare('DELETE FROM unresolved_interactions WHERE identifier = ?').run(identifier);
    }

    return resolved;
  } finally {
    db.close();
  }
}

export function mergeContacts(sourceId: number, targetId: number): void {
  const db = getDb();
  try {
    db.prepare('UPDATE contact_identifiers SET contact_id = ? WHERE contact_id = ?').run(targetId, sourceId);
    db.prepare('UPDATE interactions SET contact_id = ? WHERE contact_id = ?').run(targetId, sourceId);
    db.prepare('DELETE FROM relationship_scores WHERE contact_id = ?').run(sourceId);
    db.prepare('DELETE FROM contacts WHERE id = ?').run(sourceId);
  } finally {
    db.close();
  }
}

export function deleteContact(id: number): void {
  const db = getDb();
  try {
    db.prepare('DELETE FROM interactions WHERE contact_id = ?').run(id);
    db.prepare('DELETE FROM contact_identifiers WHERE contact_id = ?').run(id);
    db.prepare('DELETE FROM relationship_scores WHERE contact_id = ?').run(id);
    db.prepare('DELETE FROM contacts WHERE id = ?').run(id);
  } finally {
    db.close();
  }
}
