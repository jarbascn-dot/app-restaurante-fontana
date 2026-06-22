/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { saveToFirestore } from './firebaseSync';
import { getMessagingInstance } from '../firebase';
import { getToken } from 'firebase/messaging';

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
/**
 * Register FCM token and save to Firestore.
 * This is the PRIMARY push mechanism that works even when app is fully closed on Android.
 * FCM token is sent server-side via Firebase Admin SDK (Netlify Function).
 */
export async function registerFCMToken(email: string): Promise<string | null> {
  try {
    const messaging = await getMessagingInstance();
    if (!messaging) {
      console.warn('[FCM] Firebase Messaging not supported on this browser/platform.');
      return null;
    }

    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[FCM] Notification permission denied.');
      return null;
    }

    // Get the FCM registration token
    // VAPID key from Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    const token = await getToken(messaging, { vapidKey });

    if (token) {
      // Save FCM token to Firestore so the server can send push notifications
      await saveToFirestore('fcm_tokens', { email, token, updatedAt: new Date().toISOString() }, email);
      console.log('[FCM] Token registered and saved:', token.substring(0, 20) + '...');
      return token;
    }
    return null;
  } catch (err) {
    console.error('[FCM] Error registering FCM token:', err);
    return null;
  }
}


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
  // PRIMARY: Register FCM token for server-side push (works when app is closed on Android)
  if (email) {
    registerFCMToken(email).catch(e => console.warn('[FCM] Token registration failed:', e));
  }

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
      subscribeUserToPush(email).catch(err => console.warn('[Scheduler] Auto-push enrollment failed:', err));
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
      if (Notification.permission === 'granted') {
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
