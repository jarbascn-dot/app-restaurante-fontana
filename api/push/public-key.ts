import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const vapidKeyPath = path.join(process.cwd(), 'vapid.json');
    if (!fs.existsSync(vapidKeyPath)) {
      return res.status(404).json({ error: 'vapid.json not found' });
    }

    const data = JSON.parse(fs.readFileSync(vapidKeyPath, 'utf-8'));
    return res.status(200).json({ publicKey: data.publicKey });
  } catch (error: any) {
    console.error('[VAPID API] Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}
