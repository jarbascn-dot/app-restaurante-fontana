/**
 * Utilitários para merge inteligente, ordenação cronológica e janela rolante de cardápios.
 */

import { CardapioDia } from '../types';

/**
 * Converte data em string ("DD/MM/AAAA", "DD/MM/AA", "DD/MM") para objeto Date comparável
 */
export function parseDateString(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const match = dateStr.trim().match(/^(\d{1,2})[\/\.-](\d{1,2})(?:[\/\.-](\d{2,4}))?/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1; // 0-indexed
  const currentYear = new Date().getFullYear();
  let year = match[3] ? parseInt(match[3], 10) : currentYear;
  if (year < 100) year += 2000;

  const d = new Date(year, month, day);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Normaliza chave de data para formato canônico "DD/MM/AAAA"
 */
export function normalizeDateKey(dateStr: string | undefined): string {
  const parsed = parseDateString(dateStr);
  if (!parsed) return (dateStr || '').trim();
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Mescla cardápios novos com os existentes mantendo uma janela rolante de 2 meses:
 * - Mantém o mês mais recente (atual da importação) e o mês imediatamente anterior.
 * - Substitui dias já existentes com os pratos atualizados do novo lote.
 * - Remove automaticamente dados de meses mais antigos (meses retrasados).
 * - Retorna a lista 100% ordenada cronologicamente.
 */
export function mergeCardapiosRollingWindow(
  existingDias: CardapioDia[] = [],
  newDias: CardapioDia[] = []
): CardapioDia[] {
  if (!newDias || newDias.length === 0) return existingDias || [];

  // 1. Determina a data máxima (ano/mês) presente no lote novo
  let latestDate: Date | null = null;
  for (const d of newDias) {
    const parsed = parseDateString(d.data);
    if (parsed && (!latestDate || parsed.getTime() > latestDate.getTime())) {
      latestDate = parsed;
    }
  }

  // Se não foi possível detectar data no lote novo, usa a data atual
  if (!latestDate) {
    latestDate = new Date();
  }

  // Define o limite inferior de retenção: início do mês anterior ao mês do cardápio mais recente
  const targetYear = latestDate.getFullYear();
  const targetMonth = latestDate.getMonth(); // 0-11
  // Início do mês anterior (ex: se target é Setembro (8), cutoff é 1º de Agosto (7))
  const cutoffDate = new Date(targetYear, targetMonth - 1, 1, 0, 0, 0);

  // 2. Mapa indexado por data normalizada para mesclar
  const mapByDate = new Map<string, CardapioDia>();

  // Adiciona os dias existentes válidos dentro da janela de 2 meses
  for (const d of existingDias) {
    const parsed = parseDateString(d.data);
    if (parsed) {
      if (parsed.getTime() >= cutoffDate.getTime()) {
        const key = normalizeDateKey(d.data);
        mapByDate.set(key, { ...d });
      }
    } else {
      // Se não tem data parseável mas existe, preserva
      const key = (d.data || d.diaSemana || JSON.stringify(d)).trim();
      mapByDate.set(key, { ...d });
    }
  }

  // Sobrescreve / adiciona com os dias novos
  for (const d of newDias) {
    const key = normalizeDateKey(d.data);
    mapByDate.set(key, { ...d });
  }

  // 3. Converte para array e ordena cronologicamente
  const mergedList = Array.from(mapByDate.values());

  mergedList.sort((a, b) => {
    const dateA = parseDateString(a.data);
    const dateB = parseDateString(b.data);
    if (dateA && dateB) {
      return dateA.getTime() - dateB.getTime();
    }
    if (dateA) return -1;
    if (dateB) return 1;
    return 0;
  });

  return mergedList;
}
