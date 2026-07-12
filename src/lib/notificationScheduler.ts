/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { saveToFirestore } from './firebaseSync';
import { getFCMToken, db } from '../firebase';
import { doc, setDoc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';

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

      // Sync notificationQueue in Firestore FIRST, independent of local Notification API
      // support. Actual delivery on Android happens via native FCM push + native channel,
      // not via window.Notification, so this must not be gated behind that permission check
      // (a bare WebView without WebChromeClient support never grants it, which was silently
      // blocking scheduledTime/sent updates whenever the user rescheduled from the app).
      if (email) {
              const emailLowerSync = email.toLowerCase().trim();
              const queueDocId = `daily_${emailLowerSync.replace(/[^a-zA-Z0-9]/g, '_')}`;
              const docRef = doc(db, 'notificationQueue', queueDocId);

              try {
                        const docSnap = await getDoc(docRef);
                        if (docSnap.exists()) {
                                    const existingData: any = docSnap.data();
                                    const todayStr = new Date().toISOString().slice(0, 10);
                                    const lastSyncStr = existingData?.updatedAt ? String(existingData.updatedAt).slice(0, 10) : null;
                                    const isNewDay = lastSyncStr !== todayStr;
                                    const timeChanged = existingData?.scheduledTime !== time;

                                    await updateDoc(docRef, {
                                                  scheduledTime: time,
                                                  updatedAt: new Date().toISOString(),
                                                  ...((isNewDay || timeChanged) ? { sent: false, errorAt: null, errorMessage: null } : {})
                                    });
                                    console.log(`[Scheduler] Updated existing notificationQueue doc ${queueDocId} with scheduledTime:`, time);
                        } else {
                                    const queueItem = {
                                                  id: queueDocId,
                                                  userId: emailLowerSync,
                                                  title: title || 'SGR Fontana',
                                                  body: body || 'Lembrete de refeição!',
                                                  link: '/',
                                                  daily: true,
                                                  scheduledTime: time,
                                                  sent: false,
                                                  updatedAt: new Date().toISOString()
                                    };
                                    await saveToFirestore('notificationQueue', queueItem);
                                    console.log('[Scheduler] Created new notificationQueue doc:', queueDocId);
                        }
              } catch (err) {
                        console.warn('[Scheduler] Failed to sync notificationQueue doc:', err);
              }
      }

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
      console.warn('[Scheduler] Permissão para notificações negada pelo usuário ou sistema:', permission);
      return;
    }

    // Register our customizable sw.js
    let reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!reg) {
      reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    }

    // Wait until controller is ready to receive messages
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
      });
    }

    // Relay notification specs to background thread
    const sw = navigator.serviceWorker.controller || reg.active;
    if (sw) {
      sw.postMessage({
        type: 'SCHEDULE_NOTIFICATION',
        email: userParam,
        time,
        title,
        body,
        timing: 'mesmo_dia'
      });
      console.log(`[Scheduler] Agendamento enviado com sucesso para o Service Worker: ${time} para ${userParam}`);
    } else {
      console.warn('[Scheduler] Não há um service worker controlador pronto.');
    }

    // Automagically register background Push Subscription to guarantee sleep-proof notifications
    if (email) {
      const emailLower = email.toLowerCase().trim();
      subscribeUserToPush(emailLower).catch(err => console.warn('[Scheduler] Auto-push enrollment failed:', err));
      

    }

  } catch (error) {
    console.error('[Scheduler] Erro crítico no fluxo de agendamento de notificações:', error);
  }

  // Always boot up foreground memory fallback
  runLocalFallback(time, title, body);
}

function runLocalFallback(time: string, title: string, body: string) {
  if (fallbackTimeoutId) {
    clearTimeout(fallbackTimeoutId);
    fallbackTimeoutId = null;
  }

  const [cfgHour, cfgMin] = time.split(':').map(Number);
  if (isNaN(cfgHour) || isNaN(cfgMin)) return;

  const now = new Date();
  const target = new Date();
  target.setHours(cfgHour, cfgMin, 0, 0);

  // If time is already in past today, set for tomorrow
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  const delayMs = target.getTime() - now.getTime();
  console.log(`[Scheduler Fallback] Agendamento em primeiro plano ativo para daqui a ${Math.round(delayMs / 1000)} segundos`);

  if (delayMs > 0 && delayMs < 2147483647) {
    fallbackTimeoutId = setTimeout(() => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/icon.png'
        });
      } else {
        console.log(`[Notification Fallback Fired] ${title}: ${body}`);
      }
      // Stagger tomorrow's timer
      runLocalFallback(time, title, body);
    }, delayMs);
  }
}



/**
 * Registers the FCM token for the current user in Firestore.
 * This enables server-side notifications via Firebase Cloud Messaging.
 */
export async function registerFCMToken(userId: string): Promise<void> {
  try {
    if (typeof Notification === 'undefined') {
      console.warn('[FCM] Notification API is not supported in this browser.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[FCM] Notification permission denied.');
      return;
    }
    const token = await getFCMToken();
    if (!token) {
      console.warn('[FCM] Could not obtain FCM token.');
      return;
    }
    await setDoc(doc(db, 'usuarios', userId), {
      fcmToken: token,
    }, { merge: true });
    console.log('[FCM] Token registered successfully in usuarios collection for user:', userId);
  } catch (err) {
    console.error('[FCM] Failed to register token:', err);
  }
}
