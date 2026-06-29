importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

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
                                      actions: [
                                        { action: 'reserve', title: '✅ Confirmar Almoço' },
                                        { action: 'view_menu', title: '📋 Ver Cardápio' }
                                            ]
                                };

                                self.registration.showNotification(notificationTitle, notificationOptions);
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
