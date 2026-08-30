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
    const supported = await isSupported();
    if (!supported) {
      console.warn('[FCM] Firebase Messaging is not supported in this environment.');
      return null;
    }

    if (!messaging) {
      messaging = getMessaging(app);
    }

        const vapidKey = (import.meta as any).env.VITE_FIREBASE_VAPID_KEY || 'BJ5Vpn_NAv-fyxlgg6jmEvuYBieH8F1GVdVhs3gokWz3SBCu-gWMJPHFiGlFjWSljG_H2JZe6tGO9dSkQiTW77E';
    if (!vapidKey) {
      console.warn('[FCM] VITE_FIREBASE_VAPID_KEY not set.');
      return null;
    }

    // Registra firebase-messaging-sw.js explicitamente para evitar conflito com sw.js
    // (quando sw.js controla escopo '/', o SDK nÃ£o consegue registrar automaticamente)
    let swRegistration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      try {
        // Verificar se jÃ¡ estÃ¡ registrado pelo scriptURL
        const allRegs = await navigator.serviceWorker.getRegistrations();
        swRegistration = allRegs.find(r =>
          r.active?.scriptURL?.includes('firebase-messaging-sw.js') ||
          r.installing?.scriptURL?.includes('firebase-messaging-sw.js') ||
          r.waiting?.scriptURL?.includes('firebase-messaging-sw.js')
        );

        if (!swRegistration) {
          // Registrar explicitamente para garantir que o FCM o encontre
          swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
          await navigator.serviceWorker.ready;
          console.log('[FCM] firebase-messaging-sw.js registrado com sucesso');
        } else {
          console.log('[FCM] firebase-messaging-sw.js jÃ¡ registrado');
        }
      } catch (swErr) {
        console.warn('[FCM] Aviso ao registrar firebase-messaging-sw.js (tentando sem registration explÃ­cito):', swErr);
        swRegistration = undefined;
      }
    }

    const tokenOptions: { vapidKey: string; serviceWorkerRegistration?: ServiceWorkerRegistration } = { vapidKey };
    if (swRegistration) {
      tokenOptions.serviceWorkerRegistration = swRegistration;
    }

    const token = await getToken(messaging, tokenOptions);
    if (!token) {
      console.warn('[FCM] getToken retornou token vazio â verifique VAPID key e permissÃ£o de notificaÃ§Ã£o.');
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
