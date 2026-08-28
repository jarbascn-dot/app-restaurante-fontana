/**
* @license
* SPDX-License-Identifier: Apache-2.0
*/
 
import { saveToFirestore } from './firebaseSync';
import { getFCMToken, db } from '../firebase';
import { doc, setDoc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
 
let fallbackTimeoutId: any = null;
 
/**
* Convert VAPID key to Uint8Array for browser push manager registration.
*/
function urlBase64ToUint8Array(base64String: string) {
const padding = '='.repeat((4 - base64String.length % 4) % 4);
const base64 = (base64String + padding)
.replace(/\-/g, '+')
.replace(/_/g, '/');
 
const rawData = window.atob(base64);
const outputArray = new Uint8Array(rawData.length);
 
for (let i = 0; i < rawData.length; ++i) {
outputArray[i] = rawData.charCodeAt(i);
}
return outputArray;
}
 
/**
* Automagic helper to register/sync Web Push subscripton with Firestore and server.
* This guarantees sleep-proof, WhatsApp-like background and suspended notifications!
*/
export async function subscribeUserToPush(email: string): Promise<any> {
const isSWSupported = 'serviceWorker' in navigator;
const isPushSupported = 'PushManager' in window;
 
if (!isSWSupported || !isPushSupported) {
console.warn('[Push Service] Push notifications are not supported on this browser/platform.');
return null;
}
 
try {
// 1. Fetch public VAPID key from Express API
const response = await fetch('/api/push/public-key');
if (!response.ok) {
throw new Error(`Failed to fetch push public key: ${response.statusText}`);
}
const { publicKey } = await response.json();
 
// 2. Get active service worker
const reg = await navigator.serviceWorker.ready;
 
// 3. Request subscription
let subscription = await reg.pushManager.getSubscription();
if (!subscription) {
subscription = await reg.pushManager.subscribe({
userVisibleOnly: true,
applicationServerKey: urlBase64ToUint8Array(publicKey)
});
}
 
// 4. Transform into clean serialized object for Firestore and server payload
const rawSub = subscription.toJSON();
if (!rawSub.endpoint || !rawSub.keys || !rawSub.keys.p256dh || !rawSub.keys.auth) {
console.warn('[Push Service] Serialized subscription contains missing fields.');
return subscription;
}
 
const pushSub = {
id: `sub-${email.replace(/[^a-zA-Z0-9]/g, '-')}`,
email,
endpoint: rawSub.endpoint,
keys: {
p256dh: rawSub.keys.p256dh,
auth: rawSub.keys.auth
},
updatedAt: new Date().toISOString()
};
 
// 5. Store in Firebase Cloud Database to persist across devices and server reboots
await saveToFirestore('push_subscriptions', pushSub);
console.log('[Push Service] Device subscribed and synced with Firestore:', pushSub);
 
// Save subscription locally for immediate visual testing / simulated alerts
localStorage.setItem(`sgr_push_subscription_${email}`, JSON.stringify(subscription));
 
return subscription;
} catch (err) {
console.error('[Push Service] Subscription sequence encountered an issue:', err);
return null;
}
}
 
/**
* Robust cross-platform helper to request permissions and schedule background
* and foreground notification triggers.
*/
export async function scheduleNotification(
time: string,
title: string,
body: string,
email?: string,
timing?: 'todos_dias' | 'seg_sex',
idObraPadrao?: string
) {
const userParam = email || 'guest';
 
// Persist locally in localStorage for robust client fallback reads
localStorage.setItem(`sgr_notify_enabled_${userParam}`, 'true');
localStorage.setItem(`sgr_notify_time_${userParam}`, time);
 
// Sync notificationQueue in Firestore FIRST, independent of local Notification API
// support. Actual delivery on Android happens via native FCM push + native channel,
// not via window.Notification, so this must not be gated behind that permission check
// (a bare WebView without WebChromeClient support never grants it, which was silently
// blocking scheduledTime/sent updates whenever the user rescheduled from the app).
if (email) {
const emailLowerSync = email.toLowerCase().trim();
const queueDocId = `daily_${emailLowerSync.replace(/[^a-zA-Z0-9]/g, '_')}`;
const docRef = doc(db, 'notificationQueue', queueDocId);
 
try {
const docSnap = await getDoc(docRef);
if (docSnap.exists()) {
const existingData: any = docSnap.data();
const todayStr = new Date().toISOString().slice(0, 10);
const lastSyncStr = existingData?.updatedAt ? String(existingData.updatedAt).slice(0, 10) : null;
const isNewDay = lastSyncStr !== todayStr;
const timeChanged = existingData?.scheduledTime !== time;
 
await updateDoc(docRef, {
scheduledTime: time,
timing: timing || 'todos_dias',
idObraPadrao: idObraPadrao || null,
notificacaoPendenteMotivo: null,
precisaAtivarNotificacao: false,
updatedAt: new Date().toISOString(),
...((isNewDay || timeChanged) ? { sent: false, lastSentDate: null, errorAt: null, errorMessage: null } : {})
});
console.log(`[Scheduler] Updated existing notificationQueue doc ${queueDocId} with scheduledTime:`, time);
} else {
const queueItem = {
id: queueDocId,
userId: emailLowerSync,
title: title || 'SGR Fontana',
body: body || 'Lembrete de refeição!',
link: '/',
daily: true,
scheduledTime: time,
timing: timing || 'todos_dias',
idObraPadrao: idObraPadrao || null,
notificacaoPendenteMotivo: null,
precisaAtivarNotificacao: false,
sent: false,
lastSentDate: null,
updatedAt: new Date().toISOString()
};
await saveToFirestore('notificationQueue', queueItem);
console.log('[Scheduler] Created new notificationQueue doc:', queueDocId);
}
} catch (err) {
console.warn('[Scheduler] Failed to sync notificationQueue doc:', err);
}
}
 
const isSWSupported = 'serviceWorker' in navigator;
const isNotificationSupported = 'Notification' in window;
 
if (!isSWSupported || !isNotificationSupported) {
console.warn('[Scheduler] Service Workers ou Notifications não são totalmente suportados por esta plataforma.');
runLocalFallback(time, title, body);
return;
}
 
try {
// Request permission if not already denied or granted
let permission = Notification.permission;
if (permission === 'default') {
permission = await Notification.requestPermission();
}
 
if (permission !== 'granted') {
console.warn('[Scheduler] Permissão para notificações negada pelo usuário ou sistema:', permission);
return;
}
 
// Register our customizable sw.js
let reg = await navigator.serviceWorker.getRegistration('/sw.js');
if (!reg) {
reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
}
 
// Wait until controller is ready to receive messages
if (!navigator.serviceWorker.controller) {
await new Promise<void>((resolve) => {
navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
});
}
 
// Relay notification specs to background thread
const sw = navigator.serviceWorker.controller || reg.active;
if (sw) {
sw.postMessage({
type: 'SCHEDULE_NOTIFICATION',
email: userParam,
time,
title,
body,
timing: 'mesmo_dia'
});
console.log(`[Scheduler] Agendamento enviado com sucesso para o Service Worker: ${time} para ${userParam}`);
} else {
console.warn('[Scheduler] Não há um service worker controlador pronto.');
}
 
// Automagically register background Push Subscription & FCM Token to guarantee sleep-proof notifications
if (email) {
const emailLower = email.toLowerCase().trim();
subscribeUserToPush(emailLower).catch(err => console.warn('[Scheduler] Auto-push enrollment failed:', err));
 
// Retrieve & persist Firebase Cloud Messaging (FCM) Token via Admin SDK endpoint
// CORREÇÃO: escrita direta em usuarios/{email} falha (ID inválido pelo isValidId)
// e escrita em usuarios/{docId} também falha pelas security rules.
// Usar /api/update-fcm-token que roda com Admin SDK no servidor (bypassa as rules).
getFCMToken(emailLower).then(async (fcmToken) => {
if (fcmToken) {
console.log('[Scheduler] FCM Token obtido com sucesso:', fcmToken);
try {
// 1. Salva token via Admin SDK endpoint (bypassa Firestore security rules)
const tokenResponse = await fetch('/api/update-fcm-token', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ email: emailLower, token: fcmToken }),
});
if (tokenResponse.ok) {
console.log('[Scheduler] FCM Token salvo via API para:', emailLower);
} else {
console.warn('[Scheduler] API update-fcm-token retornou erro:', await tokenResponse.text().catch(() => ''));
}
 
// 2. Also attach token to notificationQueue doc for instant server cron dispatch
const queueDocId = `daily_${emailLower.replace(/[^a-zA-Z0-9]/g, '_')}`;
const queueDocRef = doc(db, 'notificationQueue', queueDocId);
await setDoc(queueDocRef, { fcmToken, updatedAt: new Date().toISOString() }, { merge: true });
console.log('[Scheduler] FCM Token sincronizado em notificationQueue');
} catch (tokenSaveErr) {
console.warn('[Scheduler] Erro ao sincronizar FCM token:', tokenSaveErr);
}
} else {
console.warn('[Scheduler] FCM Token não retornado (navegador ou permissão ausente).');
}
}).catch(fcmErr => {
console.warn('[Scheduler] Falha na obtenção do FCM Token:', fcmErr);
});
}
 
} catch (error) {
console.error('[Scheduler] Erro crítico no fluxo de agendamento de notificações:', error);
}
 
