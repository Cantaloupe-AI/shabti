import {
  addUnresolvedInteraction,
  getContactByIdentifier,
  logAppleSync,
  logInteraction,
} from './relationship-db.js';
import { logger } from './logger.js';

interface AppleSyncData {
  type: 'apple_sync';
  synced_at: string;
  imessages: Array<{
    handle: string;
    timestamp: string;
    is_from_me: number;
    is_group: number;
    chat_id: string | null;
  }>;
  calls: Array<{
    phone_number: string;
    timestamp: string;
    duration_seconds: number;
    direction: string;
    is_facetime: number;
  }>;
}

function normalizePhone(raw: string): string {
  // Strip everything except digits and leading +
  const digits = raw.replace(/[^\d+]/g, '');
  // If it starts with + keep it, otherwise assume US and add +1
  if (digits.startsWith('+')) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

export function processAppleSyncFile(data: AppleSyncData): { processed: number; unresolved: number } {
  let processed = 0;
  let unresolved = 0;

  // Process iMessages
  for (const msg of data.imessages) {
    // Skip group messages — we only score 1:1 for now
    if (msg.is_group) continue;

    const identifier = normalizePhone(msg.handle);
    const direction = msg.is_from_me ? 'outbound' : 'inbound';

    // Try to find contact by imessage identifier or phone
    const contact =
      getContactByIdentifier('imessage', identifier) ||
      getContactByIdentifier('imessage', msg.handle) ||
      getContactByIdentifier('phone', identifier);

    if (contact) {
      try {
        logInteraction({
          contact_id: contact.id,
          source: 'imessage',
          interaction_type: 'text_1on1',
          timestamp: msg.timestamp,
          direction,
          value: 5,
        });
        processed++;
      } catch {
        // duplicate — already logged
      }
    } else {
      addUnresolvedInteraction({
        source: 'imessage',
        identifier,
        interaction_type: 'text_1on1',
        timestamp: msg.timestamp,
        direction,
      });
      unresolved++;
    }
  }

  // Process calls
  for (const call of data.calls) {
    const identifier = normalizePhone(call.phone_number);
    const interactionType = call.is_facetime ? 'video_call' : 'call';
    const value = 8; // calls and video_calls both worth 8

    const contact =
      getContactByIdentifier('phone', identifier) ||
      getContactByIdentifier('imessage', identifier);

    if (contact) {
      try {
        logInteraction({
          contact_id: contact.id,
          source: call.is_facetime ? 'facetime' : 'phone',
          interaction_type: interactionType,
          timestamp: call.timestamp,
          direction: call.direction,
          duration_seconds: call.duration_seconds,
          value,
        });
        processed++;
      } catch {
        // duplicate
      }
    } else {
      addUnresolvedInteraction({
        source: call.is_facetime ? 'facetime' : 'phone',
        identifier,
        interaction_type: interactionType,
        timestamp: call.timestamp,
        direction: call.direction,
        duration_seconds: call.duration_seconds,
      });
      unresolved++;
    }
  }

  // Log sync metadata
  const allTimestamps = [
    ...data.imessages.map(m => m.timestamp),
    ...data.calls.map(c => c.timestamp),
  ];
  const lastTs = allTimestamps.length > 0
    ? allTimestamps.sort().pop()!
    : null;

  logAppleSync('imessage', data.imessages.length, lastTs);
  logAppleSync('calls', data.calls.length, lastTs);

  logger.info(
    { processed, unresolved, imessages: data.imessages.length, calls: data.calls.length },
    'Apple sync processed',
  );

  return { processed, unresolved };
}
