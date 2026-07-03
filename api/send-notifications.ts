import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import webpush from 'web-push';
import firebaseConfig from '../firebase-applet-config.json' with { type: "json" };

// Lazy-initialized Firebase Admin variables
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
                        const cleaned = serviceAccountEnv.trim().replace(/^["']["']$/g, '');
                        serviceAccount = JSON.parse(cleaned);
              } catch (e: any) {
                        console.error('[Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', e.message);
              }
      }

      if (!serviceAccount && privateKey && clientEmail && projectId) {
              serviceAccount = {
                        projectId,
                        clientEmail,
                        privateKey: privateKey.replace(/\\n/g, '\n'),
              };
      }

      if (!serviceAccount) {
              throw new Error('Firebase Admin credentials not configured. Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_PRIVATE_KEY + FIREBASE_CLIENT_EMAIL + FIREBASE_PROJECT_ID.');
      }

      const { cert } = require('firebase-admin/app');
          adminApp = initializeApp({ credential: cert(serviceAccount) });
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
  } catch (err: any) {
        console.error('[Admin] Error getting Firestore instance:', err);
        throw new Error(`Error instantiating Firestore: ${err.message}`);
  }

  return { db: adminDb };
}

// Configure VAPID for web-push (reads from env vars or vapid.json fallback)
function configureWebPush() {
        let publicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_FIREBASE_VAPID_KEY;
        let privateKey = process.env.VAPID_PRIVATE_KEY;
        const contact = process.env.VAPID_CONTACT || 'mailto:admin@estilofontana.com.br';

        // Fallback: read from public/vapid.json if env vars not set
        if (!publicKey || !privateKey) {
                    try {
                                    const fs = require('fs');
                                    const path = require('path');
                                    const vapidPath = path.join(process.cwd(), 'public', 'vapid.json');
                                    if (fs.existsSync(vapidPath)) {
                                                        const vapidData = JSON.parse(fs.readFileSync(vapidPath, 'utf-8'));
                                                        if (!publicKey && vapidData.publicKey) publicKey = vapidData.publicKey;
                                                        if (!privateKey && vapidData.privateKey) privateKey = vapidData.privateKey;
                                                        console.log('[WebPush] Loaded VAPID keys from public/vapid.json');
                                    }
                    } catch (e: any) {
                                    console.warn('[WebPush] Could not read vapid.json:', e.message);
                    }
        }

        if (!publicKey || !privateKey) {
                    console.warn('[WebPush] VAPID keys not available. Push notifications will be skipped.');
                    return false;
        }

        webpush.setVapidDetails(contact, publicKey, privateKey);
        return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Allow only POST or GET requests depending on invocation
  const method = req.method;
    if (method !== 'POST' && method !== 'GET') {
          return res.status(405).json({ error: 'Method Not Allowed' });
    }

  try {
        const { db } = getFirebaseAdmin();
        const vapidReady = configureWebPush();
        console.log('[FCM Daemon] Processing notification queue...');

      // 1. Fetch up to 400 unsent notifications from the queue
      const queueSnapshot = await db.collection('notificationQueue')
          .where('sent', '==', false)
          .limit(400)
          .get();

      if (queueSnapshot.empty) {
              console.log('[FCM Daemon] No pending notifications.');
              return res.status(200).json({ message: 'No pending notifications.' });
      }

      const now = new Date();
        const nowHHMM = `${String(now.getUTCHours()).padStart(2,'0')}:${String(now.getUTCMinutes()).padStart(2,'0')}`;
        // Also check Brazil time (UTC-3)
      const brazilOffset = -3 * 60;
        const brazilDate = new Date(now.getTime() + brazilOffset * 60000);
        const brazilHHMM = `${String(brazilDate.getUTCHours()).padStart(2,'0')}:${String(brazilDate.getUTCMinutes()).padStart(2,'0')}`;

      console.log(`[FCM Daemon] Current UTC time: ${nowHHMM} | Brazil time (UTC-3): ${brazilHHMM}`);

      let sent = 0;
        let skipped = 0;
        let errors = 0;

      for (const docSnap of queueSnapshot.docs) {
              const data = docSnap.data();
              const { userId, scheduledTime, title, body, link } = data;

          // 2. Check if it is time to send (compare scheduledTime with current Brazil time)
          if (scheduledTime && scheduledTime !== brazilHHMM && scheduledTime !== nowHHMM) {
                    // Not yet time — skip silently without marking sent
                continue;
          }

          if (!vapidReady) {
                    console.warn(`[FCM Daemon] Skipping ${userId} - VAPID not configured`);
                    await docSnap.ref.update({
                                sent: true,
                                sentAt: FieldValue.serverTimestamp(),
                                skipReason: 'no_vapid_config',
                                skippedAt: FieldValue.serverTimestamp(),
                    });
                    skipped++;
                    continue;
          }

          // 3. Fetch Web Push subscriptions for this user from push_subscriptions
          const subQuery = await db.collection('push_subscriptions')
                .where('email', '==', userId)
                .get();

          if (subQuery.empty) {
                    console.warn(`[FCM Daemon] No push subscription found for ${userId}`);
                    await docSnap.ref.update({
                                sent: true,
                                sentAt: FieldValue.serverTimestamp(),
                                skipReason: 'no_subscription',
                                skippedAt: FieldValue.serverTimestamp(),
                    });
                    skipped++;
                    continue;
          }

          // 4. Send notification to all subscriptions for this user
          let atLeastOneSent = false;
              for (const subDoc of subQuery.docs) {
                        const sub = subDoc.data();

                if (!sub.endpoint || !sub.keys?.auth || !sub.keys?.p256dh) {
                            console.warn(`[FCM Daemon] Incomplete subscription for ${userId}:`, subDoc.id);
                            continue;
                }

                const pushSubscription = {
                            endpoint: sub.endpoint,
                            keys: {
                                          auth: sub.keys.auth,
                                          p256dh: sub.keys.p256dh,
                            },
                };

                const payload = JSON.stringify({
                            title: title || 'SGR Fontana',
                            body: body || 'Lembrete: verifique suas refeições.',
                            link: link || '/',
                            icon: '/icon.png',
                            badge: '/icon-badge.svg',
                });

                try {
                            await webpush.sendNotification(pushSubscription, payload);
                            atLeastOneSent = true;
                            console.log(`[FCM Daemon] Push sent to ${userId} via subscription ${subDoc.id}`);
                } catch (pushErr: any) {
                            console.error(`[FCM Daemon] Failed to send push to ${subDoc.id}:`, pushErr.statusCode, pushErr.message);
                            // If subscription is expired/invalid (410 Gone or 404), remove it
                          if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                                        await subDoc.ref.delete();
                                        console.log(`[FCM Daemon] Removed expired subscription ${subDoc.id}`);
                          }
                            errors++;
                }
              }

          // 5. Mark notification as sent only if at least one delivery succeeded
          if (atLeastOneSent) {
                    await docSnap.ref.update({
                                sent: true,
                                sentAt: FieldValue.serverTimestamp(),
                                skipReason: FieldValue.delete(),
                                skippedAt: FieldValue.delete(),
                    });
                    sent++;
          } else {
                    // Keep sent=false so it will retry next minute, but record the attempt
                await docSnap.ref.update({
                            lastAttemptAt: FieldValue.serverTimestamp(),
                            skipReason: 'delivery_failed',
                });
          }
      }

      console.log(`[FCM Daemon] Done. Sent: ${sent}, Skipped: ${skipped}, Errors: ${errors}`);
        return res.status(200).json({ sent, skipped, errors });

  } catch (err: any) {
        console.error('[FCM Daemon] Fatal error:', err.message);
        return res.status(500).json({ error: err.message });
  }
}