// Always boot up foreground memory fallback
runLocalFallback(time, title, body);
}
 
function runLocalFallback(time: string, title: string, body: string) {
if (fallbackTimeoutId) {
clearTimeout(fallbackTimeoutId);
fallbackTimeoutId = null;
}
 
const [cfgHour, cfgMin] = time.split(':').map(Number);
if (isNaN(cfgHour) || isNaN(cfgMin)) return;
 
const now = new Date();
const target = new Date();
target.setHours(cfgHour, cfgMin, 0, 0);
 
// If time is already in past today, set for tomorrow
if (target.getTime() <= now.getTime()) {
target.setDate(target.getDate() + 1);
}
 
const delayMs = target.getTime() - now.getTime();
console.log(`[Scheduler Fallback] Agendamento em primeiro plano ativo para daqui a ${Math.round(delayMs / 1000)} segundos`);
 
if (delayMs > 0 && delayMs < 2147483647) {
fallbackTimeoutId = setTimeout(() => {
if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
new Notification(title, {
body,
icon: '/icon.png'
});
} else {
console.log(`[Notification Fallback Fired] ${title}: ${body}`);
}
// Stagger tomorrow's timer
runLocalFallback(time, title, body);
}, delayMs);
}
}
 
/**
* Registers the FCM token for the current user in Firestore.
* This enables server-side notifications via Firebase Cloud Messaging.
*
* CORREÇÃO: recebe userEmail (não userId interno como u-jarbas) e usa
* /api/update-fcm-token (Admin SDK) para salvar, evitando bloqueio das
* regras de segurança do Firestore ao tentar escrever em usuarios/u-jarbas.
* Em App.tsx, passe user.email em vez de user.id ao chamar esta função.
*/
export async function registerFCMToken(userEmail: string): Promise<void> {
try {
if (typeof Notification === 'undefined') {
console.warn('[FCM] Notification API is not supported in this browser.');
return;
}
const permission = await Notification.requestPermission();
if (permission !== 'granted') {
console.warn('[FCM] Notification permission denied.');
return;
}
const token = await getFCMToken(userEmail);
if (!token) {
console.warn('[FCM] Could not obtain FCM token.');
return;
}
// CORREÇÃO: Escrita direta em usuarios/{id} é bloqueada pelas regras do Firestore.
// O endpoint usa Admin SDK no servidor, que ignora as regras de segurança.
const response = await fetch('/api/update-fcm-token', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ email: userEmail, token }),
});
if (response.ok) {
console.log('[FCM] Token registered successfully for user:', userEmail);
} else {
console.warn('[FCM] API returned error when saving token:', await response.text());
}
} catch (err) {
console.error('[FCM] Failed to register token:', err);
}
}
 
