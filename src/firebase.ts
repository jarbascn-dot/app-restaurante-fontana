/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, setDoc } from 'firebase/firestore';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// CRITICAL: The app will break without specifying firestoreDatabaseId
export const db = getFirestore(app);
export const auth = getAuth(app);

// Safely export messaging variable
export let messaging: any = null;

const VAPID_KEY =
  (import.meta as any).env.VITE_FIREBASE_VAPID_KEY ||
  'BJI2YT90BjLY_yl1rnUvRXwngj2hLpNZzLLI6VoEIDBSGdIzKhSNYKbeLmBWAJ5h-Ja1_BZ4F52Ga-PnbuSzkWw';

export async function initMessaging(): Promise<any | null> {
  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn('[FCM] Firebase Messaging nao suportado neste ambiente.');
      return null;
    }
    if (!messaging) {
      messaging = getMessaging(app);
    }
    return messaging;
  } catch (err) {
    console.error('[FCM] Erro ao inicializar messaging:', err);
    return null;
  }
}

async function saveTokenToFirestore(token: string, userEmail: string): Promise<void> {
  // Salva em usuarios/{email}
  await setDoc(
    doc(db, 'usuarios', userEmail),
    { fcmToken: token, fcmTokenUpdatedAt: new Date().toISOString() },
    { merge: true }
  );

  // Salva em fcmTokens/{sanitized_email} para o send-notifications.ts
  const fcmDocId = userEmail.toLowerCase().trim().replace(/[^a-zA-Z0-9]/g, '_');
  await setDoc(
    doc(db, 'fcmTokens', fcmDocId),
    { token, userId: userEmail, updatedAt: new Date().toISOString() },
    { merge: true }
  );

  console.log('[FCM] Token salvo em usuarios e fcmTokens para:', userEmail);
}

export async function getFCMToken(userEmail?: string): Promise<string | null> {
  try {
    // Verificar se o ambiente suporta notificações e se a permissão foi concedida ou bloqueada
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'denied') {
        console.info('[FCM] Permissão de notificação bloqueada no navegador pelo usuário.');
        return null;
      }
      if (Notification.permission === 'default') {
        console.info('[FCM] Permissão de notificação ainda não solicitada/concedida pelo usuário.');
        return null;
      }
    }

    const msg = await initMessaging();
    if (!msg) return null;
    if (!VAPID_KEY) {
      console.warn('[FCM] VITE_FIREBASE_VAPID_KEY nao configurado.');
      return null;
    }

    const token = await getToken(msg, { vapidKey: VAPID_KEY });
    if (!token) {
      console.warn('[FCM] Token FCM nao obtido - verifique permissoes e o firebase-messaging-sw.js.');
      return null;
    }

    if (userEmail) {
      await saveTokenToFirestore(token, userEmail);
    }
    return token;
  } catch (err: any) {
    // Tratamento suave se a permissão foi bloqueada pelo navegador
    if (
      err?.code === 'messaging/permission-blocked' ||
      err?.code === 'messaging/permission-default' ||
      err?.message?.includes('permission-blocked') ||
      err?.message?.includes('permission was not granted')
    ) {
      console.info('[FCM] Permissão de notificação não concedida ou bloqueada.');
      return null;
    }

    // Se a subscricao existente usa uma VAPID key diferente, limpa e tenta novamente
    if (err?.name === 'InvalidAccessError' || err?.message?.includes('applicationServerKey')) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          console.log('[FCM] Subscricao antiga removida, tentando novamente...');
        }
        const msg2 = await initMessaging();
        if (!msg2) return null;
        const token = await getToken(msg2, { vapidKey: VAPID_KEY });
        if (!token) return null;
        if (userEmail) {
          await saveTokenToFirestore(token, userEmail);
        }
        return token;
      } catch (retryErr) {
        console.error('[FCM] Erro ao retentar apos limpar subscricao:', retryErr);
      }
    }
    console.warn('[FCM] Aviso ao obter token:', err?.message || err);
    return null;
  }
}

export async function setupTokenRefreshListener(userEmail: string): Promise<void> {
  const msg = await initMessaging();
  if (!msg) return;
  await getFCMToken(userEmail);
  onMessage(msg, (payload) => {
    console.log('[FCM] Mensagem recebida em foreground:', payload);
  });
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
