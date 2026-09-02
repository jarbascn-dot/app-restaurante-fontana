import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: "json" };
 
let adminApp: App | null = null;
let adminDb: any = null;
 
function getFirebaseAdmin() {
if (adminApp && adminDb) {
return { db: adminDb };
}
 
const existingApps = getApps();
if (existingApps.length > 0) {
adminApp = existingApps[0];
} else {
const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
 
let serviceAccount: any = null;
 
if (serviceAccountEnv) {
try {
serviceAccount = JSON.parse(serviceAccountEnv.trim().replace(/^['"]|['"]$/g, ''));
} catch (e: any) {
console.error('[Admin] Error parsing FIREBASE_SERVICE_ACCOUNT:', e);
}
}
 
if (!serviceAccount && privateKey && clientEmail) {
serviceAccount = {
projectId,
clientEmail: clientEmail.trim().replace(/^['"]|['"]$/g, ''),
privateKey: privateKey.trim().replace(/^['"]|['"]$/g, '').replace(/\\n/g, '\n'),
};
}
 
if (serviceAccount) {
adminApp = initializeApp({ credential: cert(serviceAccount) });
} else {
adminApp = initializeApp({ projectId });
}
}
 
let databaseId: string | undefined = process.env.FIREBASE_DATABASE_ID || process.env.FIRESTORE_DATABASE_ID;
if (databaseId === undefined && process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'production') {
databaseId = firebaseConfig.firestoreDatabaseId;
}
 
adminDb = databaseId ? getFirestore(adminApp!, databaseId) : getFirestore(adminApp!);
return { db: adminDb };
}
 
const toFcmDocId = (uid: string) => String(uid).trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
 
export default async function handler(req: VercelRequest, res: VercelResponse) {
// Permite apenas POST
if (req.method !== 'POST') {
return res.status(405).json({ error: 'Method Not Allowed' });
}
 
const { email, token } = req.body || {};
 
if (!email || typeof email !== 'string') {
return res.status(400).json({ error: 'Campo "email" é obrigatório.' });
}
if (!token || typeof token !== 'string') {
return res.status(400).json({ error: 'Campo "token" é obrigatório.' });
}
 
const emailLower = email.trim().toLowerCase();
 
try {
const { db } = getFirebaseAdmin();
 
// Busca o documento do usuário pelo campo email (ID interno pode ser u-jarbas etc.)
const snap = await db.collection('usuarios').where('email', '==', emailLower).limit(1).get();
 
if (snap.empty) {
console.warn(`[update-fcm-token] Usuário não encontrado para email: ${emailLower}`);
// Mesmo sem encontrar em usuarios, salva em fcmTokens para o cron encontrar
await db.collection('fcmTokens').doc(toFcmDocId(emailLower) + '_web').set({
token,
userId: emailLower,
updatedAt: new Date().toISOString(),
source: 'client_recovery_no_user_doc',
}, { merge: true });
return res.status(200).json({ success: true, warning: 'Usuário não encontrado em usuarios, token salvo apenas em fcmTokens.' });
}
 
const userDoc = snap.docs[0];
const batch = db.batch();
 
// Atualiza usuarios/{docId} via Admin SDK (ignora regras de segurança do Firestore)
batch.set(userDoc.ref, {
fcmToken: token,
precisaAtivarNotificacao: false,
fcmTokenAtualizadoEm: new Date().toISOString(),
notificacaoPendenteMotivo: null,
}, { merge: true });
 
// Atualiza fcmTokens/{email_sanitizado} — caminho principal do cron
batch.set(db.collection('fcmTokens').doc(toFcmDocId(emailLower) + '_web'), {
token,
userId: emailLower,
updatedAt: new Date().toISOString(),
source: 'client_recovery',
autoRecoveredAt: new Date().toISOString(),
}, { merge: true });
 
await batch.commit();
 
console.log(`[update-fcm-token] Token atualizado com sucesso para ${emailLower}`);
return res.status(200).json({ success: true });
 
} catch (error: any) {
console.error('[update-fcm-token] Erro:', error);
return res.status(500).json({ error: 'Erro interno', message: error.message });
}
}
