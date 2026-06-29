/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getFCMToken, db } from '../firebase';
import { doc, deleteDoc } from 'firebase/firestore';

let fallbackTimeoutId: ReturnType<typeof setTimeout> | null = null;

/**
 * Saves or updates the daily notification schedule via server-side API.
 * Uses the server endpoint to bypass Firestore security rules.
 */
async function saveNotificationSchedule(
        userId: string,
        time: string,
        title: string,
        body: string,
        link?: string,
        fcmToken?: string | null
    ): Promise<void> {
      try {
              const response = await fetch('/api/register-notification', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                                      userId,
                                                      time,
                                                      title,
                                                      body,
                                                      link: link || '/',
                                                      token: fcmToken || undefined,
                              }),
              });

        if (!response.ok) {
                        const errData = await response.json().catch(() => ({}));
                        throw new Error(errData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
              console.log(`[FCM Queue] Lembrete diário registrado via API para ${userId} às ${time}:`, data.docId);
      } catch (err) {
              console.error('[FCM Queue] Erro ao registrar lembrete via API:', err);
      }
}

/**
 * Removes the daily notification schedule from Firestore notificationQueue.
 */
export async function cancelNotificationSchedule(userId: string): Promise<void> {
      try {
              const docId = `daily_${userId.replace(/[^a-zA-Z0-9]/g, '_')}`;
              await deleteDoc(doc(db, 'notificationQueue', docId));
              console.log(`[FCM Queue] Lembrete diário removido do Firestore para ${userId}`);
      } catch (err) {
              console.error('[FCM Queue] Erro ao remover lembrete do Firestore:', err);
      }
}

function urlBase64ToUint8Array(base64String: string) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
              outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
}

export async function subscribeUserToPush(email: string): Promise<any> {
      const isSWSupported = 'serviceWorker' in navigator;
      const isPushSupported = 'PushManager' in window;
      if (!isSWSupported || !isPushSupported) {
              console.warn('[Push Service] Push notifications are not supported on this browser/platform.');
              return null;
      }
      try {
              const response = await fetch('/api/push-public-key');
              if (!response.ok) throw new Error(`Failed to fetch push public key: ${response.statusText}`);
              const { publicKey } = await response.json();
              const reg = await navigator.serviceWorker.ready;
              let subscription = await reg.pushManager.getSubscription();
              if (!subscription) {
                        subscription = await reg.pushManager.subscribe({
                                          userVisibleOnly: true,
                                          applicationServerKey: urlBase64ToUint8Array(publicKey)
                        });
              }
              const rawSub = subscription.toJSON() as any;
              if (!rawSub.endpoint || !rawSub.keys || !rawSub.keys.p256dh || !rawSub.keys.auth) {
                        console.warn('[Push Service] Serialized subscription contains missing fields.');
                        return subscription;
              }
              console.log('[Push Service] Device subscribed:', rawSub.endpoint.substring(0, 50) + '...');
              localStorage.setItem(`sgr_push_subscription_${email}`, JSON.stringify(subscription));
              return subscription;
      } catch (err) {
              console.error('[Push Service] Subscription sequence encountered an issue:', err);
              return null;
      }
}

export async function scheduleNotification(
      time: string,
      title: string,
      body: string,
      email?: string
    ) {
      const userParam = email || 'anonymous';
      localStorage.setItem(`sgr_notify_enabled_${userParam}`, 'true');
      localStorage.setItem(`sgr_notify_time_${userParam}`, time);

  const isSWSupported = 'serviceWorker' in navigator;
      const isNotificationSupported = 'Notification' in window;

  if (!isSWSupported || !isNotificationSupported) {
          console.warn('[Scheduler] Service Workers or Notifications not supported.');
          runLocalFallback(time, title, body);
          return;
  }

  try {
          // Step 1: Request notification permission if not yet granted
        if (Notification.permission === 'default') {
                  await Notification.requestPermission();
        }

        // Step 2: Register the firebase-messaging SW (needed for background push)
        // and also register the app SW for local fallback
        const reg = await navigator.serviceWorker.register('/sw.js');
          await navigator.serviceWorker.ready;

        reg.active?.postMessage({
                        type: 'SCHEDULE_NOTIFICATION',
                        email: userParam,
                        time,
                        title,
                        body,
                        timing: 'mesmo_dia'
        });

        const sw = navigator.serviceWorker.controller;
          if (sw) {
                    sw.postMessage({ type: 'SCHEDULE_NOTIFICATION', email: userParam, time, title, body, timing: 'mesmo_dia' });
                    console.log(`[Scheduler] Agendamento enviado para o Service Worker: ${time} para ${userParam}`);
          }

        // Step 3: Save to Firestore via server API so the cron can fire when app is closed
        if (email) {
                  // Get FCM token to enable server-side push delivery (app closed)
            let fcmToken: string | null = null;
                  if (Notification.permission === 'granted') {
                              try {
                                            fcmToken = await getFCMToken();
                                            if (fcmToken) {
                                                            console.log('[Scheduler] FCM token obtained successfully.');
                                            } else {
                                                            console.warn('[Scheduler] FCM token is null — push may not work when app is closed.');
                                            }
                              } catch (tokenErr) {
                                            console.warn('[Scheduler] Could not get FCM token:', tokenErr);
                              }
                  }

            await saveNotificationSchedule(email, time, title, body, '/', fcmToken);
        }

  } catch (error) {
          console.error('[Scheduler] Erro critico no fluxo de agendamento:', error);
  }

  runLocalFallback(time, title, body);
}

function runLocalFallback(time: string, title: string, body: string) {
      if (fallbackTimeoutId) { clearTimeout(fallbackTimeoutId); fallbackTimeoutId = null; }
      const [cfgHour, cfgMin] = time.split(':').map(Number);
      if (isNaN(cfgHour) || isNaN(cfgMin)) return;
      let now = new Date();
      const target = new Date();
      target.setHours(cfgHour, cfgMin, 0, 0);
      if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
      const delayMs = target.getTime() - now.getTime();
      console.log(`[Scheduler Fallback] Agendamento em ${Math.round(delayMs / 1000)} segundos`);
      if (delayMs > 0 && delayMs < 2147483647) {
              fallbackTimeoutId = setTimeout(() => {
                              if (Notification.permission === 'granted') new Notification(title, { body, icon: '/icon.png' });
                              runLocalFallback(time, title, body);
              }, delayMs);
      }
}
