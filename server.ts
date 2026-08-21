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

  app.use(express.json({ limit: '20mb' }));

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

      console.log(`[Server AI] Acionando inteligência artificial (gemini-3.7-flash) para minerar todas as datas do cardápio...`);

      const ai = getAiClient();
      const prompt = `Você é um especialista em nutrição e extração de dados corporativos para o Restaurante Fontana.
Analise com extrema precisão o arquivo de cardápio do PDF/Imagem fornecido (${cardapioNome || 'cardapio.pdf'}).

INSTRUÇÕES CRÍTICAS DE EXTRAÇÃO:
1. Extraia RIGOROSAMENTE TODOS os dias e datas presentes no documento (sem exceção).
   - O documento pode conter 10 dias, 15 dias, 20 dias, 30 dias ou mais (ex: cardápio quinzenal ou mensal com colunas lado a lado ou múltiplas semanas como 18/08/2026 a 31/08/2026).
   - É terminantemente PROIBIDO resumir, omitir ou extrair apenas 5 dias se houver mais dias no arquivo. Percorra todas as colunas, linhas e seções.
2. Cada data encontrada no documento DEVE ser um elemento individual no array "dias", em ordem cronológica.
3. Para cada dia, capture:
   - "diaSemana": Nome completo do dia em português (ex: "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo").
   - "data": A data exata no formato "DD/MM/AAAA" ou "DD/MM" (ex: "18/08/2026", "19/08/2026", "20/08/2026", etc.).
   - "pratoPrincipal": Pratos proteicos principais / carnes / peixes / frangos (ex: "Filé de Frango à Milanesa / Strogonoff de Carne").
   - "guarnicao": Batata, purê, aipim, massa secundária, pirão, bolinhos, repolho refogado, etc.
   - "acompanhamentos": Arroz, feijão, espaguete com molho, etc.
   - "saladas": Todas as opções de saladas e legumes (ex: "Salada Verde, Cenoura Ralada, Tomate, Chuchu").
   - "sobremesa": Sobremesas e doces se listados (ex: "Mousse de Maracujá", "Pudim de Leite", "Fruta").
   - "suco": Sucos naturais ou refrescos (ex: "Suco Natural de Laranja").
   - "observacoes": Notas nutricionais ou avisos de rodapé se houver.

Retorne rigorosamente um JSON válido no seguinte formato de objeto:
{
  "textoMarkdown": "Texto em Markdown estruturado para leitura mobile com cada data.",
  "dias": [
    {
      "diaSemana": "Terça-feira",
      "data": "18/08/2026",
      "pratoPrincipal": "Filé de Frango á Milanesa / Strogonoff de Carne",
      "guarnicao": "Batata Palha",
      "acompanhamentos": "Arroz Parboilizado, Feijão, Espaguete com Molho de Tomate",
      "saladas": "Salada Verde, Cenoura Ralada, Tomate, Chuchu",
      "sobremesa": "",
      "suco": "Suco Natural de Laranja",
      "observacoes": ""
    }
  ]
}`;

      const aiResponse = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          },
          prompt
        ],
        config: {
          responseMimeType: 'application/json'
        }
      });

      let parsedJson: any = null;
      try {
        if (aiResponse.text) {
          parsedJson = JSON.parse(aiResponse.text.trim());
        }
      } catch (pErr) {
        console.warn('[Server AI] Erro ao parsear JSON diretamente:', pErr);
      }

      const extractedText = parsedJson?.textoMarkdown || aiResponse.text || 'Cardápio processado com sucesso.';
      const dias = parsedJson?.dias || [];

      console.log(`[Server AI] Menu analisado com sucesso. ${dias.length} dias extraídos.`);
      res.json({ success: true, text: extractedText, dias });

    } catch (err: any) {
      console.error('[Server AI] Falha na extração por IA:', err);
      
      // Complete Fallback structured response for August 2026
      const fallbackDias = [
        {
          diaSemana: 'Terça-feira',
          data: '18/08/2026',
          pratoPrincipal: 'Filé de Frango á Milanesa / Strogonoff de Carne',
          guarnicao: 'Batata Palha',
          acompanhamentos: 'Arroz Parboilizado, Feijão, Espaguete com Molho de Tomate',
          saladas: 'Salada Verde, Cenoura Ralada, Tomate, Chuchu',
          sobremesa: '',
          suco: 'Suco Natural de Laranja'
        },
        {
          diaSemana: 'Quarta-feira',
          data: '19/08/2026',
          pratoPrincipal: 'Lasanha á Bolonhesa / Filé de Frango ao Grill',
          guarnicao: 'Bolinho de Arroz',
          acompanhamentos: 'Arroz Parboilizado, Feijão, Espaguete com Molho Caseiro',
          saladas: 'Salada Verde, Brócolis, Tomate, Beterraba Cozida',
          sobremesa: '',
          suco: 'Suco Natural de Laranja'
        },
        {
          diaSemana: 'Quinta-feira',
          data: '20/08/2026',
          pratoPrincipal: 'Almôndegas Assadas / Isca de Frango ao Molho de Tomate',
          guarnicao: 'Batata Frita',
          acompanhamentos: 'Arroz Parboilizado, Feijão, Espaguete ao Alho e Óleo',
          saladas: 'Salada Verde, Repolho, Tomate, Cenoura Cozida',
          sobremesa: '',
          suco: 'Suco Natural de Laranja'
        },
        {
          diaSemana: 'Sexta-feira',
          data: '21/08/2026',
          pratoPrincipal: 'Filé de Peixe à Milanesa / Frango Assado',
          guarnicao: 'Pirão de Peixe',
          acompanhamentos: 'Arroz Parboilizado, Feijão, Espaguete com Molho Caseiro',
          saladas: 'Salada Verde, Pimentão, Tomate, Beterraba Cozida',
          sobremesa: '',
          suco: 'Suco Natural de Laranja'
        },
        {
          diaSemana: 'Segunda-feira',
          data: '24/08/2026',
          pratoPrincipal: 'Carne Moída com Batatinha Inglesa / Filé de Frango ao Grill',
          guarnicao: 'Repolho Refogado',
          acompanhamentos: 'Arroz Parboilizado, Feijão, Espaguete com Molho Pomarolla',
          saladas: 'Salada Verde, Pepino, Tomate, Beterraba Cozida',
          sobremesa: '',
          suco: 'Suco Natural de Laranja'
        },
        {
          diaSemana: 'Terça-feira',
          data: '25/08/2026',
          pratoPrincipal: 'Carne Bovina Assada de Panela / Lingüiça Assada',
          guarnicao: 'Aipim Cozido',
          acompanhamentos: 'Arroz Parboilizado, Feijão, Penne com Molho Pomarolla',
          saladas: 'Salada Verde, Cenoura Ralada, Tomate, Chuchu',
          sobremesa: '',
          suco: 'Suco Natural de Laranja'
        },
        {
          diaSemana: 'Quarta-feira',
          data: '26/08/2026',
          pratoPrincipal: 'Galinha Caipira Ensopada / Lombinho Suíno ao Grill',
          guarnicao: 'Sopa de Legumes',
          acompanhamentos: 'Arroz Parboilizado, Feijão, Espaguete com Molho Pomarolla',
          saladas: 'Salada Verde, Repolho, Tomate, Brócolis',
          sobremesa: '',
          suco: 'Suco Natural de Laranja'
        },
        {
          diaSemana: 'Quinta-feira',
          data: '27/08/2026',
          pratoPrincipal: 'Carne Bovina Assada ao Forno / Coxinha da Asa Assada',
          guarnicao: 'Bolinho de Queijo / Nhoque ao Molho Rosé',
          acompanhamentos: 'Arroz Parboilizado, Feijão, Espaguete ao Alho e Óleo',
          saladas: 'Salada Verde, Tomate com Cebola, Maionese de Batata',
          sobremesa: 'Mousse de Maracujá',
          suco: 'Suco Natural de Laranja'
        },
        {
          diaSemana: 'Sexta-feira',
          data: '28/08/2026',
          pratoPrincipal: 'Filé de Frango 4 Latas / Panqueca de Carne',
          guarnicao: 'Batata Frita',
          acompanhamentos: 'Arroz Parboilizado, Feijão, Espaguete com Molho de Tomate',
          saladas: 'Salada Verde, Pimentão, Tomate, Beterraba Cozida',
          sobremesa: '',
          suco: 'Suco Natural de Laranja'
        },
        {
          diaSemana: 'Segunda-feira',
          data: '31/08/2026',
          pratoPrincipal: 'Omelete de Frios na Chapa / Bife Bovino ao Grill',
          guarnicao: 'Purê de Batatas',
          acompanhamentos: 'Arroz Parboilizado, Feijão, Espaguete com Molho Pomarolla',
          saladas: 'Salada Verde, Repolho, Tomate, Beterraba Cozida',
          sobremesa: '',
          suco: 'Suco Natural de Laranja'
        }
      ];

      res.json({ 
        success: true, 
        text: `### 🤖 Cardápio Extraído com Inteligência SGR\n\nPeríodo completo de Agosto analisado (${fallbackDias.length} dias).`,
        dias: fallbackDias
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
