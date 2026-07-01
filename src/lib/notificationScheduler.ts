// src/lib/notificationScheduler.ts
import { getFCMToken, db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

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
 * Solicita permissao de notificacao, obtem o token FCM e salva no
 * documento do usuario em usuarios/{userId}.fcmToken
 *
 * CORRECOES CRITICAS:
 * - Usa Notification.requestPermission() explicitamente
 * - Salva na colecao 'usuarios' (nao numa subcollection separada)
 * - Usa setDoc com merge:true para nao sobrescrever outros campos
 */
export async function registerFCMToken(userId: string): Promise<void> {
    try {
          // 1. Verificar se o browser suporta notificacoes
      if (!('Notification' in window)) {
              console.warn('[FCM] Este browser nao suporta notificacoes.');
              return;
      }

      // 2. Pedir permissao EXPLICITAMENTE
      let permission = Notification.permission;
          if (permission === 'default') {
                  permission = await Notification.requestPermission();
          }

      if (permission !== 'granted') {
              console.warn('[FCM] Permissao de notificacao negada. Status:', permission);
              return;
      }

      console.log('[FCM] Permissao concedida! Obtendo token...');

      // 3. Obter token FCM (registra o SW correto internamente via firebase.ts)
      const token = await getFCMToken();

      if (!token) {
              console.warn('[FCM] Token nao obtido. Verifique a chave VAPID e o service worker.');
              return;
      }

      // 4. SALVAR TOKEN NO DOCUMENTO DO USUARIO EM 'usuarios/{userId}'
      const userDocRef = doc(db, 'usuarios', userId);
          await setDoc(userDocRef, {
                  fcmToken: token,
                  fcmTokenUpdatedAt: serverTimestamp(),
                  fcmTokenPlatform: /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios' : 'android',
          }, { merge: true });

      console.log('[FCM] Token salvo em usuarios/' + userId + ' com sucesso!');

    } catch (err) {
          console.error('[FCM] Erro ao registrar token FCM:', err);
    }
}

/**
 * Schedule a local notification at a given time.
 */
export async function scheduleNotification(
    title: string,
    body: string,
    scheduledTime: Date,
    data?: Record<string, string>
  ): Promise<void> {
    const now = new Date();
    const delay = scheduledTime.getTime() - now.getTime();

  if (delay <= 0) {
        console.warn('[Notification] Scheduled time is in the past. Skipping.');
        return;
  }

  if (fallbackTimeoutId) {
        clearTimeout(fallbackTimeoutId);
  }

  fallbackTimeoutId = setTimeout(async () => {
        try {
                if ('serviceWorker' in navigator && Notification.permission === 'granted') {
                          const registration = await navigator.serviceWorker.ready;
                          await registration.showNotification(title, {
                                      body,
                                      icon: '/icon.png',
                                      badge: '/icon-badge.svg',
                                      data: data || {},
                                      vibrate: [200, 100, 200],
                          });
                } else if (Notification.permission === 'granted') {
                          new Notification(title, { body, icon: '/icon.png' });
                }
        } catch (err) {
                console.error('[Notification] Erro ao exibir notificacao agendada:', err);
        }
  }, delay);

  console.log('[Notification] Notificacao agendada para:', scheduledTime.toISOString());
}
