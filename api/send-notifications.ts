import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import firebaseConfig from '../firebase-applet-config.json' with { type: "json" };
 
// Lazy-initialized Firebase Admin variables
let adminApp: App | null = null;
let adminDb: any = null;
let adminMessaging: any = null;
 
function getFirebaseAdmin() {
    if (adminApp && adminDb && adminMessaging) {
        return { db: adminDb, messaging: adminMessaging };
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
            const cleaned = serviceAccountEnv.trim().replace(/^['"]|['"]$/g, '');
            serviceAccount = JSON.parse(cleaned);
        } catch (e: any) {
            console.error('[Admin] Error parsing FIREBASE_SERVICE_ACCOUNT env var:', e);
        }
    }
 
    if (!serviceAccount && privateKey && clientEmail) {
        const cleanPrivateKey = privateKey.trim().replace(/^['"]|['"]$/g, '').replace(/\\n/g, '\n');
        const cleanClientEmail = clientEmail.trim().replace(/^['"]|['"]$/g, '');
 
        serviceAccount = {
            projectId,
            clientEmail: cleanClientEmail,
            privateKey: cleanPrivateKey,
        };
    }
 
    if (serviceAccount) {
        try {
            adminApp = initializeApp({
                credential: cert(serviceAccount)
            });
            console.log('[Admin] Initialized Firebase Admin SDK with service account credentials.');
        } catch (err: any) {
            console.error('[Admin] Error initializing Firebase Admin with credentials:', err);
            throw new Error(`Failed to initialize Firebase Admin with credentials: ${err.message}`);
        }
    } else {
        console.warn('[Admin] No explicit service account credentials provided. Attempting fallback.');
        try {
            adminApp = initializeApp({ projectId });
        } catch (err: any) {
            console.error('[Admin] Fallback initialization failed:', err);
            throw new Error('Firebase Admin credentials are required. Please configure FIREBASE_SERVICE_ACCOUNT or FIREBASE_PRIVATE_KEY/FIREBASE_CLIENT_EMAIL.');
        }
    }
    }
 
// Determine the firestore database ID dynamically
let databaseId: string | undefined = process.env.FIREBASE_DATABASE_ID || process.env.FIRESTORE_DATABASE_ID;
    if (databaseId === undefined) {
        if (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') {
            databaseId = undefined; // Uses default database in production Vercel
        } else {
            databaseId = firebaseConfig.firestoreDatabaseId;
        }
    }
 
try {
    adminDb = databaseId ? getFirestore(adminApp!, databaseId) : getFirestore(adminApp!);
    adminMessaging = getMessaging(adminApp!);
} catch (err: any) {
    console.error('[Admin] Error getting Firestore or Messaging instances:', err);
    throw new Error(`Error instantiating Firestore or Messaging: ${err.message}`);
}
 
return { db: adminDb, messaging: adminMessaging };
}
 
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const method = req.method;
    if (method !== 'POST' && method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
 
    // Verificação de janela horária (America/Sao_Paulo) para otimizar leituras do Firestore
    const weekdaySP = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(new Date());
    const isWeekendSP = weekdaySP === 'Sat' || weekdaySP === 'Sun';
    const nowSP = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
 
    const isMorningWindow = nowSP >= '07:00' && nowSP <= '09:00';
    const isNightWindow = nowSP >= '18:00' && nowSP <= '22:10';
 
    if (isWeekendSP || (!isMorningWindow && !isNightWindow)) {
        return res.status(200).json({ success: true, message: 'Fora da janela' });
    }
 
try {
    const { db, messaging } = getFirebaseAdmin();
    console.log('[FCM Daemon] Processing notification queue...');
 
    const [unsentSnapshot, dailySnapshot] = await Promise.all([
        db.collection('notificationQueue').where('sent', '==', false).limit(400).get(),
        db.collection('notificationQueue').where('daily', '==', true).limit(400).get(),
        ]);
 
    const docsById = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    unsentSnapshot.docs.forEach((d: FirebaseFirestore.QueryDocumentSnapshot) => docsById.set(d.id, d));
    dailySnapshot.docs.forEach((d: FirebaseFirestore.QueryDocumentSnapshot) => docsById.set(d.id, d));
 
    if (docsById.size === 0) {
        return res.status(200).json({
            success: true,
            message: 'No pending notifications to send.'
        });
    }
 
    const weekdaySaoPaulo = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(new Date());
    const isWeekendSaoPaulo = weekdaySaoPaulo === 'Sat' || weekdaySaoPaulo === 'Sun';
    const nowSaoPaulo = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    const todaySaoPaulo = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
 
    const toFcmDocId = (userId: string) => String(userId).trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
    const pendingUserIds = Array.from(new Set(Array.from(docsById.values()).map((d) => d.data().userId).filter(Boolean)));
 
    const userTokens: Record<string, string> = {};
    const [feriadosSnapshot] = await Promise.all([
        db.collection('feriados').where('data', '==', todaySaoPaulo).get(),
        Promise.all(pendingUserIds.map(async (userId: string) => {
            const tokenDoc = await db.collection('fcmTokens').doc(toFcmDocId(userId)).get();
            if (tokenDoc.exists) {
                const data = tokenDoc.data();
                if (data?.token) {
                    userTokens[userId] = data.token;
                }
            }
        })),
        ]);
 
    const feriados: any[] = [];
    feriadosSnapshot.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => feriados.push(doc.data()));
 
    const usersByEmailCache = new Map<string, any>();
    async function getUserByEmail(email: string): Promise<any | null> {
        const key = String(email).toLowerCase();
        if (usersByEmailCache.has(key)) {
            return usersByEmailCache.get(key);
        }
        const snap = await db.collection('usuarios').where('email', '==', key).limit(1).get();
        const user = snap.empty ? null : { ...snap.docs[0].data(), id: snap.docs[0].id };
        usersByEmailCache.set(key, user);
        return user;
    }
 
    const results = { sent: 0, skipped: 0, skippedSchedule: 0, errors: 0 };
    const batch = db.batch();
 
    for (const doc of docsById.values()) {
        const notification = doc.data();
        const token = userTokens[notification.userId];
        const isDaily = notification.daily === true;
 
    if (isDaily && notification.lastSentDate === todaySaoPaulo) {
        continue;
    }
 
    if (!isDaily && notification.sent === true) {
        continue;
    }
 
    if (notification.scheduledTime && nowSaoPaulo < notification.scheduledTime) {
        continue;
    }
 
    if (isDaily) {
        let timing = notification.timing;
        let idObraPadrao = notification.idObraPadrao;
 
        if (timing === undefined || idObraPadrao === undefined) {
            const user = await getUserByEmail(notification.userId);
            if (timing === undefined) timing = user?.alertaTiming;
            if (idObraPadrao === undefined) idObraPadrao = user?.idObraPadrao;
        }
        timing = timing || 'todos_dias';
 
        if (timing === 'seg_sex' && isWeekendSaoPaulo) {
            results.skippedSchedule++;
            continue;
        }
 
        const isHolidayForUser = feriados.some((f: any) => {
            if (f.data !== todaySaoPaulo) return false;
            if (!f.abrangencia || f.abrangencia === 'nacional') return true;
            return f.idObras?.includes(idObraPadrao) ?? false;
        });
 
        if (isHolidayForUser) {
            results.skippedSchedule++;
            continue;
        }
    }
 
    if (!token) {
        console.warn(`[FCM] No token found for userId: ${notification.userId}. Skipping.`);
        const userNoToken = await getUserByEmail(notification.userId);
        if (userNoToken?.id) {
            batch.set(db.collection('usuarios').doc(userNoToken.id), {
                precisaAtivarNotificacao: true,
                notificacaoPendenteMotivo: 'sem_token',
                notificacaoPendenteDesde: FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        batch.update(doc.ref, {
            sent: true,
            skippedAt: FieldValue.serverTimestamp(),
            skipReason: 'no_token'
        });
        results.skipped++;
        continue;
    }
 
    try {
        await messaging.send({
            token,
            data: {
                title: notification.title,
                body: notification.body,
                link: notification.link || '/',
            },
            webpush: {
                fcmOptions: {
                    link: notification.link || '/',
                },
            },
            android: {
                priority: 'high' as const,
            },
        });
 
        batch.update(doc.ref, {
            sent: true,
            ...(isDaily ? { lastSentDate: todaySaoPaulo } : {}),
            sentAt: FieldValue.serverTimestamp()
        });
        results.sent++;
    } catch (sendError: any) {
        console.error(`[FCM] Error sending to token ${token}:`, sendError.message);
        const invalidTokenCodes = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'];
        if (invalidTokenCodes.includes(sendError.code)) {
            const fcmDocId = toFcmDocId(notification.userId);
            batch.delete(db.collection('fcmTokens').doc(fcmDocId));
            const userInvalido = await getUserByEmail(notification.userId);
            if (userInvalido?.id) {
                batch.set(db.collection('usuarios').doc(userInvalido.id), {
                    precisaAtivarNotificacao: true,
                    notificacaoPendenteMotivo: 'token_invalido',
                    notificacaoPendenteDesde: FieldValue.serverTimestamp(),
                }, { merge: true });
            }
        }
        batch.update(doc.ref, {
            sent: true,
            errorAt: FieldValue.serverTimestamp(),
            errorMessage: sendError.message
        });
        results.errors++;
    }
    }
 
    await batch.commit();
 
    console.log(`[FCM Daemon] Done. Sent: ${results.sent}, Skipped: ${results.skipped}, SkippedSchedule: ${results.skippedSchedule}, Errors: ${results.errors}`);
 
    return res.status(200).json({
        success: true,
        ...results
    });
 
} catch (error: any) {
    console.error('[FCM Daemon] Fatal error:', error);
    return res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
    });
}
}
