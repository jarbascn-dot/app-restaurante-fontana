import { Handler } from '@netlify/functions';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase Admin SDK using modern modular APIs
let app: App;
const existingApps = getApps();

if (existingApps.length === 0) {
  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (serviceAccountEnv) {
    try {
      const serviceAccount = JSON.parse(serviceAccountEnv);
      app = initializeApp({
        credential: cert(serviceAccount)
      });
    } catch (e) {
      console.error('[Admin] Error parsing FIREBASE_SERVICE_ACCOUNT env var:', e);
      app = initializeApp({
        projectId: firebaseConfig.projectId
      });
    }
  } else if (privateKey && clientEmail) {
    app = initializeApp({
      credential: cert({
        projectId: firebaseConfig.projectId,
        clientEmail: clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      })
    });
  } else {
    app = initializeApp({
      projectId: firebaseConfig.projectId
    });
  }
} else {
  app = existingApps[0];
}

// Instantiate Firestore targeting our specific database instance
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const messaging = getMessaging(app);

export const handler: Handler = async (event, context) => {
  // Allow only POST or GET requests depending on invocation
  const method = event.httpMethod;
  if (method !== 'POST' && method !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    console.log('[FCM Daemon] Processing notification queue...');

  // 1. Fetch pending notifications: one-time items not yet sent, PLUS all
  // recurring ("daily") items regardless of their historical `sent` flag,
  // since recurring reminders must fire again every day.
  const [unsentSnapshot, dailySnapshot] = await Promise.all([
    db.collection('notificationQueue').where('sent', '==', false).limit(400).get(),
    db.collection('notificationQueue').where('daily', '==', true).limit(400).get(),
    ]);

  const docsById = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    unsentSnapshot.docs.forEach((d: FirebaseFirestore.QueryDocumentSnapshot) => docsById.set(d.id, d));
    dailySnapshot.docs.forEach((d: FirebaseFirestore.QueryDocumentSnapshot) => docsById.set(d.id, d));

  if (docsById.size === 0) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'No pending notifications to send.'
      })
    };
  }

  // 2. Fetch all registered FCM tokens to map userId -> token
  const fcmSnapshot = await db.collection('fcmTokens').get();
    const userTokens: Record<string, string> = {};
    fcmSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.userId && data.token) {
        userTokens[data.userId] = data.token;
      }
    });

  // 2b. Fetch users and holidays so recurring ("daily") reminders can honor the
  // user's chosen schedule ("todos_dias" vs "seg_sex") and be suppressed on
  // holidays, exactly like the day-of-week preference configured in the app.
  const usersSnapshot = await db.collection('usuarios').get();
  const usersByEmail = new Map<string, any>();
  usersSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.email) {
      usersByEmail.set(String(data.email).toLowerCase(), data);
    }
  });

  const feriadosSnapshot = await db.collection('feriados').get();
  const feriados: any[] = [];
  feriadosSnapshot.forEach(doc => feriados.push(doc.data()));

  // Day of week in Brasília timezone, used to skip Saturdays/Sundays for
  // users who picked "De Segunda a Sexta-Feira" (seg_sex).
  const weekdaySaoPaulo = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(new Date());
  const isWeekendSaoPaulo = weekdaySaoPaulo === 'Sat' || weekdaySaoPaulo === 'Sun';

  const results = {
    total: docsById.size,
    sent: 0,
    skippedNoToken: 0,
    skippedSchedule: 0,
    failed: 0
  };

  const batch = db.batch();

  // Current time-of-day and calendar date in Brasília timezone. The date is
  // used to know whether a recurring reminder has already fired "today", so
  // it can be released again automatically at the start of the next day.
  const nowSaoPaulo = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    const todaySaoPaulo = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

  // 3. Process each notification in the queue
  for (const doc of docsById.values()) {
    const notification = doc.data();
    const docRef = doc.ref;
    const userId = notification.userId;
    const title = notification.title || 'Alerta de Refeição';
    const body = notification.body || '';
    const isDaily = notification.daily === true;

    // Recurring reminders that already fired today wait for the next
    // calendar day instead of staying permanently marked as sent.
    if (isDaily && notification.lastSentDate === todaySaoPaulo) {
      continue;
    }

    // One-time reminders keep relying solely on the `sent` flag.
    if (!isDaily && notification.sent === true) {
      continue;
    }

    if (notification.scheduledTime && nowSaoPaulo < notification.scheduledTime) {
      continue;
    }

    // Recurring reminders must respect the user's chosen day-of-week option
    // ("todos_dias" vs "seg_sex") and be suppressed on holidays. The queue
    // item may already carry its own timing/idObraPadrao (set at
    // scheduling time); fall back to the user profile for older docs that
    // predate this field.
    if (isDaily) {
      const user = usersByEmail.get(String(userId).toLowerCase());
      const timing = notification.timing || user?.alertaTiming || 'todos_dias';
      const idObraPadrao = notification.idObraPadrao || user?.idObraPadrao;

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

    const token = userTokens[userId];

    if (!token) {
      console.warn(`[FCM Daemon] No registered token found for userId: ${userId}. Skipping notification.`);
      batch.update(docRef, {
        sent: true,
        ...(isDaily ? { lastSentDate: todaySaoPaulo } : {}),
        sentAt: FieldValue.serverTimestamp(),
        status: 'skipped_no_token'
      });
      results.skippedNoToken++;
      continue;
    }

    const message = {
      token: token,
      data: {
        title: title,
        body: body,
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
    };

    try {
      await messaging.send(message);
      batch.update(docRef, {
        sent: true,
        ...(isDaily ? { lastSentDate: todaySaoPaulo } : {}),
        sentAt: FieldValue.serverTimestamp(),
        status: 'sent'
      });
      results.sent++;
    } catch (err: any) {
      console.error(`[FCM Daemon] Failed sending to userId: ${userId}`, err);

    // Clean up expired or unregistered device tokens
    if (
      err.code === 'messaging/registration-token-not-registered' ||
      err.code === 'messaging/invalid-registration-token'
      ) {
      console.log(`[FCM Daemon] Token for userId: ${userId} is expired/invalid. Removing token from database.`);
      await db.collection('fcmTokens').doc(userId).delete();
    }

    batch.update(docRef, {
      sent: true,
      ...(isDaily ? { lastSentDate: todaySaoPaulo } : {}),
      sentAt: FieldValue.serverTimestamp(),
      status: 'error',
      error: err.message || String(err)
    });
      results.failed++;
    }
  }

  // 4. Commit Firestore updates in a single atomic batch
  await batch.commit();

  console.log('[FCM Daemon] Run summary:', results);

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      message: `Processed ${results.total} notifications.`,
      results
    })
  };
  } catch (error: any) {
    console.error('[FCM Daemon] Critical error in handler:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        details: error.message || String(error)
      })
    };
  }
};
