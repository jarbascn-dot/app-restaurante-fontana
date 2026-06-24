/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
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
                    return new Promise((resolve) => {
                                    tx.oncomplete = () => resolve();
                    });
        } catch (error) {
                    console.error('[SW] Error saving alarm:', error);
        }
}

// Get all alarms for an email
async function getAlarms(email) {
        try {
                    const db = await openDB();
                    const tx = db.transaction(STORE_NAME, 'readonly');
                    const store = tx.objectStore(STORE_NAME);
                    return new Promise((resolve, reject) => {
                                    const request = store.get(email);
                                    request.onsuccess = () => resolve(request.result || []);
                                    request.onerror = () => reject(request.error);
                    });
        } catch (error) {
                    console.error('[SW] Error getting alarms:', error);
                    return [];
        }
}

// Delete alarm
async function deleteAlarm(email, alarmId) {
        try {
                    const db = await openDB();
                    const alarms = await getAlarms(email);
                    const updated = alarms.filter(a => a.id !== alarmId);
                    const tx = db.transaction(STORE_NAME, 'readwrite');
                    const store = tx.objectStore(STORE_NAME);
                    store.put(updated, email);
        } catch (error) {
                    console.error('[SW] Error deleting alarm:', error);
        }
}

// Show notification
async function showNotification(title, options) {
        return self.registration.showNotification(title, options);
}

// Check and fire due alarms
async function checkAlarms() {
        // This function is kept for backward compatibility
    // Notifications are now handled via FCM
}

// Message handler
self.addEventListener('message', async (event) => {
        const { type, payload } = event.data || {};

                          if (type === 'SAVE_ALARM') {
                                      const { email, alarm } = payload;
                                      await saveAlarm(email, alarm);
                          } else if (type === 'DELETE_ALARM') {
                                      const { email, alarmId } = payload;
                                      await deleteAlarm(email, alarmId);
                          } else if (type === 'CHECK_ALARMS') {
                                      await checkAlarms();
                          }
});

// Periodic sync for checking alarms
self.addEventListener('periodicsync', (event) => {
        if (event.tag === 'check-alarms') {
                    event.waitUntil(checkAlarms());
        }
});

// Push notification handler (for FCM via firebase-messaging-sw.js)
self.addEventListener('push', (event) => {
        if (!event.data) return;
        try {
                    const data = event.data.json();
                    const title = data.notification?.title || 'Notificacao';
                    const options = {
                                    body: data.notification?.body || '',
                                    icon: '/icon.png',
                                    badge: '/icon-badge.svg',
                    };
                    event.waitUntil(self.registration.showNotification(title, options));
        } catch (e) {
                    console.error('[SW] Error handling push:', e);
        }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
        event.notification.close();
        event.waitUntil(clients.openWindow('/'));
});

// Install and activate
self.addEventListener('install', (event) => {
        self.skipWaiting();
});

self.addEventListener('activate', (event) => {
        event.waitUntil(clients.claim());
});
