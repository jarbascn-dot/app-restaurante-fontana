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

            messaging.onBackgroundMessage((payload) => {
              const { title, body, icon } = payload.notification;
                self.registration.showNotification(title, {
                    body,
                        icon: icon || '/icon.png',
                            badge: '/icon-badge.svg'
                              });
                              });