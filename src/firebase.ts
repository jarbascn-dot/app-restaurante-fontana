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
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
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
                            swRegistration = await navigator.serviceWorker.register(
                                        '/firebase-messaging-sw.js',
                              { scope: '/' }
                                      );
                            await navigator.serviceWorker.ready;
                            console.log('[FCM] firebase-messaging-sw.js registered successfully.');
                  } catch (swErr) {
                            console.warn('[FCM] Could not register firebase-messaging-sw.js:', swErr);
                            // Fall back to whatever SW is already registered
                    swRegistration = await navigator.serviceWorker.ready;
                  }
          }

      const token = await getToken(messaging, {
              vapidKey,
              ...(swRegistration ? { serviceWorkerRegistration: swRegistration } : {}),
      });
          return token || null;
    } catch (err) {
          console.error('[FCM] Error getting token:', err);
          return null;
    }
}
