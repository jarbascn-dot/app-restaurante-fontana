// src/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

// ─── Inicialização Principal ───────────────────────────────────────────────
const app = initializeApp(firebaseConfig);

// CRÍTICO: firestoreDatabaseId vem do firebase-applet-config.json
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// ─── getFCMToken ───────────────────────────────────────────────────────────
// CORREÇÃO 1: Não exportamos `messaging` como variável global (evita race condition).
// CORREÇÃO 2: Instanciamos getMessaging() DENTRO da função, após verificar suporte.
// CORREÇÃO 3: Passamos serviceWorkerRegistration explicitamente para vincular o SW correto.
export async function getFCMToken(): Promise<string | null> {
  try {
    // Passo 1: verificar suporte do browser
    const supported = await isSupported();
    if (!supported) {
      console.warn('[FCM] Firebase Messaging não suportado neste browser/ambiente.');
      return null;
    }

    // Passo 2: verificar chave VAPID
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
    if (!vapidKey) {
      console.error('[FCM] VITE_FIREBASE_VAPID_KEY não está definida no .env');
      return null;
    }

    // Passo 3: obter instância do messaging (sem race condition)
    const messagingInstance = getMessaging(app);

    // Passo 4: registrar/recuperar o service worker CORRETO
    // CRÍTICO: O Firebase EXIGE que o SW se chame firebase-messaging-sw.js
    let swRegistration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      swRegistration = await navigator.serviceWorker.register(
        '/firebase-messaging-sw.js',
        { scope: '/' }
      );
      // Aguarda o SW ficar ativo antes de pedir token
      await navigator.serviceWorker.ready;
    }

    // Passo 5: solicitar o token passando o SW vinculado
    const token = await getToken(messagingInstance, {
      vapidKey,
      serviceWorkerRegistration: swRegistration,
    });

    if (!token) {
      console.warn('[FCM] getToken retornou vazio. Verifique a permissão de notificação e a chave VAPID.');
      return null;
    }

    console.log('[FCM] Token obtido com sucesso:', token.substring(0, 20) + '...');
    return token;

  } catch (err) {
    // Erro comum: usuário negou a permissão → não travar o app
    console.error('[FCM] Erro ao obter token:', err);
    return null;
  }
}

// ─── Tipos e helpers de erro do Firestore ─────────────────────────────────
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST   = 'list',
  GET    = 'get',
  WRITE  = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | null;
    email: string | null;
    emailVerified: boolean | null;
    isAnonymous: boolean | null;
    tenantId: string | null;
    providerInfo: { providerId: string | null; email: string | null }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId:        auth.currentUser?.uid         ?? null,
      email:         auth.currentUser?.email        ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous:   auth.currentUser?.isAnonymous   ?? null,
      tenantId:      auth.currentUser?.tenantId      ?? null,
      providerInfo:  auth.currentUser?.providerData.map(p => ({
        providerId: p.providerId,
        email: p.email,
      })) ?? [],
    },
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ─── Valida conexão Firestore no boot ─────────────────────────────────────
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase Connection verified successfully.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration or network status.');
    } else {
      console.warn('Initial connection checked; database ready for transactions.');
    }
  }
}
testConnection();
