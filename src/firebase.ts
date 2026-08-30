/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// CRITICAL: The app will break without specifying firestoreDatabaseId
export const db = getFirestore(app);
export const auth = getAuth(app);

// Safely export messaging variable
export let messaging: any = null;

isSupported().then((supported) => {
  if (supported) {
    messaging = getMessaging(app);
  } else {
    console.warn('[FCM] Firebase Messaging is not supported in this browser/iframe environment.');
  }
}).catch((err) => {
  console.error('[FCM] Error checking messaging support:', err);
});

export async function getFCMToken(): Promise<string | null> {
  try {
    console.log('[FCM] Iniciando getFCMToken...');
    console.log('[FCM] Notification.permission:', typeof Notification !== 'undefined' ? Notification.permission : 'Notification API indisponível');
    console.log('[FCM] serviceWorker disponível:', 'serviceWorker' in navigator);

    const supported = await isSupported();
    console.log('[FCM] isSupported():', supported);
    if (!supported) {
      console.warn('[FCM] Firebase Messaging is not supported in this environment.');
      return null;
    }

    if (!messaging) {
      messaging = getMessaging(app);
    }

    const vapidKey = (import.meta as any).env.VITE_FIREBASE_VAPID_KEY || 'BJ5Vpn_NAv-fyxlgg6jmEvuYBieH8F1GVdVhs3gokWz3SBCu-gWMJPHFiGlFjWSljG_H2JZe6tGO9dSkQiTW77E';
    console.log('[FCM] VAPID key source:', (import.meta as any).env.VITE_FIREBASE_VAPID_KEY ? 'env var' : 'hardcoded fallback');
    console.log('[FCM] VAPID key length:', vapidKey?.length, '(deve ser 88)');
    if (!vapidKey) {
      console.warn('[FCM] VITE_FIREBASE_VAPID_KEY not set.');
      return null;
    }

    // Usa sw.js como service worker do FCM — ele já importa o Firebase Messaging
    // internamente (importScripts no topo), eliminando o conflito de escopo que havia
    // quando firebase-messaging-sw.js tentava competir com sw.js pelo scope '/'.
    let swRegistration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      try {
        const allRegs = await navigator.serviceWorker.getRegistrations();
        // Procura pelo sw.js (service worker principal do PWA, agora com FCM embutido)
        swRegistration = allRegs.find(r =>
          r.active?.scriptURL?.endsWith('/sw.js') ||
          r.installing?.scriptURL?.endsWith('/sw.js') ||
          r.waiting?.scriptURL?.endsWith('/sw.js')
        );

        if (swRegistration) {
          console.log('[FCM] sw.js encontrado. Estado:', swRegistration.active?.state || swRegistration.waiting?.state || 'installing');
        } else {
          // Fallback: registrar sw.js caso não exista ainda
          swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
          await navigator.serviceWorker.ready;
          console.log('[FCM] sw.js registrado como fallback');
        }
      } catch (swErr) {
        console.warn('[FCM] Aviso ao localizar sw.js:', swErr);
        swRegistration = undefined;
      }
    }

    const tokenOptions: { vapidKey: string; serviceWorkerRegistration?: ServiceWorkerRegistration } = { vapidKey };
    if (swRegistration) {
      tokenOptions.serviceWorkerRegistration = swRegistration;
    }

    console.log('[FCM] Chamando getToken com sw.js...');
    const token = await getToken(messaging, tokenOptions);
    if (!token) {
      console.warn('[FCM] getToken retornou token vazio — verifique VAPID key e permissao de notificacao.');
    } else {
      console.log('[FCM] Token obtido com sucesso! Primeiros 20 chars:', token.substring(0, 20) + '...');
    }
    return token || null;
  } catch (err) {
    console.error('[FCM] Error getting token:', err);
    return null;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Firestore connection on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase Connection verified successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration or network status.");
    } else {
      console.warn("Initial connection checked; database ready for transactions.");
    }
  }
}
testConnection();
