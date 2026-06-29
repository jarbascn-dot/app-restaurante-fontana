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

// VAPID public key for Web Push (safe to include in client code - this is a public key)
const VAPID_KEY = 'BJ5Vpn_NAv-fyxlgg6jmEvuYBieH8F1GVdVhs3gokWz3SBCu-gWMJPHFiGIFjWSIjG_H2JZe6tGO9dSkQiTW77E';

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

      // Use hardcoded VAPID key (public key, safe for client) as fallback to env var
      const vapidKey = (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY || VAPID_KEY;
          if (!vapidKey) {
                  console.warn('[FCM] No VAPID key available.');
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

              console.log('[FCM] SW ready. Attempting getToken() with retry...');
              for (let attempt = 1; attempt <= 3; attempt++) {
                          try {
                                        console.log('[FCM] getToken() attempt', attempt, 'of 3');
                                        const token = await getToken(messaging, {
                                                        vapidKey,
                                                        ...(swRegistration ? { serviceWorkerRegistration: swRegistration } : {}),
                                        });
                                        if (token) {
                                                        console.log('[FCM] Token obtained on attempt', attempt, ':', token.substring(0, 20) + '...');
                                                        return token;
                                        }
                                        console.warn('[FCM] getToken() returned empty on attempt', attempt);
                          } catch (tokenErr: any) {
                                        console.error('[FCM] getToken() threw on attempt', attempt,
                                                                    '- code:', tokenErr?.code, '- msg:', tokenErr?.message, tokenErr);
                          }
                          if (attempt < 3) {
                                        console.log('[FCM] Retrying in', attempt * 2000, 'ms...');
                                        await new Promise(r => setTimeout(r, attempt * 2000));
                          }
              }
              console.warn('[FCM] All getToken() attempts failed.');
              return null;
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
