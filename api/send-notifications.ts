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
      const cleanPrivateKey = privateKey.trim()
        .replace(/^['"]|['"]$/g, '')
        .replace(/\\n/g, '\n');
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
        adminApp = initializeApp({
          projectId
        });
      } catch (err: any) {
        console.error('[Admin] Fallback initialization failed:', err);
        throw new Error('Firebase Admin credentials are required. Please configure FIREBASE_SERVICE_ACCOUNT or FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL.');
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
    adminDb = databaseId ? getFirestore(adminApp, databaseId) : getFirestore(adminApp);
    adminMessaging = getMessaging(adminApp);
  } catch (err: any) {
    console.error('[Admin] Error getting Firestore or Messaging instances:', err);
    throw new Error(`Error instantiating Firestore or Messaging: ${err.message}`);
  }

  return { db: adminDb, messaging: adminMessaging };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow only POST or GET requests depending on invocation
  const method = req.method;
  if (method !== 'POST' && method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { db, messaging } = getFirebaseAdmin();
    console.log('[FCM Daemon] Processing notification queue...');

        // 0. Reset diário: resetar sent: false em notificações daily que foram enviadas ontem ou antes
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const dailySentSnapshot = await db.collection('notificationQueue')
          .where('daily', '==', true)
          .where('sent', '==', true)
          .get();
        if (!dailySentSnapshot.empty) {
                const resetBatch = db.batch();
                let resetCount = 0;
                dailySentSnapshot.forEach((doc: any) => {
                          const data = doc.data();
                          const sentAt = data.sentAt?.toDate?.() || null;
                          // Resetar se foi enviado antes de hoje (dia anterior)
                          if (!sentAt || sentAt < todayStart) {
                                      resetBatch.update(doc.ref, { sent: false });
                                      resetCount++;
                          }
                });
                if (resetCount > 0) {
                          await resetBatch.commit();
                          console.log(`[FCM Daemon] Reset ${resetCount} notificações diárias para sent: false`);
                }
        }

                                                                                                                                                                    // 1. Fetch up to 400 unsent notifications from the queue
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
                                                                                                                                                                                                                                          const userTokens: Record<string, string> = {};
                                                                                                                                                                                                                                              fcmSnapshot.forEach((doc) => {
                                                                                                                                                                                                                                                    const data = doc.data();
                                                                                                                                                                                                                                                          if (data.token && data.userId) {
                                                                                                                                                                                                                                                                  userTokens[data.userId] = data.token;
                                                                                                                                                                                                                                                                        }
                                                                                                                                                                                                                                                                            });

                                                                                                                                                                                                                                                                                const results = { sent: 0, skipped: 0, errors: 0 };
                                                                                                                                                                                                                                                                                    const batch = db.batch();

                                                                                                                                                                                                                                                                                        // 3. Process each notification in the queue
                                                                                                                                                                                                                                                                                            for (const doc of queueSnapshot.docs) {
                                                                                                                                                                                                                                                                                                  const notification = doc.data();
                                                                                                                                                                                                                                                                                                        const token = userTokens[notification.userId];

                                                                                                                                                                                                                                                                                                              if (!token) {
                                                                                                                                                                                                                                                                                                                      console.warn(`[FCM] No token found for userId: ${notification.userId}. Skipping.`);
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
                                                                                                                                                                                                                                                                                                                                                                                                                            notification: {
                                                                                                                                                                                                                                                                                                                                                                                                                                        title: notification.title,
                                                                                                                                                                                                                                                                                                                                                                                                                                                    body: notification.body,
                                                                                                                                                                                                                                                                                                                                                                                                                                                              },
                                                                                                                                                                                                                                                                                                                                                                                                                                                                        webpush: {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    notification: {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  icon: '/icon.png',
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                badge: '/icon-badge.svg',
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            },
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        fcmOptions: {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      link: notification.link || '/',
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    });

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            batch.update(doc.ref, {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      sent: true,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                sentAt: FieldValue.serverTimestamp()
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        });
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                results.sent++;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      } catch (sendError: any) {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              console.error(`[FCM] Error sending to token ${token}:`, sendError.message);
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      batch.update(doc.ref, {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                sent: true,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          errorAt: FieldValue.serverTimestamp(),
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    errorMessage: sendError.message
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            });
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    results.errors++;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              }

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  await batch.commit();

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      console.log(`[FCM Daemon] Done. Sent: ${results.sent}, Skipped: ${results.skipped}, Errors: ${results.errors}`);

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
