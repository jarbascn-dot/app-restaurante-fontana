/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * sw.js — Local alarm fallback Service Worker
 *
 * Handles local (in-browser) alarm scheduling via IndexedDB and setInterval.
 * Push notifications when the app is CLOSED are handled by firebase-messaging-sw.js (FCM).
 * This SW handles the SCHEDULE_NOTIFICATION message from the app and fires
 * local Notification API alerts as a fallback when the app is open/backgrounded.
 */

const DB_NAME = 'sgr-notifications-db';
const STORE_NAME = 'alarms';

// Helper to open/init IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
          const request = indexedDB.open(DB_NAME, 1);
          request.onupgradeneeded = (e) => {
                  const db = e.target.result;
                  if (!db.objectStoreNames.contains(STORE_NAME)) {
                            db.createObjectStore(STORE_NAME);
                  }
          };
          request.onsuccess = (e) => resolve(e.target.result);
          request.onerror = (e) => reject(e.target.error);
    });
}

// Save alarm to IDB
async function saveAlarm(email, alarmData) {
    try {
          const db = await openDB();
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.put(alarmData, email);
          return new Promise((resolve) => {
                  tx.oncomplete = () => resolve();
          });
    } catch (err) {
          console.error('[SW DB] Error saving alarm:', err);
    }
}

// Get all alarms from IDB
async function getAllAlarms() {
    try {
          const db = await openDB();
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const request = store.openCursor();
          const alarms = [];
          return new Promise((resolve) => {
                  request.onsuccess = (e) => {
                            const cursor = e.target.result;
                            if (cursor) {
                                        alarms.push({ email: cursor.key, ...cursor.value });
                                        cursor.continue();
                            } else {
                                        resolve(alarms);
                            }
                  };
                  request.onerror = () => resolve([]);
          });
    } catch (err) {
          console.error('[SW DB] Error getting alarms:', err);
          return [];
    }
}

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// NOTE: Push events from FCM are handled by firebase-messaging-sw.js
// This SW intentionally does NOT handle the 'push' event to avoid conflicts.

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    let url = '/';
    if (event.action === 'reserve') {
          url = '/?action=confirm-lunch';
    } else if (event.action === 'view_menu') {
          url = '/?action=view-menu';
    }
    event.waitUntil(
          clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
                  if (clientList.length > 0) {
                            let client = clientList[0];
                            for (let i = 0; i < clientList.length; i++) {
                                        if (clientList[i].focused) { client = clientList[i]; break; }
                            }
                            if (typeof client.navigate === 'function') client.navigate(url);
                            return client.focus();
                  }
                  return clients.openWindow(url);
          })
        );
});

// In-memory alarm cache
let alarmsCache = {};

self.addEventListener('message', (event) => {
    const data = event.data;
    if (data && data.type === 'SCHEDULE_NOTIFICATION') {
          const { email, time, title, body, timing } = data;
          if (!email) return;
          const alarmData = { time, title, body, timing, lastChecked: null };
          alarmsCache[email] = alarmData;
          event.waitUntil(saveAlarm(email, alarmData));
          console.log(`[SW] Alerta agendado para o e-mail ${email} às ${time} (${timing})`);
    }
});

// Local alarm check — runs every 15 seconds as fallback when app is open
async function checkAlarms() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

  // Merge persisted alarms into cache
  const persistedAlarms = await getAllAlarms();
    for (const alarm of persistedAlarms) {
          if (!alarmsCache[alarm.email]) {
                  alarmsCache[alarm.email] = alarm;
          }
    }

  for (const email of Object.keys(alarmsCache)) {
        const alarm = alarmsCache[email];
        if (!alarm.time) continue;
        const [alarmHour, alarmMin] = alarm.time.split(':').map(Number);
        if (isNaN(alarmHour) || isNaN(alarmMin)) continue;

      if (currentHour === alarmHour && currentMinute === alarmMin) {
              // Avoid duplicate notifications for same day
          const db = await openDB();
              const tx = db.transaction(STORE_NAME, 'readwrite');
              const store = tx.objectStore(STORE_NAME);
              const existing = await new Promise((resolve) => {
                        const req = store.get(email);
                        req.onsuccess = () => resolve(req.result);
                        req.onerror = () => resolve(null);
              });

          if (existing && existing.lastAlertDate === today) continue;

          // Update lastAlertDate to prevent duplicates
          const updated = { ...alarm, lastAlertDate: today };
              alarmsCache[email] = updated;
              await saveAlarm(email, updated);

          self.registration.showNotification(alarm.title || 'SGR FONTANA', {
                    body: alarm.body || 'Lembrete de refeição para amanhã!',
                    icon: '/icon.png',
                    badge: '/icon-badge.svg',
                    vibrate: [0, 200, 100, 200],
                    tag: `sgr-local-alert-${email}`,
                    renotify: true,
                    actions: [
                      { action: 'reserve', title: '✅ Confirmar Almoço' },
                      { action: 'view_menu', title: '📋 Ver Cardápio' }
                              ]
          });
              console.log(`[SW] Alerta local disparado com sucesso para ${email}!`);
      }
  }
}

setInterval(checkAlarms, 15000);

self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'check-meal-alerts') {
          event.waitUntil(checkAlarms());
    }
});
