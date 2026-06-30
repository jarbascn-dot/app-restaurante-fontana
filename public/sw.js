/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * sw.js — STUB: This service worker self-unregisters to allow
 * firebase-messaging-sw.js to be the sole SW controlling scope /.
 * All FCM push notifications (including app-closed on Android) are
 * handled exclusively by firebase-messaging-sw.js.
 */

self.addEventListener('install', () => {
      // Skip waiting so this stub activates immediately and can unregister
                        self.skipWaiting();
});

self.addEventListener('activate', (event) => {
      // Unregister this SW so firebase-messaging-sw.js can take full control
                        event.waitUntil(
                                self.registration.unregister().then(() => {
                                          console.log('[sw.js stub] Unregistered old sw.js — firebase-messaging-sw.js will handle all push notifications.');
                                          return self.clients.claim();
                                })
                              );
});
