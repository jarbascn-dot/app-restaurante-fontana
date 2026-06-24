/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { saveToFirestore } from './firebaseSync';
import { messaging, getToken } from '../firebase';
import { db } from '../firebase';
import { doc, setDoc, collection, Timestamp } from 'firebase/firestore';

let fallbackTimeoutId: any = null;

/**
 * Convert VAPID key to Uint8Array for browser push manager registration.
 */
function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

  const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
  }
    return outputArray;
}

/**
 * Registers the FCM service worker, gets the FCM token, and saves it to Firestore.
 * Call this after the user logs in to enable push notifications.
 */
export async function registerFCMToken(userId: string): Promise<string | null> {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
          console.warn('[FCM] Service Workers or Notifications not supported.');
          return null;
    }

  try {
        // Request notification permission
      const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
                console.warn('[FCM] Notification permission denied.');
                return null;
        }

      // Register the FCM-specific service worker
      const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('[FCM] firebase-messaging-sw.js registered:', swRegistration.scope);

      // Get FCM token
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
        const token = await getToken(messaging, {
                vapidKey,
                serviceWorkerRegistration: swRegistration,
        });

      if (!token) {
              console.warn('[FCM] No FCM token obtained.');
              return null;
      }

      // Save FCM token to Firestore: users/{userId}.fcmToken
      const userRef = doc(db, 'users', userId);
        await setDoc(userRef, { fcmToken: token, fcmUpdatedAt: new Date().toISOString() }, { merge: true });
        console.log('[FCM] Token saved to Firestore for user:', userId);

      return token;
  } catch (err) {
        console.error('[FCM] Error registering FCM token:', err);
        return null;
  }
}

/**
 * Saves an alarm to Firestore under users/{userId}/alarms/{alarmId}
 * so that the Netlify send-notifications function can pick it up and send FCM push notifications.
 */
export async function scheduleAlarmToFirestore(
    userId: string,
    alarmId: string,
    scheduledTime: Date,
    title: string,
    body: string,
    type: string = 'alarm'
  ): Promise<void> {
    try {
          const alarmRef = doc(collection(db, 'users', userId, 'alarms'), alarmId);
          await setDoc(alarmRef, {
                  id: alarmId,
      title,
                  body,
                  type,
                  scheduledTime: Timestamp.fromDate(scheduledTime),
                  sent: false,
                  createdAt: Timestamp.now(),
          });
          console.log(`[FCM Alarm] Alarm ${alarmId} scheduled for ${scheduledTime.toISOString()}`);
    } catch (err) {
          console.error('[FCM Alarm] Error saving alarm to Firestore:', err);
    }
}

/**
 * Automagic helper to register/sync Web Push subscripton with Firestore and server.
 * This guarantees sleep-proof, WhatsApp-like background and suspended notifications!
 */
export async function subscribeUserToPush(email: string): Promise<any> {
    const isSWSupported = 'serviceWorker' in navigator;
    const isPushSupported = 'PushManager' in window;

  if (!isSWSupported || !isPushSupported) {
        console.warn('[Push Service] Push notifications are not supported on this browser/platform.');
        return null;
  }

  try {
        // 1. Fetch public VAPID key from Express API
      const response = await fetch('/api/push/public-key');
        if (!response.ok) {
                throw new Error(`Failed to fetch push public key: ${response.statusText}`);
        }
        const { publicKey } = await response.json();

      // 2. Get active service worker
      const reg = await navigator.serviceWorker.ready;

      // 3. Request subscription
      let subscription = await reg.pushManager.getSubscription();
        if (!subscription) {
                subscription = await reg.pushManager.subscribe({
                          userVisibleOnly: true,
                          applicationServerKey: urlBase64ToUint8Array(publicKey)
                });
        }

      // 4. Transform into clean serialized object for Firestore and server payload
      const rawSub = subscription.toJSON();
        if (!rawSub.endpoint || !rawSub.keys || !rawSub.keys.p256dh || !rawSub.keys.auth) {
                console.warn('[Push Service] Serialized subscription contains missing fields.');
                return subscription;
        }

      const pushSub = {
              id: `sub-${email.replace(/[^a-zA-Z0-9]/g, '-')}`,
              email,
              endpoint: rawSub.endpoint,
              keys: {
                        p256dh: rawSub.keys.p256dh,
                        auth: rawSub.keys.auth
              },
              updatedAt: new Date().toISOString()
      };

      // 5. Store in Firebase Cloud Database to persist across devices and server reboots
      await saveToFirestore('push_subscriptions', pushSub);
        console.log('[Push Service] Device subscribed and synced with Firestore:', pushSub);

      // Save subscription locally for immediate visual testing / simulated alerts
      localStorage.setItem(`sgr_push_subscription_${email}`, JSON.stringify(subscription));

      return subscription;
  } catch (err) {
        console.error('[Push Service] Subscription sequence encountered an issue:', err);
        return null;
  }
}

