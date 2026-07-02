// Import standard Firebase compatibility scripts for Service Workers
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker
firebase.initializeApp({
    apiKey: "AIzaSyARWM_Q2Anq30Cg86Zn15wptXcL7puZDN0",
    authDomain: "meu-app-producao-af69c.firebaseapp.com",
    projectId: "meu-app-producao-af69c",
    storageBucket: "meu-app-producao-af69c.firebasestorage.app",
    messagingSenderId: "71368810560",
    appId: "1:71368810560:web:355778e658420f9f50ffa5"
});

// Retrieve an instance of Firebase Cloud Messaging
const messaging = firebase.messaging();

// Handle Web Push API push events (from webpush.sendNotification)
self.addEventListener('push', (event) => {
    let payload = { title: 'SGR Fontana', body: 'Voce tem um lembrete pendente.' };

                        if (event.data) {
                              try {
                                      payload = event.data.json();
                              } catch (e) {
                                      payload = { title: 'SGR Fontana', body: event.data.text() };
                              }
                        }

                        const title = payload.title || 'SGR Fontana';
    const options = {
          body: payload.body || 'Voce tem um lembrete pendente.',
          icon: '/icon.png',
          badge: '/icon-badge.svg',
          vibrate: [0, 200, 100, 200],
          tag: 'sgr-push-notification',
          renotify: true,
          data: payload.data || {},
          actions: [
            { action: 'reserve', title: 'Confirmar Almoco' },
            { action: 'view_menu', title: 'Ver Cardapio' }
                ]
    };

                        event.waitUntil(
                              self.registration.showNotification(title, options)
                            );
});

// Handle background messages from Firebase Cloud Messaging (FCM native)
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);

                                const notificationTitle = payload.notification?.title || 'SGR Fontana';
    const notificationOptions = {
          body: payload.notification?.body || 'Voce possui uma nova atualizacao.',
          icon: '/icon.png',
          badge: '/icon-badge.svg',
          data: payload.data,
          vibrate: [200, 100, 200]
    };

                                return self.registration.showNotification(notificationTitle, notificationOptions);
});
