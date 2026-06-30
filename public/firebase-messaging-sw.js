importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Force immediate SW activation so new deploys take effect right away
self.addEventListener('install', (event) => {
                self.skipWaiting();
});

self.addEventListener('activate', (event) => {
                event.waitUntil(self.clients.claim());
});

firebase.initializeApp({
                apiKey: "AIzaSyARWM_Q2Anq30Cg86Zn15wptXcL7puZDN0",
                authDomain: "meu-app-producao-af69c.firebaseapp.com",
                projectId: "meu-app-producao-af69c",
                storageBucket: "meu-app-producao-af69c.firebasestorage.app",
                messagingSenderId: "71368810560",
                appId: "1:71368810560:web:355778665842c20be3b5ac"
});

const messaging = firebase.messaging();

// Handle background messages from FCM (app closed or in background)
// This is the ONLY reliable way to deliver notifications when app is closed on Android
messaging.onBackgroundMessage((payload) => {
                console.log('[firebase-messaging-sw] Received background message:', payload);

                                      const notificationTitle = (payload.notification && payload.notification.title)
                    ? payload.notification.title
                                                          : (payload.data && payload.data.title)
                    ? payload.data.title
                                                          : 'SGR FONTANA';

                                      const notificationBody = (payload.notification && payload.notification.body)
                    ? payload.notification.body
                                                          : (payload.data && payload.data.body)
                    ? payload.data.body
                                                          : 'Lembrete de refeição';

                                      const notificationIcon = (payload.notification && payload.notification.icon)
                    ? payload.notification.icon
                                                          : '/icon.png';

                                      const notificationOptions = {
                                                              body: notificationBody,
                                                              icon: notificationIcon,
                                                              badge: '/icon-badge.svg',
                                                              vibrate: [0, 200, 100, 200],
                                                              tag: 'sgr-fcm-notification',
                                                              renotify: true,
                                                              requireInteraction: false,
                                                              actions: [
                                                                      { action: 'reserve', title: 'Confirmar Almoco' },
                                                                      { action: 'view_menu', title: 'Ver Cardapio' }
                                                                                              ],
                                      };

                                      return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
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
                                                                                                                                                    for (let i = 0; i < clientList.length; i++) { if (clientList[i].focused) { client = clientList[i]; break; } }
                                                                                                                                                    if (typeof client.navigate === 'function') client.navigate(url);
                                                                                                                                                    return client.focus();
                                                                                                }
                                                                                        return clients.openWindow(url);
                                            })
                                        );
});

// =====================================================
// LOCAL ALARM FALLBACK (handles SCHEDULE_NOTIFICATION messages)
// NOTE: This only works when app is OPEN or BACKGROUNDED.
// When app is CLOSED on Android, notifications come ONLY via FCM server-side push.
// =====================================================

const DB_NAME = 'sgr-notifications-db';
const STORE_NAME = 'alarms';

function openAlarmDB() {
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

async function saveAlarm(email, alarmData) {
                  try {
                                              const db = await openAlarmDB();
                                              const tx = db.transaction(STORE_NAME, 'readwrite');
                                              const store = tx.objectStore(STORE_NAME);
                                              store.put(alarmData, email);
                                              return new Promise((resolve) => { tx.oncomplete = () => resolve(); });
                  } catch (err) {
                                              console.error('[FCM-SW DB] Error saving alarm:', err);
                  }
}

async function getAllAlarms() {
                  try {
                                              const db = await openAlarmDB();
                                              const tx = db.transaction(STORE_NAME, 'readonly');
                                              const store = tx.objectStore(STORE_NAME);
                                              const request = store.openCursor();
                                              const alarms = [];
                                              return new Promise((resolve) => {
                                                                                          request.onsuccess = (e) => {
                                                                                                                                                      const cursor = e.target.result;
                                                                                                                                                      if (cursor) { alarms.push({ email: cursor.key, ...cursor.value }); cursor.continue(); }
                                                                                                                                                      else { resolve(alarms); }
                                                                                                  };
                                                                                          request.onerror = () => resolve([]);
                                              });
                  } catch (err) {
                                              return [];
                  }
}

let alarmsCache = {};

self.addEventListener('message', (event) => {
                  const data = event.data;
                  if (data && data.type === 'SCHEDULE_NOTIFICATION') {
                                              const { email, time, title, body, timing } = data;
                                              if (!email) return;
                                              const alarmData = { time, title, body, timing, lastChecked: null };
                                              alarmsCache[email] = alarmData;
                                              if (event.waitUntil) event.waitUntil(saveAlarm(email, alarmData));
                                              else saveAlarm(email, alarmData);
                                              console.log('[FCM-SW] Local alarm scheduled for ' + email + ' at ' + time);
                  }
});

async function checkAlarms() {
                  const now = new Date();
                  const currentHour = now.getHours();
                  const currentMinute = now.getMinutes();
                  const today = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
                  const persistedAlarms = await getAllAlarms();
                  for (const alarm of persistedAlarms) {
                                              if (!alarmsCache[alarm.email]) { alarmsCache[alarm.email] = alarm; }
                  }
                  for (const email of Object.keys(alarmsCache)) {
                                              const alarm = alarmsCache[email];
                                              if (!alarm.time) continue;
                                              const parts = alarm.time.split(':');
                                              const alarmHour = Number(parts[0]);
                                              const alarmMin = Number(parts[1]);
                                              if (isNaN(alarmHour) || isNaN(alarmMin)) continue;
                                              if (currentHour === alarmHour && currentMinute === alarmMin) {
                                                                                          const db = await openAlarmDB();
                                                                                          const tx = db.transaction(STORE_NAME, 'readwrite');
                                                                                          const store = tx.objectStore(STORE_NAME);
                                                                                          const existing = await new Promise((resolve) => {
                                                                                                                                                      const req = store.get(email);
                                                                                                                                                      req.onsuccess = () => resolve(req.result);
                                                                                                                                                      req.onerror = () => resolve(null);
                                                                                                  });
                                                                                          if (existing && existing.lastAlertDate === today) continue;
                                                                                          const updated = Object.assign({}, alarm, { lastAlertDate: today });
                                                                                          alarmsCache[email] = updated;
                                                                                          await saveAlarm(email, updated);
                                                                                          self.registration.showNotification(alarm.title || 'SGR FONTANA', {
                                                                                                                                                      body: alarm.body || 'Lembrete de refeicao!',
                                                                                                                                                      icon: '/icon.png',
                                                                                                                                                      badge: '/icon-badge.svg',
                                                                                                                                                      vibrate: [0, 200, 100, 200],
                                                                                                                                                      tag: 'sgr-local-alert-' + email,
                                                                                                                                                      renotify: true
                                                                                                  });
                                                                                          console.log('[FCM-SW] Local alarm fired for ' + email);
                                              }
                  }
}

// Only run setInterval fallback when SW is alive (app open/backgrounded)
// For closed app, FCM server-side push handles notifications
setInterval(checkAlarms, 15000);

self.addEventListener('periodicsync', (event) => {
                  if (event.tag === 'check-meal-alerts') {
                                              event.waitUntil(checkAlarms());
                  }
});
