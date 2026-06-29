import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const firebaseConfig = require('../firebase-applet-config.json');

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

const db = getFirestore(app);
const messaging = getMessaging(app);

export default async function handler(req: VercelRequest, res: VercelResponse) {
      if (req.method !== 'GET' && req.method !== 'POST') {
              return res.status(405).json({ error: 'Method Not Allowed' });
      }

  try {
          console.log('[FCM Daemon] Processing notification queue...');

        // Get current time in Brazil (America/Sao_Paulo) - HH:MM format
        const now = new Date();
          const brasilTime = new Intl.DateTimeFormat('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
          }).format(now);
          const [currentHour, currentMinute] = brasilTime.split(':').map(Number);
          console.log(`[FCM Daemon] Current time (America/Sao_Paulo): ${brasilTime}`);

        // 1. Fetch all unsent notifications from the queue
        const queueSnapshot = await db.collection('notificationQueue')
            .where('sent', '==', false)
            .limit(400)
            .get();

        if (queueSnapshot.empty) {
                  return res.status(200).json({
                              success: true,
                              message: 'No pending notifications to send.'
                  });
        }

        // 2. Fetch all registered FCM tokens to map userId -> token
        const fcmSnapshot = await db.collection('fcmTokens').get();
          const tokenMap: Record<string, string> = {};
          fcmSnapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.token && data.userId) {
                                tokenMap[data.userId] = data.token;
                    }
          });

        const batch = db.batch();
          const results = { sent: 0, skipped: 0, errors: 0, notDue: 0 };

        // 3. Process each notification in the queue
        for (const doc of queueSnapshot.docs) {
                  const notification = doc.data();

            // For daily notifications, check if the scheduled time matches current minute
            if (notification.daily && notification.scheduledTime) {
                        const [schedHour, schedMin] = notification.scheduledTime.split(':').map(Number);
                        if (isNaN(schedHour) || isNaN(schedMin)) {
                                      console.warn(`[FCM] Invalid scheduledTime "${notification.scheduledTime}" for doc ${doc.id}. Skipping.`);
                                      results.skipped++;
                                      continue;
                        }
                        if (schedHour !== currentHour || schedMin !== currentMinute) {
                                      // Not the right minute yet — skip without modifying the document
                          results.notDue++;
                                      continue;
                        }
            }

            const token = tokenMap[notification.userId];

            if (!token) {
                        console.warn(`[FCM] No token found for userId: ${notification.userId}. Skipping.`);
                        if (!notification.daily) {
                                      batch.update(doc.ref, {
                                                      sent: true,
                                                      skippedAt: FieldValue.serverTimestamp(),
                                                      skipReason: 'no_token'
                                      });
                        }
                        results.skipped++;
                        continue;
            }

            try {
                        const message = {
                                      token,
                                      notification: {
                                                      title: notification.title || 'Notificacao',
                                                      body: notification.body || '',
                                      },
                                      webpush: notification.link ? {
                                                      fcmOptions: { link: notification.link }
                                      } : undefined,
                        };

                    await messaging.send(message);
                        console.log(`[FCM] Sent notification to userId: ${notification.userId}`);

                    if (notification.daily) {
                                  // Reset sent:false so it fires again tomorrow at the same time
                          batch.update(doc.ref, {
                                          sent: false,
                                          lastSentAt: FieldValue.serverTimestamp()
                          });
                    } else {
                                  batch.update(doc.ref, {
                                                  sent: true,
                                                  sentAt: FieldValue.serverTimestamp()
                                  });
                    }
                        results.sent++;
            } catch (err: unknown) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        console.error(`[FCM] Error sending to userId ${notification.userId}:`, errorMessage);

                    if (notification.daily) {
                                  batch.update(doc.ref, {
                                                  sent: false,
                                                  lastErrorAt: FieldValue.serverTimestamp(),
                                                  lastErrorMessage: errorMessage
                                  });
                    } else {
                                  batch.update(doc.ref, {
                                                  sent: true,
                                                  errorAt: FieldValue.serverTimestamp(),
                                                  errorMessage: errorMessage
                                  });
                    }
                        results.errors++;
            }
        }

        await batch.commit();

        console.log(`[FCM Daemon] Done. Sent: ${results.sent}, Skipped: ${results.skipped}, Errors: ${results.errors}, NotDue: ${results.notDue}`);

        return res.status(200).json({
                  success: true,
                  ...results
        });

  } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error('[FCM Daemon] Fatal error:', errorMessage);
          return res.status(500).json({
                    success: false,
                    error: errorMessage
          });
  }
}
