import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import webpush from 'web-push';
import firebaseConfig from '../firebase-applet-config.json' with { type: "json" };

// Lazy-initialized Firebase Admin variables
let adminApp: App | null = null;
let adminDb: any = null;

// Configure VAPID keys for Web Push
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BNcanqXhEdrcsTPSCQQsNVJjAcmAvFBzji-tI-TDZqRhC2Nig6VDUAPPnbqlgAFwMTi3yCj6ktqKSD6D949Dv2s';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'gkJzf_qjZNE1K20XecWwt9WOMhAirijQk89g-f5E_Gg';

webpush.setVapidDetails(
    'mailto:admin@estilofontana.com.br',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );

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
                        const cleaned = serviceAccountEnv.trim().replace(/^["']["']$/g, '');
                        serviceAccount = JSON.parse(cleaned);
              } catch (e: any) {
                        console.error('[Admin] Error parsing FIREBASE_SERVICE_ACCOUNT env var:', e);
              }
      }

      if (serviceAccount && privateKey && clientEmail) {
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
                  databaseId = undefined; // uses default database in production Vercel
          } else {
                  databaseId = firebaseConfig.firestoreDatabaseId;
          }
    }

  try {
        adminDb = databaseId ? getFirestore(adminApp!, databaseId) : getFirestore(adminApp!);
  } catch (err: any) {
        console.error('[Admin] Error getting Firestore:', err);
        throw err;
  }

  return { db: adminDb };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET' && req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
    }

  try {
        const { db } = getFirebaseAdmin();
        console.log('[FCM Daemon] Processing notification queue...');

      // 0. Reset diario: resetar sent: false em notificacoes daily que foram enviadas ontem ou antes
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
                          console.log(`[FCM Daemon] Reset ${resetCount} notificacoes diarias para sent: false`);
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

      // 2. Fetch all Web Push subscriptions to map email -> subscription
      const pushSubsSnapshot = await db.collection('push_subscriptions').get();
        const userSubscriptions: Record<string, any> = {};
        pushSubsSnapshot.forEach((doc: any) => {
                const data = doc.data();
                if (data.email && data.endpoint && data.keys) {
                          userSubscriptions[data.email] = {
                                      endpoint: data.endpoint,
                                      keys: {
                                                    auth: data.keys.auth,
                                                    p256dh: data.keys.p256dh
                                      }
                          };
                }
        });

      console.log(`[FCM Daemon] Found ${Object.keys(userSubscriptions).length} Web Push subscriptions`);

      // 3. Process each notification
      const batch = db.batch();
        let sentCount = 0;
        let skippedCount = 0;
        const errors: string[] = [];

      const notifications = queueSnapshot.docs.map((doc: any) => ({
              id: doc.id,
              ref: doc.ref,
              data: doc.data()
      }));

      for (const notification of notifications) {
              const { id, ref, data } = notification;

          // Check scheduled time
          const now = new Date();
              const scheduledTime = data.scheduledTime;
              if (scheduledTime) {
                        const [hours, minutes] = scheduledTime.split(':').map(Number);
                        const scheduledDate = new Date();
                        scheduledDate.setHours(hours, minutes, 0, 0);
                        // Allow 5 minutes window
                const diffMs = now.getTime() - scheduledDate.getTime();
                        if (diffMs < -60000 || diffMs > 300000) {
                                    console.log(`[FCM Daemon] Notification ${id} not yet due (scheduled: ${scheduledTime}, now: ${now.toTimeString().slice(0,5)})`);
                                    continue;
                        }
              }

          const userId = data.userId;
              const subscription = userSubscriptions[userId];

          if (!subscription) {
                    console.warn(`[FCM Daemon] No Web Push subscription found for userId: ${userId}`);
                    batch.update(ref, {
                                sent: true,
                                skipReason: 'no_token',
                                skippedAt: FieldValue.serverTimestamp()
                    });
                    skippedCount++;
                    continue;
          }

          // Build notification payload
          const title = data.title || 'Restaurante Fontana';
              const body = data.body || data.message || 'Voce tem uma notificacao pendente.';
              const payload = JSON.stringify({
                        title,
                        body,
                        icon: '/icon.png',
                        badge: '/icon-badge.svg',
                        data: {
                                    url: data.url || '/',
                                    notificationId: id
                        }
              });

          try {
                    await webpush.sendNotification(subscription, payload);
                    batch.update(ref, {
                                sent: true,
                                sentAt: FieldValue.serverTimestamp()
                    });
                    sentCount++;
                    console.log(`[FCM Daemon] Notification sent to ${userId}`);
          } catch (err: any) {
                    console.error(`[FCM Daemon] Error sending to ${userId}:`, err.message);
                    errors.push(`${userId}: ${err.message}`);

                // If subscription is expired/invalid (410 Gone or 404), mark as sent to avoid retry loops
                if (err.statusCode === 410 || err.statusCode === 404) {
                            batch.update(ref, {
                                          sent: true,
                                          skipReason: 'subscription_expired',
                                          skippedAt: FieldValue.serverTimestamp()
                            });
                            skippedCount++;
                }
          }
      }

      if (sentCount > 0 || skippedCount > 0) {
              await batch.commit();
      }

      const result = {
              success: true,
              sent: sentCount,
              skipped: skippedCount,
              errors: errors.length > 0 ? errors : undefined
      };

      console.log('[FCM Daemon] Done:', result);
        return res.status(200).json(result);

  } catch (err: any) {
        console.error('[FCM Daemon] Fatal error:', err);
        return res.status(500).json({
                success: false,
                error: err.message
        });
  }
}