/**
* Verifica automaticamente se o token FCM está inválido (flag precisaAtivarNotificacao)
* e renova o token forçando exclusão do token antigo antes de obter um novo.
* Deve ser chamada no login do usuário.
*
* CORREÇÃO: usa /api/update-fcm-token (Admin SDK no servidor) para salvar o token,
* evitando o bloqueio das regras de segurança do Firestore ao escrever em
* usuarios/{docId} cujo ID é um ID interno (ex: u-jarbas), diferente do UID do Firebase Auth.
*/
export async function autoRecoverFCMToken(userEmail: string): Promise<void> {
try {
if (!userEmail) return;
const emailLower = userEmail.toLowerCase().trim();
 
const { collection, query, where, getDocs, limit } = await import('firebase/firestore');
 
const snap = await getDocs(
query(collection(db, 'usuarios'), where('email', '==', emailLower), limit(1))
);
if (snap.empty) return;
 
const userDoc = snap.docs[0];
const userData = userDoc.data();
 
if (userData?.precisaAtivarNotificacao !== true) return;
 
console.log('[FCM AutoRecover] Token inválido detectado. Renovando automaticamente...');
 
// Força token completamente novo (deleteToken + getToken)
const newToken = await getFCMToken(emailLower, true);
if (!newToken) {
console.warn('[FCM AutoRecover] Não foi possível obter novo token FCM. Verifique permissões.');
return;
}
 
// CORREÇÃO: Escrita direta em usuarios/u-jarbas é bloqueada pelas regras de segurança
// do Firestore (UID do Firebase Auth ≠ ID interno do documento).
// Usamos o endpoint /api/update-fcm-token que roda com Admin SDK no servidor,
// ignorando as regras de segurança. Ele atualiza usuarios/{docId} e fcmTokens/{email}
// em um único batch atômico.
const response = await fetch('/api/update-fcm-token', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ email: emailLower, token: newToken }),
});
 
if (!response.ok) {
const errData = await response.json().catch(() => ({}));
console.warn('[FCM AutoRecover] Erro ao salvar token via API:', errData);
return;
}
 
console.log('[FCM AutoRecover] Token renovado com sucesso! Notificações reativadas automaticamente.');
} catch (err) {
console.warn('[FCM AutoRecover] Erro na auto-recuperação do token:', err);
}
}
