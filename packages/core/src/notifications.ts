/**
 * Notifications — in-app insert + push-token registration.
 *
 * Most milestone notifications are emitted server-side (Postgres triggers →
 * Edge Function). These client helpers cover the cases a client legitimately
 * writes: local/in-app notices and registering this device's push token.
 */
import type { AppNotification } from '@elite/types';
import type { EliteClient } from './client';

export type PushPlatform = 'ios' | 'android' | 'web';

export interface NotificationPayload {
  kind: string;
  title_ar?: string | null;
  title_en?: string | null;
  body_ar?: string | null;
  body_en?: string | null;
  data?: Record<string, unknown>;
}

/**
 * Insert an in-app notification for a user. Note: privileged cross-user
 * notifications are typically created server-side; RLS governs what a client
 * may insert here.
 */
export async function notify(
  client: EliteClient,
  userId: string,
  payload: NotificationPayload,
): Promise<AppNotification> {
  const { data, error } = await client
    .from('notifications')
    .insert({
      user_id: userId,
      kind: payload.kind,
      title_ar: payload.title_ar ?? null,
      title_en: payload.title_en ?? null,
      body_ar: payload.body_ar ?? null,
      body_en: payload.body_en ?? null,
      data: payload.data ?? {},
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as AppNotification;
}

/**
 * Register (or refresh) this device's Expo push token for a user. Upserts on
 * the unique `expo_token` so repeated calls from the same device are idempotent.
 */
export async function registerPushToken(
  client: EliteClient,
  userId: string,
  expoToken: string,
  platform: PushPlatform,
): Promise<void> {
  const { error } = await client
    .from('push_tokens')
    .upsert(
      { user_id: userId, expo_token: expoToken, platform },
      { onConflict: 'expo_token' },
    );
  if (error) throw error;
}