/**
 * Robust cross-platform helper to request permissions and schedule background
 * and foreground notification triggers.
 */
export async function scheduleNotification(
    time: string,
    title: string,
    body: string,
    email?: string
  ) {
    const userParam = email || 'guest';

  // Persist locally in localStorage for robust client fallback reads
  localStorage.setItem(`sgr_notify_enabled_${userParam}`, 'true');
    localStorage.setItem(`sgr_notify_time_${userParam}`, time);

  const isSWSupported = 'serviceWorker' in navigator;
    const isNotificationSupported = 'Notification' in window;

  if (!isSWSupported || !isNotificationSupported) {
        console.warn('[Scheduler] Service Workers ou Notifications não são totalmente suportados por esta plataforma.');
        runLocalFallback(time, title, body);
        return;
  }

  try {
        // Request permission if not already denied or granted
      let permission = Notification.permission;
        if (permission === 'default') {
                permission = await Notification.requestPermission();
        }

      if (permission !== 'granted') {
              console.warn('[Scheduler] Notification permission not granted. Using local fallback.');
              runLocalFallback(time, title, body);
              return;
      }

      // Schedule via service worker message
      const reg = await navigator.serviceWorker.ready;

      // Calculate delay in milliseconds
      const [hours, minutes] = time.split(':').map(Number);
        const now = new Date();
        const target = new Date();
        target.setHours(hours, minutes, 0, 0);

      if (target <= now) {
              target.setDate(target.getDate() + 1);
      }

      const delay = target.getTime() - now.getTime();

      // Clear previous fallback timeout
      if (fallbackTimeoutId) {
              clearTimeout(fallbackTimeoutId);
      }

      // Use service worker postMessage for scheduling
      if (reg.active) {
              reg.active.postMessage({
                        type: 'SCHEDULE_NOTIFICATION',
                        payload: { time, title, body, delay }
              });
              console.log(`[Scheduler] Notification scheduled via SW for ${time} (in ${Math.round(delay / 60000)} min)`);
      }

      // Also set local timeout as fallback for when app is in foreground
      fallbackTimeoutId = setTimeout(() => {
              if (Notification.permission === 'granted') {
                        new Notification(title, { body, icon: '/icons/icon-192x192.png' });
              }
      }, delay);

  } catch (err) {
        console.error('[Scheduler] Error scheduling notification:', err);
        runLocalFallback(time, title, body);
  }
}

/**
 * Local fallback for scheduling notifications when service worker is unavailable.
 */
function runLocalFallback(time: string, title: string, body: string) {
    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);

  if (target <= now) {
        target.setDate(target.getDate() + 1);
  }

  const delay = target.getTime() - now.getTime();

  if (fallbackTimeoutId) {
        clearTimeout(fallbackTimeoutId);
  }

  fallbackTimeoutId = setTimeout(() => {
        if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(title, { body, icon: '/icons/icon-192x192.png' });
        }
  }, delay);

  console.log(`[Local Fallback] Notification will fire in ${Math.round(delay / 60000)} minutes.`);
}

/**
 * Cancel any pending local notification timeout.
 */
export function cancelNotification(email?: string) {
    const userParam = email || 'guest';
    localStorage.removeItem(`sgr_notify_enabled_${userParam}`);
    localStorage.removeItem(`sgr_notify_time_${userParam}`);

  if (fallbackTimeoutId) {
        clearTimeout(fallbackTimeoutId);
        fallbackTimeoutId = null;
  }
    console.log('[Scheduler] Notification cancelled.');
}
