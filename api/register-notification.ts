import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const firebaseConfig = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf-8')
    );

let app: App;
const existingApps = getApps();
if (existingApps.length === 0) {
      const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (serviceAccountEnv) {
              try {
                        app = initializeApp({ credential: cert(JSON.parse(serviceAccountEnv)) });
              } catch (e) {
                        app = initializeApp({ projectId: firebaseConfig.projectId });
              }
      } else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
              app = initializeApp({
                        credential: cert({
                                    projectId: firebaseConfig.projectId,
                                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                        })
              });
      } else {
              app = initializeApp({ projectId: firebaseConfig.projectId });
      }
} else {
      app = existingApps[0];
}

const db = getFirestore(app);

export default async function handler(req: VercelRequest, res: VercelResponse) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
          return res.status(200).end();
  }

  if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
          const { userId, time, title, body, link, token } = req.body;

        if (!userId) {
                  return res.status(400).json({ error: 'userId is required' });
        }

        const results: Record<string, string> = {};

        // Save notification schedule to notificationQueue (if time is provided and valid)
        if (time && typeof time === 'string' && time.includes(':')) {
                  const timeParts = time.split(':');
                  const hour = Number(timeParts[0]);
                  const minute = Number(timeParts[1]);

            if (!isNaN(hour) && !isNaN(minute) && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
                        const docId = `daily_${userId.replace(/[^a-zA-Z0-9]/g, '_')}`;

                    await db.collection('notificationQueue').doc(docId).set({
                                  userId,
                                  title: title || 'Lembrete do Sistema',
                                  body: body || 'Você tem atividades pendentes para hoje.',
                                  link: link || '/',
                                  scheduledTime: time,
                                  sent: false,
                                  daily: true,
                                  updatedAt: FieldValue.serverTimestamp(),
                    });

                    console.log(`[Register] notificationQueue/${docId} saved for ${userId} at ${time}`);
                        results.notificationQueue = docId;
            } else {
                        console.warn(`[Register] Invalid time "${time}" for userId ${userId} - skipping queue`);
            }
        }

        // Save FCM token to fcmTokens (if token is provided)
        if (token && typeof token === 'string' && token.length > 10) {
                  await db.collection('fcmTokens').doc(userId).set({
                              token,
                              userId,
                              updatedAt: FieldValue.serverTimestamp(),
                  });
                  console.log(`[Register] fcmTokens/${userId} saved`);
                  results.fcmToken = 'saved';
        }

        if (Object.keys(results).length === 0) {
                  return res.status(400).json({ error: 'No valid data to register. Provide time and/or token.' });
        }

        return res.status(200).json({
                  success: true,
                  ...results,
                  message: 'Registration successful'
        });

  } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error('[Register] Error:', errorMessage);
          return res.status(500).json({ success: false, error: errorMessage });
  }
}
