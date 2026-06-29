import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const require_compat = (p: string) => JSON.parse(fs.readFileSync(path.resolve(process.cwd(), p), 'utf-8'));
const firebaseConfig = require_compat('firebase-applet-config.json');

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
    // Allow OPTIONS for CORS preflight
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

          if (!userId || !time) {
                  return res.status(400).json({ error: 'userId and time are required' });
                }

          const scheduledTime = time; // "HH:MM" format

          // Validate time format
          const timeParts = scheduledTime.split(':');
          if (timeParts.length !== 2 || isNaN(Number(timeParts[0])) || isNaN(Number(timeParts[1]))) {
                  return res.status(400).json({ error: 'Invalid time format. Use HH:MM' });
                }

          const docId = `daily_${userId.replace(/[^a-zA-Z0-9]/g, '_')}`;

          // Write notification schedule to Firestore (admin SDK bypasses security rules)
          await db.collection('notificationQueue').doc(docId).set({
                  userId,
                  title: title || 'Lembrete do Sistema',
                  body: body || 'Você tem atividades pendentes para hoje.',
                  link: link || '/',
                  scheduledTime,
                  sent: false,
                  daily: true,
                  updatedAt: FieldValue.serverTimestamp(),
                });

          console.log(`[Register] notificationQueue doc saved for ${userId} at ${scheduledTime}`);

          // If FCM token is provided, register it too
          if (token && typeof token === 'string' && token.length > 0) {
                  await db.collection('fcmTokens').doc(userId).set({
                            token,
                            userId,
                            updatedAt: FieldValue.serverTimestamp(),
                          });
                  console.log(`[Register] fcmToken saved for ${userId}`);
                }

          return res.status(200).json({
                  success: true,
                  docId,
                  message: `Notification scheduled for ${scheduledTime} daily`
                });

        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error('[Register] Error:', errorMessage);
          return res.status(500).json({ success: false, error: errorMessage });
        }
  }
