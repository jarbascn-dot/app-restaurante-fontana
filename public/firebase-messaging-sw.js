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
  appId: "1:71368810560:web:3557786658420f9f50ffa5"
});

// Retrieve an instance of Firebase Cloud Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'SGR Fontana';
  const notificationOptions = {
    body: payload.notification?.body || 'Você possui uma nova atualização.',
    icon: '/icon.png',
    badge: '/icon-badge.svg',
    data: payload.data,
    vibrate: [200, 100, 200]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
