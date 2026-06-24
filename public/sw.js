// ============================================================
// Firebase Cloud Messaging (FCM) - Receber notificações push
// ============================================================
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Configuração do Firebase (novo projeto meu-app-producao)
const firebaseConfig = {
    apiKey: 'AIzaSyARWM_Q2Anq30Cg86Zn15wptXcL7puZDN0',
    authDomain: 'meu-app-producao-af69c.firebaseapp.com',
    projectId: 'meu-app-producao-af69c',
    storageBucket: 'meu-app-producao-af69c.firebasestorage.app',
    messagingSenderId: '71368810560',
    appId: '1:71368810560:web:3557786658420f9f50ffa5',
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Recebe notificações quando o app está em segundo plano
messaging.onBackgroundMessage(function(payload) {
    console.log('[sw.js] Notificação recebida em segundo plano:', payload);
  
    const notificationTitle = payload.notification?.title || 'Lembrete';
    const notificationOptions = {
          body: payload.notification?.body || 'Você tem um novo lembrete!',
          icon: '/icon.png',
          badge: '/icon-badge.svg',
          data: payload.data,
          requireInteraction: true,
    };
  
    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Ao clicar na notificação, abre o app
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
          clients.openWindow('/')
        );
});

// ============================================================
// Código original do Service Worker (abaixo)
// ============================================================

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

// Listener for push event
self.addEventListener('push', (event) => {
  let payload = { title: 'SGR FONTANA', body: 'Lembrete de Marmitas' };
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = { title: 'SGR FONTANA', body: event.data.text() };
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon.png',
      badge: '/icon-badge.svg',
      vibrate: [0, 200, 100, 200], // Snappy WhatsApp-style double rumble
      tag: 'sgr-push-notification',
      renotify: true,
      actions: [
        { action: 'reserve', title: '✅ Confirmar Almoço' },
        { action: 'view_menu', title: '📋 Ver Cardápio' }
      ]
    })
  );
});

// Click action and button handling for high PWA engagement
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  let targetUrl = '/';
  if (event.action === 'reserve') {
    targetUrl = '/?action=confirm-lunch';
  } else if (event.action === 'view_menu') {
    targetUrl = '/?action=view-menu';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Find browser clients that are already open and focus them
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
            break;
          }
        }
        
        // Post current action parameter to open frame so page can act programmatically
        if (typeof client.navigate === 'function') {
          client.navigate(targetUrl);
        }
        return client.focus();
      }
      // If closed, boot a fresh standalone app frame on the requested action
      return clients.openWindow(targetUrl);
    })
  );
});

// Alarm state in memory
let activeAlarms = {};

// Handle incoming messages
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === 'SCHEDULE_NOTIFICATION') {
    const { email, time, title, body, timing } = data;
    if (!email) return;

    const alarmData = { time, title, body, timing, lastChecked: null };
    activeAlarms[email] = alarmData;
    
    // Save to IndexedDB so it survives SW restarts!
    event.waitUntil(saveAlarm(email, alarmData));

    console.log(`[SW] Alerta agendado para o e-mail ${email} às ${time} (${timing})`);
  }
});

// Run a check interval to verify scheduled notifications
async function checkAlarms() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const todayStr = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();

  // Load from IndexedDB to memory if not loaded
  const savedAlarms = await getAllAlarms();
  for (const alarm of savedAlarms) {
    if (!activeAlarms[alarm.email]) {
      activeAlarms[alarm.email] = alarm;
    }
  }

  for (const email of Object.keys(activeAlarms)) {
    const alarm = activeAlarms[email];
    if (!alarm.time) continue;

    const [cfgHour, cfgMin] = alarm.time.split(':').map(Number);
    if (isNaN(cfgHour) || isNaN(cfgMin)) continue;

    // Is it time?
    if (currentHour === cfgHour && currentMin === cfgMin) {
      // Check if we already alerted today
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      const dbAlarm = await new Promise((res) => {
        const req = store.get(email);
        req.onsuccess = () => res(req.result);
        req.onerror = () => res(null);
      });

      if (dbAlarm && dbAlarm.lastAlertDate === todayStr) {
        // Already alerted today
        continue;
      }

      // Record alert
      const updatedAlarm = { ...alarm, lastAlertDate: todayStr };
      activeAlarms[email] = updatedAlarm;
      await saveAlarm(email, updatedAlarm);

      // Trigger actual notification banner
      self.registration.showNotification(alarm.title || 'SGR FONTANA', {
        body: alarm.body || 'Lembrete de refeição para amanhã!',
        icon: '/icon.png',
        badge: '/icon-badge.svg',
        vibrate: [0, 200, 100, 200], // Snappy WhatsApp-style double rumble
        tag: `sgr-ref-alert-${email}`,
        renotify: true,
        actions: [
          { action: 'reserve', title: '✅ Confirmar Almoço' },
          { action: 'view_menu', title: '📋 Ver Cardápio' }
        ]
      });
      
      console.log(`[SW] Alerta disparado com sucesso para ${email}!`);
    }
  }
}

// Run loop every 15 seconds so we don't miss the exact minute!
setInterval(checkAlarms, 15000);

// Also try periodicsync if supported
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-meal-alerts') {
    event.waitUntil(checkAlarms());
  }
});
