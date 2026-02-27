import {
  getAllContacts,
  getInteractionsSince,
  storeRelationshipScore,
} from './relationship-db.js';

export const TIER_CONFIG: Record<string, { halfLife: number; threshold: number }> = {
  inner_circle: { halfLife: 14, threshold: 15 },
  close_friend: { halfLife: 30, threshold: 10 },
  good_friend: { halfLife: 60, threshold: 5 },
  acquaintance: { halfLife: 120, threshold: 2 },
};

export const INTERACTION_WEIGHTS: Record<string, number> = {
  '1on1_meeting': 10,
  'call': 8,
  'video_call': 8,
  'manual_checkin': 6,
  'text_1on1': 5,
  'group_meeting': 3,
  'group_chat': 1,
};

export function computeDecayScore(
  interactions: Array<{ value: number; timestamp: string }>,
  halfLifeDays: number,
  now: Date = new Date(),
): number {
  let score = 0;
  for (const interaction of interactions) {
    const daysSince = (now.getTime() - new Date(interaction.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 0) continue;
    score += interaction.value * Math.pow(2, -daysSince / halfLifeDays);
  }
  return Math.round(score * 100) / 100;
}

export function computeReciprocity(
  interactions: Array<{ direction: string | null }>,
): number | null {
  let inbound = 0;
  let outbound = 0;
  for (const i of interactions) {
    if (i.direction === 'inbound') inbound++;
    else if (i.direction === 'outbound') outbound++;
  }
  if (inbound === 0 && outbound === 0) return null;
  const maxVal = Math.max(inbound, outbound);
  const minVal = Math.min(inbound, outbound);
  return Math.round((minVal / maxVal) * 100) / 100;
}

export type ContactStatus = 'healthy' | 'fading' | 'urgent' | 'dormant';

export function getContactStatus(score: number, threshold: number): ContactStatus {
  if (score >= threshold) return 'healthy';
  if (score >= threshold * 0.5) return 'fading';
  if (score > 0) return 'urgent';
  return 'dormant';
}

export function computeAllScores(): Array<{
  contact_id: number;
  name: string;
  tier: string;
  score: number;
  threshold: number;
  status: ContactStatus;
  interactions_30d: number;
  last_interaction: string | null;
  reciprocity_ratio: number | null;
}> {
  const contacts = getAllContacts();
  const now = new Date();
  // Fetch all interactions from last year for scoring
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const results: Array<{
    contact_id: number;
    name: string;
    tier: string;
    score: number;
    threshold: number;
    status: ContactStatus;
    interactions_30d: number;
    last_interaction: string | null;
    reciprocity_ratio: number | null;
  }> = [];

  for (const contact of contacts) {
    const tier = contact.tier || 'acquaintance';
    const config = TIER_CONFIG[tier] || TIER_CONFIG.acquaintance;
    const interactions = getInteractionsSince(contact.id, oneYearAgo);

    const score = computeDecayScore(interactions, config.halfLife, now);
    const reciprocity = computeReciprocity(interactions);
    const interactions30d = interactions.filter((i: { timestamp: string }) => i.timestamp > thirtyDaysAgo).length;
    const lastInteraction = interactions.length > 0 ? interactions[0].timestamp : null;
    const status = getContactStatus(score, config.threshold);

    storeRelationshipScore({
      contact_id: contact.id,
      score,
      tier_threshold: config.threshold,
      interactions_30d: interactions30d,
      last_interaction: lastInteraction,
      reciprocity_ratio: reciprocity,
    });

    results.push({
      contact_id: contact.id,
      name: contact.name,
      tier,
      score,
      threshold: config.threshold,
      status,
      interactions_30d: interactions30d,
      last_interaction: lastInteraction,
      reciprocity_ratio: reciprocity,
    });
  }

  return results;
}
