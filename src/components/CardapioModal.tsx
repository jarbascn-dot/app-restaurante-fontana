/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, FileText, Download, Loader2, ChevronLeft, ChevronRight, Utensils, Calendar, Sparkles, AlertTriangle } from 'lucide-react';
import { downloadPdfOrFile } from '../lib/downloadHelper';
import { PdfCanvasViewer } from './PdfCanvasViewer';
import { CardapioDia } from '../types';
import { parseDateString } from '../lib/cardapioUtils';

interface CardapioModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardapioUrl?: string;
  cardapioNome?: string;
  obraNome?: string;
  cardapioAtualizadoEm?: string;
  cardapioTextoIa?: string;
  cardapioDias?: CardapioDia[];
}

const DEFAULT_DAYS_FALLBACK: CardapioDia[] = [
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

// Utility helper to accurately format and check if a given cardapio day matches TODAY's date
const checkIfIsToday = (dayData: CardapioDia | null | undefined): boolean => {
  if (!dayData) return false;
  
  const now = new Date();
  const dayStr = String(now.getDate()).padStart(2, '0');
  const monthStr = String(now.getMonth() + 1).padStart(2, '0');
  const yearStr = String(now.getFullYear());
  const ddmmyyyy = `${dayStr}/${monthStr}/${yearStr}`; // e.g. "31/07/2026"
  const ddmm = `${dayStr}/${monthStr}`; // e.g. "31/07"
  const ddmmShort = `${now.getDate()}/${now.getMonth() + 1}`; // e.g. "31/7"

  // 1. If the day object has an explicit date string
  if (dayData.data) {
    const cleanData = dayData.data.trim();
    if (
      cleanData.includes(ddmmyyyy) ||
      cleanData.includes(ddmm) ||
      cleanData.includes(ddmmShort)
    ) {
      return true;
    }
    // If explicit date exists and does NOT match today, it's definitely NOT today!
    return false;
  }

  // 2. If no explicit date field exists in dayData, return false to avoid false HOJE badges
  return false;
};

// Utility helper to find the index of the date that matches TODAY or is closest to TODAY (preferring upcoming/future days)
const findBestMatchingIndex = (dias: CardapioDia[]): number => {
  if (!dias || dias.length === 0) return 0;

  // 1. First priority: Check if any item matches TODAY exactly
  const todayIdx = dias.findIndex(d => checkIfIsToday(d));
  if (todayIdx !== -1) {
    return todayIdx;
  }

  // 2. Second priority: Find first upcoming date (today or in the future)
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  let closestFutureIdx = -1;
  let minFutureDiff = Infinity;

  let closestPastIdx = -1;
  let minPastDiff = Infinity;

  dias.forEach((d, idx) => {
    const itemDateObj = parseDateString(d.data);
    if (itemDateObj) {
      const itemTime = new Date(itemDateObj.getFullYear(), itemDateObj.getMonth(), itemDateObj.getDate()).getTime();
      const diff = itemTime - todayMidnight;

      if (diff >= 0 && diff < minFutureDiff) {
        minFutureDiff = diff;
        closestFutureIdx = idx;
      } else if (diff < 0 && Math.abs(diff) < minPastDiff) {
        minPastDiff = Math.abs(diff);
        closestPastIdx = idx;
      }
    }
  });

  if (closestFutureIdx !== -1) {
    return closestFutureIdx;
  }

  if (closestPastIdx !== -1) {
    return closestPastIdx;
  }

  return 0;
};

export const CardapioModal: React.FC<CardapioModalProps> = ({
  isOpen,
  onClose,
  cardapioUrl,
  cardapioNome = 'Cardápio Oficial PDF',
  obraNome = 'Canteiro de Obras',
  cardapioAtualizadoEm,
  cardapioTextoIa,
  cardapioDias
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dia' | 'pdf'>('dia');
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);

  // List of days to display (use cardapioDias if populated, else default fallback)
  const displayDias = React.useMemo(() => {
    const rawList = (cardapioDias && cardapioDias.length > 0) ? cardapioDias : DEFAULT_DAYS_FALLBACK;
    return [...rawList].sort((a, b) => {
      const dateA = parseDateString(a.data);
      const dateB = parseDateString(b.data);
      if (dateA && dateB) return dateA.getTime() - dateB.getTime();
      if (dateA) return -1;
      if (dateB) return 1;
      return 0;
    });
  }, [cardapioDias]);

  // On modal open, automatically jump to TODAY or closest date in displayDias
  useEffect(() => {
    if (isOpen && displayDias.length > 0) {
      const bestIdx = findBestMatchingIndex(displayDias);
      setSelectedDayIndex(bestIdx);
    }
  }, [isOpen, cardapioDias]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    if (!cardapioUrl) return;
    try {
      setIsDownloading(true);
      const isDataUrl = cardapioUrl.startsWith('data:');
      await downloadPdfOrFile({
        dataUrl: isDataUrl ? cardapioUrl : undefined,
        url: cardapioUrl,
        filename: cardapioNome.endsWith('.pdf') ? cardapioNome : `${cardapioNome}.pdf`,
        title: `Cardápio — ${obraNome}`,
        mimeType: 'application/pdf',
      });
    } catch (e: any) {
      console.error('Erro ao baixar o cardápio:', e);
      alert(e?.message || 'Erro ao baixar o arquivo do cardápio.');
    } finally {
      setIsDownloading(false);
    }
  };

  const currentDayData = displayDias[selectedDayIndex] || displayDias[0];
  const isTodaySelected = checkIfIsToday(currentDayData);

  const handlePrevDay = () => {
    setSelectedDayIndex(prev => (prev > 0 ? prev - 1 : displayDias.length - 1));
  };

  const handleNextDay = () => {
    setSelectedDayIndex(prev => (prev < displayDias.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200" id="cardapio-modal-overlay">
      <div className="bg-white w-full max-w-3xl max-h-[94vh] rounded-2xl shadow-2xl border border-neutral-200 flex flex-col overflow-hidden my-auto" id="cardapio-modal-container">
        
        {/* Header Modal - Clean & Modern */}
        <div className="bg-emerald-900 text-white px-5 py-4 flex items-center justify-between border-b border-emerald-800 shrink-0 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-800 rounded-xl text-emerald-200 border border-emerald-700 shrink-0">
              <Utensils className="h-6 w-6" />
            </div>
            <div>
              <span className="bg-emerald-800 text-emerald-200 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded font-mono">
                {obraNome}
              </span>
              <h3 className="text-base sm:text-lg font-bold leading-tight mt-0.5 text-white">
                Cardápio do Restaurante
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Único Botão de Baixar PDF no Topo */}
            {cardapioUrl && (
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                title="Baixar o arquivo PDF original"
                id="btn-modal-cardapio-download-top"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <span>Baixando...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">Baixar PDF Original</span>
                    <span className="sm:hidden">Baixar PDF</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-emerald-200 hover:text-white hover:bg-emerald-800/80 rounded-xl transition cursor-pointer"
              title="Fechar visualização"
              id="btn-modal-cardapio-close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Refeições por Dia vs PDF Original) */}
        <div className="bg-neutral-100 border-b border-neutral-200 px-4 pt-2 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('dia')}
              className={`px-4 py-2.5 rounded-t-xl text-xs font-black transition flex items-center gap-2 cursor-pointer border-t border-x ${
                activeTab === 'dia'
                  ? 'bg-white text-emerald-900 border-neutral-200 shadow-2xs -mb-px'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60 border-transparent'
              }`}
            >
              <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Refeições por Dia</span>
            </button>

            {cardapioUrl && (
              <button
                type="button"
                onClick={() => setActiveTab('pdf')}
                className={`px-4 py-2.5 rounded-t-xl text-xs font-black transition flex items-center gap-2 cursor-pointer border-t border-x ${
                  activeTab === 'pdf'
                    ? 'bg-white text-emerald-900 border-neutral-200 shadow-2xs -mb-px'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60 border-transparent'
                }`}
              >
                <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Ver PDF Original</span>
              </button>
            )}
          </div>

          {cardapioAtualizadoEm && (
            <span className="text-[11px] text-neutral-500 font-medium hidden sm:inline pr-2">
              Publicado em {new Date(cardapioAtualizadoEm).toLocaleDateString('pt-BR')}
            </span>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50 flex flex-col justify-between space-y-4">
          
          {activeTab === 'dia' ? (
            <div className="space-y-4">
              
              {/* Quick Date Selector Horizontal Strip */}
              {displayDias.length > 1 && (
                <div className="bg-white rounded-2xl border border-neutral-200 p-2.5 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between px-1 text-[11px] text-neutral-500 font-semibold">
                    <span className="flex items-center gap-1.5 text-neutral-700">
                      <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Selecione a Data ({displayDias.length} dias disponíveis):</span>
                    </span>
                    <span className="font-mono text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200/60">
                      Dia {selectedDayIndex + 1} de {displayDias.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar scroll-smooth">
                    {displayDias.map((d, idx) => {
                      const isSelected = idx === selectedDayIndex;
                      const isToday = checkIfIsToday(d);
                      const shortWeek = d.diaSemana ? d.diaSemana.substring(0, 3) : '';
                      const displayDate = d.data ? d.data.replace(/\/20\d{2}$/, '') : `Dia ${idx + 1}`;

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedDayIndex(idx)}
                          className={`shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center min-w-[58px] cursor-pointer border ${
                            isSelected
                              ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                              : isToday
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100 hover:text-neutral-900'
                          }`}
                          title={`${d.diaSemana} - ${d.data || ''}`}
                        >
                          <span className="text-[10px] font-mono leading-none tracking-tight">
                            {displayDate}
                          </span>
                          <span className={`text-[9px] uppercase font-bold leading-tight mt-0.5 ${isSelected ? 'text-emerald-200' : 'text-neutral-400'}`}>
                            {shortWeek}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Centered Date Navigator with Left and Right Arrows */}
              <div className="bg-white rounded-2xl border border-neutral-200 p-2 sm:p-3 shadow-xs flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handlePrevDay}
                  className="p-2 sm:px-3.5 sm:py-2 bg-neutral-100 hover:bg-emerald-100 active:bg-emerald-200 text-neutral-800 hover:text-emerald-900 rounded-xl transition flex items-center gap-1 font-bold text-xs cursor-pointer shrink-0 border border-neutral-200 shadow-2xs"
                  title="Dia anterior"
                  id="btn-cardapio-prev-day"
                >
                  <ChevronLeft className="h-5 w-5 stroke-[2.5]" />
                  <span className="hidden sm:inline">Anterior</span>
                </button>

                {/* Centered Selected Day Display */}
                <div className="text-center flex-1 min-w-0 px-2 py-1 flex flex-col items-center justify-center">
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <h4 className="text-base sm:text-lg font-extrabold text-neutral-900 truncate">
                      {currentDayData.diaSemana}
                    </h4>
                    {isTodaySelected && (
                      <span className="bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full animate-pulse shadow-2xs">
                        HOJE
                      </span>
                    )}
                  </div>
                  {currentDayData.data && (
                    <div className="mt-1 text-xs font-bold text-emerald-900 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-lg inline-flex items-center gap-1.5 shadow-2xs">
                      <Calendar className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>Data: <strong>{currentDayData.data}</strong></span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleNextDay}
                  className="p-2 sm:px-3.5 sm:py-2 bg-neutral-100 hover:bg-emerald-100 active:bg-emerald-200 text-neutral-800 hover:text-emerald-900 rounded-xl transition flex items-center gap-1 font-bold text-xs cursor-pointer shrink-0 border border-neutral-200 shadow-2xs"
                  title="Próximo dia"
                  id="btn-cardapio-next-day"
                >
                  <span className="hidden sm:inline">Próximo</span>
                  <ChevronRight className="h-5 w-5 stroke-[2.5]" />
                </button>
              </div>

              {/* Day Menu Card Details */}
              <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs space-y-4 animate-in fade-in duration-150">
                
                {/* Dishes Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  
                  {/* Prato Principal */}
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5 md:col-span-2">
                    <div className="text-xs font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                      <span>🍲 Prato Principal (Proteína)</span>
                    </div>
                    <p className="text-sm font-black text-neutral-900 leading-snug">
                      {currentDayData.pratoPrincipal || 'Consulte o refeitório'}
                    </p>
                  </div>


                  {/* Guarnição */}
                  {currentDayData.guarnicao && (
                    <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1">
                      <div className="text-[11px] font-extrabold text-neutral-700 uppercase tracking-wider">
                        🥔 Guarnição do Dia
                      </div>
                      <p className="text-xs font-bold text-neutral-800">
                        {currentDayData.guarnicao}
                      </p>
                    </div>
                  )}

                  {/* Acompanhamentos */}
                  {currentDayData.acompanhamentos && (
                    <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1">
                      <div className="text-[11px] font-extrabold text-neutral-700 uppercase tracking-wider">
                        🍛 Acompanhamentos
                      </div>
                      <p className="text-xs font-bold text-neutral-800">
                        {currentDayData.acompanhamentos}
                      </p>
                    </div>
                  )}

                  {/* Saladas */}
                  {currentDayData.saladas && (
                    <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1">
                      <div className="text-[11px] font-extrabold text-neutral-700 uppercase tracking-wider">
                        🥗 Saladas Frescas
                      </div>
                      <p className="text-xs font-bold text-neutral-800">
                        {currentDayData.saladas}
                      </p>
                    </div>
                  )}

                  {/* Sobremesa e Suco */}
                  {(currentDayData.sobremesa || currentDayData.suco) && (
                    <div className="p-3.5 bg-amber-50/50 border border-amber-200/60 rounded-xl space-y-1 md:col-span-2">
                      <div className="text-[11px] font-extrabold text-amber-900 uppercase tracking-wider">
                        🍨 Sobremesa & Refresco
                      </div>
                      <div className="text-xs font-bold text-neutral-800 flex flex-wrap gap-x-4 gap-y-1">
                        {currentDayData.sobremesa && <span>• <strong>Sobremesa:</strong> {currentDayData.sobremesa}</span>}
                        {currentDayData.suco && <span>• <strong>Suco:</strong> {currentDayData.suco}</span>}
                      </div>
                    </div>
                  )}

                </div>

                {cardapioTextoIa && (
                  <div className="pt-2 border-t border-neutral-100 text-[11px] text-neutral-400 italic">
                    Cardápio extraído e sincronizado automaticamente via IA Gemini no upload.
                  </div>
                )}

              </div>

            </div>
          ) : (
            /* PDF Canvas Tab */
            <div className="space-y-3 flex-1 flex flex-col">
              {cardapioUrl ? (
                <div className="flex-1 min-h-[440px] bg-neutral-900 rounded-xl border border-neutral-300 overflow-hidden shadow-inner relative flex flex-col">
                  <PdfCanvasViewer
                    pdfUrl={cardapioUrl}
                    title={`${obraNome} — ${cardapioNome}`}
                    onDownload={handleDownload}
                    isDownloading={isDownloading}
                  />
                </div>
              ) : (
                <div className="py-16 px-4 text-center space-y-3 my-auto">
                  <div className="p-4 bg-amber-50 text-amber-600 rounded-full w-16 h-16 mx-auto flex items-center justify-center border border-amber-200">
                    <AlertTriangle className="h-8 w-8" />
                  </div>
                  <h4 className="font-bold text-base text-neutral-800">
                    PDF Indisponível
                  </h4>
                  <p className="text-xs text-neutral-600 max-w-md mx-auto">
                    O arquivo PDF do cardápio não está cadastrado no momento.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions - Clean */}
        <div className="p-4 bg-white border-t border-neutral-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-medium">
            <Calendar className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Cardápio Oficial — FONTANA SGR</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-neutral-800 hover:bg-neutral-900 text-white font-bold text-xs rounded-xl transition cursor-pointer"
            id="btn-modal-cardapio-close-footer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};

export default CardapioModal;
