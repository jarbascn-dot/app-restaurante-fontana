import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('A variável de ambiente GEMINI_API_KEY não foi configurada na Vercel.');
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { cardapioUrl, cardapioNome } = req.body || {};

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
      console.log(`[Vercel Serverless AI] Baixando PDF externo: ${cardapioUrl}`);
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
      throw new Error('O formato do cardápio precisa ser um arquivo PDF anexado ou link.');
    }

    console.log(`[Vercel Serverless AI] Acionando inteligência artificial Gemini para minerar cardápio...`);

    const ai = getAiClient();
    const prompt = `Você é um especialista em nutrição e extração de dados corporativos para o Restaurante Fontana.
Analise com extrema precisão o arquivo de cardápio do PDF/Imagem fornecido (${cardapioNome || 'cardapio.pdf'}).

INSTRUÇÕES CRÍTICAS DE EXTRAÇÃO:
1. Extraia RIGOROSAMENTE TODOS os dias e datas presentes em TODAS as páginas e seções do documento (sem exceção).
   - O documento pode conter múltiplas páginas (ex: Página 1 com 31/08 a 18/09 e Página 2 com 21/09 a 30/09).
   - Analise TODAS as páginas, colunas, blocos e tabelas de ponta a ponta. É terminantemente PROIBIDO parar na primeira página ou resumir.
   - Extraia TODOS os 20 a 31 dias contidos no documento completo (ex: de 31/08/2026 até 30/09/2026).
2. Cada data encontrada no documento DEVE ser um elemento individual no array "dias", em ordem cronológica.
3. Para cada dia, capture:
   - "diaSemana": Nome completo do dia em português (ex: "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo").
   - "data": A data exata no formato "DD/MM/AAAA" ou "DD/MM" (ex: "18/08/2026", "01/09/2026", "02/09/2026", etc.).
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
      "data": "01/09/2026",
      "pratoPrincipal": "Cubos Bovino ao Molho / Omelete de Frios na Chapa",
      "guarnicao": "Bolinho de Arroz",
      "acompanhamentos": "Arroz Parboilizado, Feijão, Penne com Molho Pomarolla",
      "saladas": "Salada Verde, Pepino, Tomate, Beterraba Cozida",
      "sobremesa": "",
      "suco": "Suco Natural de Laranja",
      "observacoes": ""
    }
  ]
}`;

    let aiResponse: any = null;
    const modelsToTry = ['gemini-3.7-flash', 'gemini-2.5-flash'];
    let lastErr: any = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`[Vercel Serverless AI] Tentando modelo ${modelName}...`);
        aiResponse = await ai.models.generateContent({
          model: modelName,
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
        if (aiResponse) break;
      } catch (mErr: any) {
        lastErr = mErr;
        console.warn(`[Vercel Serverless AI] Falha com ${modelName}:`, mErr?.message || mErr);
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }

    if (!aiResponse) {
      throw lastErr || new Error('Não foi possível obter resposta dos modelos de IA no momento.');
    }

    let parsedJson: any = null;
    try {
      if (aiResponse.text) {
        parsedJson = JSON.parse(aiResponse.text.trim());
      }
    } catch (pErr) {
      console.warn('[Vercel Serverless AI] Erro ao parsear JSON:', pErr);
    }

    const extractedText = parsedJson?.textoMarkdown || aiResponse.text || 'Cardápio processado com sucesso.';
    const dias = parsedJson?.dias || [];

    console.log(`[Vercel Serverless AI] Extração concluída. ${dias.length} dias extraídos.`);
    return res.status(200).json({ success: true, text: extractedText, dias });

  } catch (err: any) {
    console.error('[Vercel Serverless AI] Falha na extração:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Erro ao processar cardápio com IA'
    });
  }
}
