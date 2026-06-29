/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// CRITICAL: The app will break without specifying firestoreDatabaseId
// Use type assertion to access firestoreDatabaseId safely (may not be in JSON)
const cfg = firebaseConfig as any;
export const db = cfg.firestoreDatabaseId
  ? getFirestore(app, cfg.firestoreDatabaseId)
    : getFirestore(app);
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

/**
 * Waits for a ServiceWorkerRegistration's SW to become active.
 * Handles installing/waiting states so getToken() always gets an active SW.
 */
async function waitForSWActive(registration: ServiceWorkerRegistration): Promise<ServiceWorkerRegistration> {
    const sw = registration.installing || registration.waiting;
    if (!sw) return registration; // already active
  return new Promise((resolve) => {
        sw.addEventListener('statechange', function handler() {
                if (sw.state === 'activated') {
                          sw.removeEventListener('statechange', handler);
                          resolve(registration);
                }
        });
  });
}

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
          const vapidKey = (import.meta as any).env.VITE_FIREBASE_VAPID_KEY;
          if (!vapidKey) {
                  console.warn('[FCM] VITE_FIREBASE_VAPID_KEY not set.');
                  return null;
          }

      // Register the Firebase Messaging SW explicitly so FCM can deliver
      // push notifications even when the app is closed/in background.
      let swRegistration: ServiceWorkerRegistration | undefined;
          if ('serviceWorker' in navigator) {
                  try {
                            const reg = await navigator.serviceWorker.register(
                                        '/firebase-messaging-sw.js',
                              { scope: '/' }
                                      );
                            // Wait for the SW to become fully active before calling getToken()
                    swRegistration = await waitForSWActive(reg);
                            console.log('[FCM] firebase-messaging-sw.js registered and active.');
                  } catch (swErr) {
                            console.warn('[FCM] Could not register firebase-messaging-sw.js:', swErr);
                            // Fall back to whatever SW is currently active
                    swRegistration = await navigator.serviceWorker.ready;
                  }
          }

      const token = await getToken(messaging, {
              vapidKey,
              ...(swRegistration ? { serviceWorkerRegistration: swRegistration } : {}),
      });
          if (token) {
                  console.log('[FCM] Token obtained successfully.');
          } else {
                  console.warn('[FCM] getToken returned empty — check notification permission and VAPID key.');
          }
          return token || null;
    } catch (err) {
          console.error('[FCM] Error getting token:', err);
          return null;
    }
}

// OperationType enum used by firebaseSync.ts for error handling
export enum OperationType {
    READ = 'READ',
    WRITE = 'WRITE',
    DELETE = 'DELETE',
    BATCH = 'BATCH',
}

// Centralized Firestore error handler used by firebaseSync.ts
export function handleFirestoreError(err: unknown, operation: OperationType, path: string): void {
    console.error(`[Firestore] Error during ${operation} at ${path}:`, err);
    throw err;
}
