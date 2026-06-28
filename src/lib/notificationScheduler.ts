/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { saveToFirestore } from './firebaseSync';
import { getFCMToken, db } from '../firebase';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

let fallbackTimeoutId: ReturnType<typeof setTimeout> | null = null;

/**
 * Saves or updates the daily notification schedule in Firestore notificationQueue.
 */
async function saveNotificationSchedule(
  userId: string,
  time: string,
  title: string,
  body: string,
  link?: string
): Promise<void> {
  try {
    const docId = `daily_${userId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    await setDoc(doc(db, 'notificationQueue', docId), {
      userId,
      title,
      body,
      link: link || '/',
      scheduledTime: time,
      sent: false,
      daily: true,
      updatedAt: serverTimestamp(),
    });
    console.log(`[FCM Queue] Lembrete diário salvo no Firestore para ${userId} às ${time}`);
  } catch (err) {
    console.error('[FCM Queue] Erro ao salvar lembrete no Firestore:', err);
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
    const pushSub = {
      id: `sub-${email.replace(/[^a-zA-Z0-9]/g, '-')}`,
      email,
      endpoint: rawSub.endpoint,
      keys: { p256dh: rawSub.keys.p256dh, auth: rawSub.keys.auth },
      updatedAt: new Date().toISOString()
    };
    await saveToFirestore('push_subscriptions', pushSub);
    console.log('[Push Service] Device subscribed and synced with Firestore:', pushSub);
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
    console.warn('[Scheduler] Service Workers ou Notifications não são totalmente suportados por esta plataforma.');
    runLocalFallback(time, title, body);
    return;
  }

  try {
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
      console.warn('[Scheduler] Permissão para notificações negada:', permission);
      return;
    }

    const reg = await navigator.serviceWorker.register('/sw.js');
    if (!reg) console.warn('[Scheduler] Falha ao registrar o service worker.');

    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
      });
    }

    const sw = navigator.serviceWorker.controller;
    if (sw) {
      sw.postMessage({ type: 'SCHEDULE_NOTIFICATION', email: userParam, time, title, body, timing: 'mesmo_dia' });
      console.log(`[Scheduler] Agendamento enviado para o Service Worker: ${time} para ${userParam}`);
    }

    // Salvar no Firestore para o cron funcionar com app fechado
    if (email) {
      await saveNotificationSchedule(email, time, title, body, '/');
      await registerFCMToken(email);
    }

  } catch (error) {
    console.error('[Scheduler] Erro crítico no fluxo de agendamento:', error);
  }

  runLocalFallback(time, title, body);
}

function runLocalFallback(time: string, title: string, body: string) {
  if (fallbackTimeoutId) { clearTimeout(fallbackTimeoutId); fallbackTimeoutId = null; }
  const [cfgHour, cfgMin] = time.split(':').map(Number);
  if (isNaN(cfgHour) || isNaN(cfgMin)) return;
  const now = new Date();
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

export async function registerFCMToken(userId: string): Promise<void> {
  try {
    const permission = Notification.permission;
    if (permission !== 'granted') { console.warn('[FCM] Notification permission denied.'); return; }
    const token = await getFCMToken();
    if (!token) { console.warn('[FCM] Could not obtain FCM token.'); return; }
    await setDoc(doc(db, 'fcmTokens', userId), { token, userId, updatedAt: serverTimestamp() });
    console.log('[FCM] Token registered successfully for user:', userId);
  } catch (err) {
    console.error('[FCM] Failed to register token:', err);
  }
}
