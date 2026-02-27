import Database from 'better-sqlite3';
import path from 'path';

import { STORE_DIR } from './config.js';
import {
  addContactIdentifier,
  getContactByIdentifier,
  logInteraction,
} from './relationship-db.js';
import { logger } from './logger.js';

interface MessageGroup {
  sender: string;
  chat_jid: string;
  count: number;
  min_ts: string;
  max_ts: string;
}

/**
 * Aggregate WhatsApp and Telegram messages into relationship interactions.
 * Groups messages by sender per day and writes as text_1on1 or group_chat interactions.
 */
export function aggregateMessagingInteractions(sinceTimestamp: string): { processed: number; skipped: number } {
  const dbPath = path.join(STORE_DIR, 'messages.db');
  const db = new Database(dbPath, { readonly: true });

  let processed = 0;
  let skipped = 0;

  try {
    // 1:1 WhatsApp chats (JID ends with @s.whatsapp.net)
    const wa1on1 = db.prepare(`
      SELECT sender, chat_jid, COUNT(*) as count,
             MIN(timestamp) as min_ts, MAX(timestamp) as max_ts,
             date(timestamp) as day
      FROM messages
      WHERE timestamp > ? AND chat_jid LIKE '%@s.whatsapp.net'
        AND is_bot_message = 0 AND content != '' AND content IS NOT NULL
      GROUP BY sender, chat_jid, day
      HAVING count >= 2
    `).all(sinceTimestamp) as (MessageGroup & { day: string })[];

    for (const group of wa1on1) {
      // Extract phone from WhatsApp JID: 15551234567@s.whatsapp.net
      const phone = group.chat_jid.replace('@s.whatsapp.net', '');
      const normalizedPhone = `+${phone}`;

      const contact = getContactByIdentifier('whatsapp', group.chat_jid)
        || getContactByIdentifier('phone', normalizedPhone)
        || getContactByIdentifier('imessage', normalizedPhone);

      if (!contact) { skipped++; continue; }

      try {
        logInteraction({
          contact_id: contact.id,
          source: 'whatsapp',
          interaction_type: 'text_1on1',
          timestamp: group.max_ts,
          direction: group.sender === group.chat_jid ? 'inbound' : 'outbound',
          value: 5,
          metadata: JSON.stringify({ message_count: group.count }),
        });
        processed++;
      } catch {
        // duplicate
      }
    }

    // 1:1 Telegram chats (JID starts with tg: but not a group — non-group tg JIDs are negative but not super-negative)
    const tg1on1 = db.prepare(`
      SELECT sender, chat_jid, COUNT(*) as count,
             MIN(timestamp) as min_ts, MAX(timestamp) as max_ts,
             date(timestamp) as day
      FROM messages m
      JOIN chats c ON m.chat_jid = c.jid
      WHERE m.timestamp > ? AND c.channel = 'telegram' AND c.is_group = 0
        AND m.is_bot_message = 0 AND m.content != '' AND m.content IS NOT NULL
      GROUP BY sender, chat_jid, day
      HAVING count >= 2
    `).all(sinceTimestamp) as (MessageGroup & { day: string })[];

    for (const group of tg1on1) {
      const contact = getContactByIdentifier('telegram', group.chat_jid);
      if (!contact) { skipped++; continue; }

      try {
        logInteraction({
          contact_id: contact.id,
          source: 'telegram',
          interaction_type: 'text_1on1',
          timestamp: group.max_ts,
          direction: group.sender === group.chat_jid ? 'inbound' : 'outbound',
          value: 5,
          metadata: JSON.stringify({ message_count: group.count }),
        });
        processed++;
      } catch {
        // duplicate
      }
    }

    // Group chats — count participation per person per day
    const groupChats = db.prepare(`
      SELECT sender, sender_name, chat_jid, COUNT(*) as count,
             MAX(timestamp) as max_ts,
             date(timestamp) as day
      FROM messages m
      JOIN chats c ON m.chat_jid = c.jid
      WHERE m.timestamp > ? AND c.is_group = 1
        AND m.is_bot_message = 0 AND m.content != '' AND m.content IS NOT NULL
      GROUP BY sender, chat_jid, day
    `).all(sinceTimestamp) as (MessageGroup & { sender_name: string; day: string })[];

    for (const group of groupChats) {
      // Try to find contact by their sender JID across channels
      let contact = getContactByIdentifier('whatsapp', group.sender)
        || getContactByIdentifier('telegram', group.sender);

      // Also try phone extraction for WhatsApp senders
      if (!contact && group.sender.includes('@s.whatsapp.net')) {
        const phone = `+${group.sender.replace('@s.whatsapp.net', '')}`;
        contact = getContactByIdentifier('phone', phone)
          || getContactByIdentifier('imessage', phone);
      }

      if (!contact) continue;

      try {
        logInteraction({
          contact_id: contact.id,
          source: group.chat_jid.startsWith('tg:') ? 'telegram' : 'whatsapp',
          interaction_type: 'group_chat',
          timestamp: group.max_ts,
          value: 1,
          metadata: JSON.stringify({ chat_jid: group.chat_jid, message_count: group.count }),
        });
        processed++;
      } catch {
        // duplicate
      }
    }
  } finally {
    db.close();
  }

  logger.info({ processed, skipped, since: sinceTimestamp }, 'Messaging interactions aggregated');
  return { processed, skipped };
}

/**
 * When adding a WhatsApp identifier, auto-create a phone/iMessage identifier too.
 * WhatsApp JIDs contain the phone number: 15551234567@s.whatsapp.net
 */
export function crossLinkWhatsAppIdentifier(contactId: number, whatsappJid: string): void {
  const match = whatsappJid.match(/^(\d+)@s\.whatsapp\.net$/);
  if (!match) return;

  const phone = `+${match[1]}`;
  addContactIdentifier(contactId, 'phone', phone);
  addContactIdentifier(contactId, 'imessage', phone);
}
