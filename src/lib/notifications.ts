import type { SupabaseClient } from '@supabase/supabase-js';
import { sendSignalDigest, sendOpportunityStageChange, sendSignalScoreUpdate, sendWeeklyDigest } from './email';

export interface NotificationPrefs {
  newSignals: boolean;
  signalScores: boolean;
  opportunityStages: boolean;
  weeklyDigest: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  newSignals: true,
  signalScores: true,
  opportunityStages: true,
  weeklyDigest: true,
};

export function getNotificationPrefs(orgSettings: Record<string, unknown> | null | undefined): NotificationPrefs {
  const n = orgSettings?.notification as Record<string, boolean> | undefined;
  if (!n || typeof n !== 'object') return { ...DEFAULT_PREFS };
  return {
    newSignals: n.newSignals !== false,
    signalScores: n.signalScores !== false,
    opportunityStages: n.opportunityStages !== false,
    weeklyDigest: n.weeklyDigest !== false,
  };
}

/** Get first notification email for org (owner). Uses admin client to read org + auth. */
export async function getOrgNotificationEmail(
  admin: SupabaseClient,
  orgId: string
): Promise<string | null> {
  const { data: org } = await admin.from('organizations').select('name, owner_user_id').eq('id', orgId).single();
  if (!org?.owner_user_id) return null;
  try {
    const { data: { user } } = await admin.auth.admin.getUserById(org.owner_user_id);
    return user?.email ?? null;
  } catch {
    return null;
  }
}

/** Send "new signals" notification if prefs allow. Call after Vigil (or bulk signal creation). */
export async function notifyNewSignals(
  admin: SupabaseClient,
  orgId: string,
  signalCount: number
): Promise<void> {
  if (signalCount <= 0) return;
  const { data: row } = await admin.from('organizations').select('name, org_settings').eq('id', orgId).single();
  if (!row) return;
  const prefs = getNotificationPrefs((row as { org_settings?: Record<string, unknown> }).org_settings);
  if (!prefs.newSignals) return;
  const to = await getOrgNotificationEmail(admin, orgId);
  if (!to) return;
  const orgName = (row as { name?: string }).name ?? 'Your team';
  await sendSignalDigest(to, orgName, signalCount);
}

/** Send "opportunity stage change" notification if prefs allow. */
export async function notifyOpportunityStage(
  admin: SupabaseClient,
  orgId: string,
  opportunityName: string,
  oldStage: string,
  newStage: string
): Promise<void> {
  const { data: row } = await admin.from('organizations').select('name, org_settings').eq('id', orgId).single();
  if (!row) return;
  const prefs = getNotificationPrefs((row as { org_settings?: Record<string, unknown> }).org_settings);
  if (!prefs.opportunityStages) return;
  const to = await getOrgNotificationEmail(admin, orgId);
  if (!to) return;
  const orgName = (row as { name?: string }).name ?? 'Your team';
  await sendOpportunityStageChange(to, orgName, opportunityName, oldStage, newStage);
}

/** Send "signal score updated" notification if prefs allow. */
export async function notifySignalScoreUpdate(
  admin: SupabaseClient,
  orgId: string,
  company: string,
  newScore: number
): Promise<void> {
  const { data: row } = await admin.from('organizations').select('name, org_settings').eq('id', orgId).single();
  if (!row) return;
  const prefs = getNotificationPrefs((row as { org_settings?: Record<string, unknown> }).org_settings);
  if (!prefs.signalScores) return;
  const to = await getOrgNotificationEmail(admin, orgId);
  if (!to) return;
  const orgName = (row as { name?: string }).name ?? 'Your team';
  await sendSignalScoreUpdate(to, orgName, company, newScore);
}

/** Payload for weekly digest. */
export interface WeeklyDigestPayload {
  signalsCount: number;
  opportunitiesUpdated: number;
}

/** Send weekly digest if prefs allow. Called from cron. */
export async function sendWeeklyDigestForOrg(
  admin: SupabaseClient,
  orgId: string,
  payload: WeeklyDigestPayload
): Promise<void> {
  const { data: row } = await admin.from('organizations').select('name, org_settings').eq('id', orgId).single();
  if (!row) return;
  const prefs = getNotificationPrefs((row as { org_settings?: Record<string, unknown> }).org_settings);
  if (!prefs.weeklyDigest) return;
  const to = await getOrgNotificationEmail(admin, orgId);
  if (!to) return;
  const orgName = (row as { name?: string }).name ?? 'Your team';
  await sendWeeklyDigest(to, orgName, payload);
}
