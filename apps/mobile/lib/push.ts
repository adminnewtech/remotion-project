/**
 * Push registration — obtains the Expo push token and registers it for the
 * signed-in user via @elite/core's `registerPushToken`. No-ops gracefully when
 * permissions are denied, the device is not a physical device, or the backend
 * is unconfigured.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { registerPushToken } from '@elite/core';
import { getSupabase } from './supabase';

Notifications.setNotificationHandler({
  // Cast keeps us compatible across expo-notifications minor versions, where
  // the handler return shape gained banner/list fields.
  handleNotification: async () =>
    ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }) as Notifications.NotificationBehavior,
});

/**
 * Request permission, fetch the Expo push token, and persist it for `userId`.
 * Returns the token (or null if unavailable).
 */
export async function registerForPush(userId: string): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Elite',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync();
    const token = tokenResponse.data;
    if (!token) return null;

    const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
    await registerPushToken(client, userId, token, platform);
    return token;
  } catch {
    // Push is best-effort; never block the app on it.
    return null;
  }
}
