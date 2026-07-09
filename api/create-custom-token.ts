import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../firebase-applet-config.json' with { type: "json" };

// Lazy-initialized Firebase Admin variables
let adminApp: App | null = null;

function getFirebaseAdmin() {
  if (adminApp) {
    return { auth: getAuth(adminApp) };
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    } else {
    const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
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

    if (serviceAccount) {
      try {
        adminApp = initializeApp({
            credential: cert(serviceAccount)
            });
        console.log('[Admin] create-custom-token: Initialized Firebase Admin SDK with service account credentials.');
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
                throw new Error('Firebase Admin credentials are required. Please configure FIREBASE_SERVICE_ACCOUNT.');
                }
                }
                }

                  return { auth: getAuth(adminApp) };
                }

                  /**
                  * Endpoint used by the web app (running inside the native Android WebView) to obtain
                  * a Firebase Custom Token for the SAME uid as the currently signed-in web session.
                    *
                    * Flow:
                    * 1. The logged-in web app sends its current Firebase ID Token in the Authorization header.
                    * 2. This endpoint verifies that ID Token with the Admin SDK (proves the caller really owns that uid).
                    * 3. It mints a short-lived custom token for that same uid.
                      * 4. The web app hands that custom token to the native Android bridge (SGRNativeBridge),
                      * which uses it to sign in to the NATIVE Firebase Auth SDK with signInWithCustomToken.
                      * This makes the native app's request.auth.uid match the web session's uid, satisfying
                      * firestore.rules (isSignedIn/isOwner) so the FCM token can finally be written to fcmTokens/{uid}.
                      */
                      export default async function handler(req: VercelRequest, res: VercelResponse) {
                        if (req.method !== 'POST') {
                            return res.status(405).json({ error: 'Method Not Allowed' });
                          }

                          try {
                            const authHeader = req.headers['authorization'] || '';
                              const rawHeader = Array.isArray(authHeader) ? authHeader[0] : authHeader;
                              const token = rawHeader.startsWith('Bearer ') ? rawHeader.slice(7) : rawHeader;

                                if (!token) {
                                  return res.status(401).json({ error: 'Missing Authorization Bearer ID token.' });
                                }

                                const { auth } = getFirebaseAdmin();

                                const decoded = await auth.verifyIdToken(token);
                                const customToken = await auth.createCustomToken(decoded.uid);

                                return res.status(200).json({ success: true, customToken });
                                } catch (err: any) {
                                  console.error('[create-custom-token] Error:', err);
                                  return res.status(401).json({ error: 'Invalid or expired ID token.' });
                                }
                              }
                                
