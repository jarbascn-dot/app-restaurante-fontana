// public/firebase-messaging-sw.js
// ============================================================
// ATENCAO: Este arquivo NAO pode usar ES Modules nem import.meta
// Ele e executado em contexto de Service Worker isolado
// ============================================================

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Copie aqui as mesmas configuracoes do firebase-applet-config.json
// NUNCA use import.meta.env aqui - o Service Worker nao tem acesso ao Vite
const firebaseConfig = {
    apiKey:            "AIzaSyARWM_Q2Anq30Cg86Zn15wptXcL7puZDN0",
    authDomain:        "meu-app-producao-af69c.firebaseapp.com",
    projectId:         "meu-app-producao-af69c",
    storageBucket:     "meu-app-producao-af69c.firebasestorage.app",
    messagingSenderId: "71368810560",
    appId:             "1:71368810560:web:355778b658420f9f50ffa5",
};

// Inicializar Firebase no contexto do Service Worker
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// ─── HANDLER DE MENSAGENS EM SEGUNDO PLANO ───────────────────────────────
// Disparado quando o app esta FECHADO ou em segundo plano
messaging.onBackgroundMessage(function(payload) {
    console.log('[firebase-messaging-sw.js] Mensagem recebida em segundo plano:', payload);

                                const notificationTitle = payload.notification?.title || 'SGR Fontana';
    const notificationBody  = payload.notification?.body  || 'Voce tem uma nova atualizacao.';

                                const notificationOptions = {
                                      body:    notificationBody,
                                      icon:    '/icon.png',
                                      badge:   '/icon-badge.svg',
                                      data: {
                                              url: payload.data?.url || '/',
                                              ...payload.data,
                                      },
                                      vibrate: [200, 100, 200],
                                      tag:     payload.data?.tag || 'sgr-fontana-notification',
                                      requireInteraction: false,
                                };

                                // CRITICO: retornar a Promise do showNotification
                                return self.registration.showNotification(notificationTitle, notificationOptions);
});

// ─── HANDLER DE CLIQUE NA NOTIFICACAO ────────────────────────────────────
// Abre o app ao clicar no banner
self.addEventListener('notificationclick', function(event) {
    console.log('[firebase-messaging-sw.js] Notificacao clicada:', event.notification);

                        event.notification.close();

                        const urlToOpen = event.notification.data?.url || '/';

                        event.waitUntil(
                              clients.matchAll({ type: 'window', includeUncontrolled: true })
                                .then(function(clientList) {
                                          for (const client of clientList) {
                                                      if (client.url.includes(self.location.origin) && 'focus' in client) {
                                                                    return client.focus();
                                                      }
                                          }
                                          if (clients.openWindow) {
                                                      return clients.openWindow(urlToOpen);
                                          }
                                })
                            );
});

// ─── ATIVACAO IMEDIATA DO SW ─────────────────────────────────────────────
// Garante que o novo SW assuma o controle imediatamente sem esperar reload
self.addEventListener('install', function(event) {
    self.skipWaiting();
});

self.addEventListener('activate', function(event) {
    event.waitUntil(clients.claim());
});
