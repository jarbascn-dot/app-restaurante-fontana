// Firebase Cloud Messaging Service Worker
// Este arquivo e registrado separadamente pelo app para receber notificacoes FCM

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

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

            // Recebe notificacoes quando o app esta em segundo plano
            messaging.onBackgroundMessage(function(payload) {
              console.log('[firebase-messaging-sw.js] Notificacao recebida:', payload);

                const notificationTitle = payload.notification && payload.notification.title ? payload.notification.title : 'Lembrete';
                  const notificationOptions = {
                      body: payload.notification && payload.notification.body ? payload.notification.body : 'Voce tem um novo lembrete!',
                          icon: '/icon.png',
                              badge: '/icon-badge.svg',
                                  data: payload.data,
                                      requireInteraction: true,
                                        };

                                          self.registration.showNotification(notificationTitle, notificationOptions);
                                          });

                                          // Ao clicar na notificacao, abre o app
                                          self.addEventListener('notificationclick', function(event) {
                                            event.notification.close();
                                              event.waitUntil(
                                                  clients.openWindow('/')
                                                    );
                                                    });
