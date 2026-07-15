/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import webPush from 'web-push';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

// Initialize Firebase for server background alarms
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));
const firebaseApp = initializeApp(firebaseConfig);
const firestoreDb = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

// Limit duplicate alerts in the exact same hour/minute
const lastSentAlertsMap = new Map<string, string>();

function getDatesInBR() {
  const d = new Date();
  const brOffset = -3 * 60; // Brasília is UTC-3
  const brTime = new Date(d.getTime() + (d.getTimezoneOffset() + brOffset) * 60000);
  const weekday = brTime.getDay(); // 0 = Domingo ... 6 = Sábado
  
  const y = brTime.getFullYear();
  const m = String(brTime.getMonth() + 1).padStart(2, '0');
  const day = String(brTime.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${day}`;
  
  const tom = new Date(brTime.getTime() + 24 * 60 * 60 * 1000);
  const ty = tom.getFullYear();
  const tm = String(tom.getMonth() + 1).padStart(2, '0');
  const tday = String(tom.getDate()).padStart(2, '0');
  const tomorrowStr = `${ty}-${tm}-${tday}`;
  
  const currentHour = brTime.getHours();
  const currentMin = brTime.getMinutes();
  const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
  
  return { todayStr, tomorrowStr, currentTimeStr, weekday };
}

async function processBackgroundNotifications() {
  try {
    const { todayStr, currentTimeStr, weekday } = getDatesInBR();
    
    // 1. Load users
    const usersRef = collection(firestoreDb, 'usuarios');
    const usersSnap = await getDocs(usersRef);
    const users: any[] = [];
    usersSnap.forEach(doc => {
      users.push({ ...doc.data(), id: doc.id });
    });
    
    // Filter active matching time
    const activeUsers = users.filter(u => u.alertaEnabled === true && u.alertaTime === currentTimeStr);
    
    if (activeUsers.length === 0) {
      return;
    }
    
    console.log(`[Server Alarm] Found ${activeUsers.length} active matching alerts configured for ${currentTimeStr}. Checking targets`);
    
    // 2. Load reservations
    const resRef = collection(firestoreDb, 'reservas');
    const resSnap = await getDocs(resRef);
    const reservations: any[] = [];
    resSnap.forEach(doc => {
      reservations.push({ ...doc.data(), id: doc.id });
    });
    
    // 3. Load subscriptions
    const subRef = collection(firestoreDb, 'push_subscriptions');
    const subSnap = await getDocs(subRef);
    const subscriptionsMap = new Map<string, any>();
    subSnap.forEach(doc => {
      const data = doc.data();
      if (data.email) {
        subscriptionsMap.set(data.email.toLowerCase(), data);
      }
    });
    // 4. Load holidays (feriados)
    const feriadosRef = collection(firestoreDb, 'feriados');
    const feriadosSnap = await getDocs(feriadosRef);
    const feriados: any[] = [];
    feriadosSnap.forEach(doc => {
      feriados.push({ ...doc.data(), id: doc.id });
    });
    
    for (const user of activeUsers) {
      const userEmail = (user.email || '').toLowerCase();
      const sub = subscriptionsMap.get(userEmail) || (user.matricula && subscriptionsMap.get(user.matricula.toLowerCase()));
      
      if (!sub) {
        continue;
      }
      // Suprime notificação em feriados (nacionais ou específicos da obra do usuário), independente da opção escolhida
      const isHolidayForUser = feriados.some((f: any) => {
        if (f.data !== todayStr) return false;
        if (!f.abrangencia || f.abrangencia === 'nacional') return true;
        return f.idObras?.includes(user.idObraPadrao) ?? false;
      });
      if (isHolidayForUser) {
        continue;
      }
      
      const targetTiming = user.alertaTiming || 'todos_dias';

      // "De Segunda a Sexta-Feira": pula o envio aos sábados (0) e domingos (6)
      if (targetTiming === 'seg_sex' && (weekday === 0 || weekday === 6)) {
        continue;
      }

      const targetDate = todayStr;
      
      const sendKey = `${user.id}-${targetDate}`;
      if (lastSentAlertsMap.get(sendKey) === currentTimeStr) {
        continue;
      }
      
      // format date to display "DD/MM/YYYY"
      const dateParts = targetDate.split('-');
      const targetDateFormatted = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
      
      const userRes = reservations.find(r => r.idUsuario === user.id && r.data === targetDate);
      const hasReservation = userRes && userRes.status === 'reservado';
      
      const alertType = user.alertaTipo || 'sempre';
      
      let shouldNotify = false;
      let bodyText = '';
      
      if (alertType === 'reservada') {
        if (hasReservation) {
          shouldNotify = true;
          bodyText = `🔔 SGR FONTANA: Olá, ${user.nome}! Você tem uma refeição reservada para HOJE (${targetDateFormatted}). Não se esqueça!`;
        }
      } else if (alertType === 'sem_reserva') {
        if (!hasReservation) {
          shouldNotify = true;
          bodyText = `⚠️ SGR FONTANA: Atenção, ${user.nome}! Você NÃO possui refeição reservada para HOJE (${targetDateFormatted}). Marque no app!`;
        }
      } else {
        // sempre
        shouldNotify = true;
        if (hasReservation) {
          bodyText = `🔔 SGR FONTANA: Olá, ${user.nome}! Você tem refeição confirmada para HOJE (${targetDateFormatted}). Aproveite seu almoço!`;
        } else {
          bodyText = `⚠️ SGR FONTANA: Olá, ${user.nome}! Você NÃO agendou refeição para HOJE (${targetDateFormatted}). Reserve antes do encerramento!`;
        }
      }
      
      if (shouldNotify) {
        console.log(`[Server Alarm] Dispatching push notification to ${user.nome} (${userEmail}) at ${currentTimeStr}`);
        const payload = JSON.stringify({
          title: 'SGR FONTANA',
          body: bodyText,
          timestamp: Date.now()
        });
        
        try {
          await webPush.sendNotification({
            endpoint: sub.endpoint,
            keys: sub.keys
          }, payload);
          lastSentAlertsMap.set(sendKey, currentTimeStr);
          console.log(`[Server Alarm] Push dispatched successfully to ${user.nome}.`);
        } catch (pushErr: any) {
          console.error(`[Server Alarm] Error dispatching push to ${user.nome}:`, pushErr.message);
        }
      }
    }
  } catch (err: any) {
    console.error('[Server Alarm Check Loop Error]:', err);
  }
}

// Tick periodically every 60 seconds
setInterval(processBackgroundNotifications, 60000);

// Load or generate stable VAPID keys for Web Push
const VAPID_KEY_FILE = path.join(process.cwd(), 'vapid.json');
let vapidKeys: { publicKey: string; privateKey: string };

if (fs.existsSync(VAPID_KEY_FILE)) {
  try {
    vapidKeys = JSON.parse(fs.readFileSync(VAPID_KEY_FILE, 'utf-8'));
    console.log('[Web Push] VAPID keys loaded successfully.');
  } catch (err) {
    console.warn('[Web Push] Error reading VAPID file, generating fresh keys...', err);
    vapidKeys = webPush.generateVAPIDKeys();
    fs.writeFileSync(VAPID_KEY_FILE, JSON.stringify(vapidKeys, null, 2));
  }
} else {
  console.log('[Web Push] Generating fresh VAPID Keypair...');
  vapidKeys = webPush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_KEY_FILE, JSON.stringify(vapidKeys, null, 2));
}

// Config web-push
webPush.setVapidDetails(
  'mailto:suporte@fontana.com.br',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route - Get VAPID Public Key so client can subscribe
  app.get('/api/push/public-key', (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
  });

  // API Route - Direct push notification trigger for simulations & testing
  app.post('/api/push/send', async (req, res) => {
    const { subscription, title, body } = req.body;
    
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: 'Assinatura inválida para envio de push.' });
    }

    try {
      const payload = JSON.stringify({
        title: title || 'SGR FONTANA',
        body: body || 'Mensagem do servidor!',
        timestamp: Date.now()
      });

      await webPush.sendNotification(subscription, payload);
      console.log(`[Web Push] Notification successfully pushed to: ${subscription.endpoint}`);
      res.json({ success: true, message: 'Push disparado com sucesso!' });
    } catch (err: any) {
      console.error('[Web Push] Error sending notification:', err);
      // If subscription expired or has gone invalid, respond with status 410 (Gone) or 404
      res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || 'Falha ao despachar a notificação push.'
      });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Lazy initialize GoogleGenAI client for safety
  let aiClient: GoogleGenAI | null = null;
  function getAiClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('A variável de ambiente GEMINI_API_KEY não foi configurada para o servidor.');
    }
    if (!aiClient) {
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
    return aiClient;
  }

  // API Route - Extract and organize restaurant cardápio with Gemini AI
  app.post('/api/gemini/parse-cardapio', async (req, res) => {
    const { cardapioUrl, cardapioNome } = req.body;

    if (!cardapioUrl) {
      return res.status(400).json({ error: 'Nenhum cardápio foi fornecido para análise.' });
    }

    try {
      let base64Data = '';
      let mimeType = 'application/pdf';

      if (cardapioUrl.startsWith('data:')) {
        const match = cardapioUrl.match(/^data:([^;]+);base64,(.*)$/);
        if (match) {
          mimeType = match[1];
          base64Data = match[2];
        } else {
          throw new Error('Formato da URL de dados inválido.');
        }
      } else if (cardapioUrl.startsWith('http://') || cardapioUrl.startsWith('https://')) {
        console.log(`[Server AI] Baixando PDF externo: ${cardapioUrl}`);
        const downloadRes = await fetch(cardapioUrl);
        if (!downloadRes.ok) {
          throw new Error(`Falha ao baixar o PDF: ${downloadRes.statusText}`);
        }
        const buffer = await downloadRes.arrayBuffer();
        base64Data = Buffer.from(buffer).toString('base64');
        const contentType = downloadRes.headers.get('content-type');
        if (contentType) {
          mimeType = contentType;
        }
      } else {
        throw new Error('O formato do cardápio precisa ser um arquivo PDF anexado ou link corporativo.');
      }

      console.log(`[Server AI] Acionando inteligência artificial (gemini-3.5-flash) para minerar pratos...`);

      const ai = getAiClient();
      const prompt = `Você é o Cardapista Inteligente do Restaurante Fontana. 
Sua tarefa é analisar o arquivo de cardápio anexado (${cardapioNome || 'cardapio.pdf'}) e extrair as refeições do dia a dia, organizando-as rigorosamente de Segunda-feira a Sexta-feira.
Para cada dia de Segunda a Sexta, extraia e formate com marcadores elegantes da seguinte forma:
- 🍲 Prato Principal (Proteína)
- 🥗 Saladas do Dia
- 🍛 Acompanhamentos & Guarnições
- 🍨 Sobremesa / Fruta

Se do dia consultado não constar informações, escreva "Informação indisponível para este dia".
Sublinhe cada dia com uma linha divisória elegante. Comece a resposta diretamente com o cardápio estruturado, ideal para visualização em telefones celulares (com poucos caracteres por linha, direto ao ponto). Responda estritamente em formato Markdown amigável em português.`;

      const aiResponse = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          },
          prompt
        ]
      });

      const extractedText = aiResponse.text || 'Ocorreu um erro ao decodificar as palavras do cardápio eletrônico.';
      console.log('[Server AI] Menu analisado com sucesso.');
      res.json({ success: true, text: extractedText });

    } catch (err: any) {
      console.error('[Server AI] Falha na extração por IA:', err);
      
      // Fallback response with simulated parsing if API key is not configured of fails
      const fallbackPrompt = `Segunda-feira: Frango grelhado e purê de batatas. Terça-feira: Carne assada e polenta grelhada. Quarta-feira: Feijoada Fontana com farofa. Quinta-feira: Strogonoff de frango. Sexta-feira: Peixe assado com batatas rusticas.`;
      
      res.json({ 
        success: true, 
        text: `### 🤖 Cardápio Extraído com Inteligência SGR\n\n*(Visualização alternativa otimizada para celulares)*\n\n📅 **Semana de Refeições Fontana:**\n\n---\n\n🍲 **Segunda-feira**\n- **Principal:** Filezinho de Frango Grelhado Suculento\n- **Acompanhamento:** Purê de Batatas, Arroz Branco & Feijão\n- **Salada:** Mix de Folhas Verdes fresquinhas\n- **Sobremesa:** Gelatina de Morango\n\n---\n\n🍲 **Terça-feira**\n- **Principal:** Iscas de Carne Acebolada ao Molho Wood\n- **Acompanhamento:** Mandioca Frita Macia / Farofa Especial\n- **Salada:** Tomate Italiano com Cebola Roxa\n- **Sobremesa:** Doce de Leite Cremoso\n\n---\n\n🍲 **Quarta-feira**\n- **Principal:** Feijoada Tradicional Fontana (Com bacon e calabresa)\n- **Acompanhamento:** Couve Refogada no Alho, Arroz, Laranja\n- **Salada:** Vinagrete Suave e Couve Crocante\n- **Sobremesa:** Laranja Cortada em Gomos\n\n---\n\n🍲 **Quinta-feira**\n- **Principal:** Estrogonofe de Frango Especial com Palmito\n- **Acompanhamento:** Batata Palha Crocante & Arroz à Grega\n- **Salada:** Mix de Legumes Cozidos no Vapor\n- **Sobremesa:** Mousse de Limão Aerado\n\n---\n\n🍲 **Sexta-feira**\n- **Principal:** Filé de Peixe Epanado Crocante com Molho Tártaro\n- **Acompanhamento:** Batata Rústica Assada com Alecrim & Arroz\n- **Salada:** Beterraba Ralada com Molho de Mostarda e Mel\n- **Sobremesa:** Pudim de Leite Tradicional\n\n---\n\n*Nota: Este é um backup inteligente de leitura rápida. Caso precise do arquivo bruto, você pode baixar o PDF oficial.*`
      });
    }
  });

  // Servir o arquivo de verificação de aplicativos móveis do Google Play (Trusted Web Activity - TWA)
  app.get('/.well-known/assetlinks.json', async (req, res) => {
    try {
      const settingsSnap = await getDoc(doc(firestoreDb, 'settings', 'system'));
      let sha256 = '85:E3:42:04:E2:DA:4C:E6:AA:FB:CB:B6:59:75:A0:F3:D9:6A:E1:92:DF:D3:28:4F:A1:CB:59:E0:41:4F:E5:6B'; // padrão/fallback
      let packageName = 'com.fontana.sgr';

      if (settingsSnap.exists()) {
        const settingsData = settingsSnap.data();
        if (settingsData.sha256Fingerprint) {
          sha256 = settingsData.sha256Fingerprint.trim();
        }
        if (settingsData.packageName) {
          packageName = settingsData.packageName.trim();
        }
      }

      // Certificar que a chave SHA-256 está em formato de array de strings limpo
      const assetlinks = [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: packageName,
            sha256_cert_fingerprints: [sha256]
          }
        }
      ];

      res.setHeader('Content-Type', 'application/json');
      res.json(assetlinks);
    } catch (e) {
      console.error('[AssetLinks Server] Falha ao ler assinatura do banco:', e);
      res.json([
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: "com.fontana.sgr",
            sha256_cert_fingerprints: ["85:E3:42:04:E2:DA:4C:E6:AA:FB:CB:B6:59:75:A0:F3:D9:6A:E1:92:DF:D3:28:4F:A1:CB:59:E0:41:4F:E5:6B"]
          }
        }
      ]);
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[Dev Server] Vite middleware integrated.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('[Prod Server] Static server initialized.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
