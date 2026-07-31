/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, FileText, Download, AlertTriangle, Loader2, Check, Maximize2, Minimize2, ChevronLeft } from 'lucide-react';
import { downloadPdfOrFile } from '../lib/downloadHelper';
import { PdfCanvasViewer } from './PdfCanvasViewer';

interface CardapioModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardapioUrl?: string;
  cardapioNome?: string;
  obraNome?: string;
  cardapioAtualizadoEm?: string;
}

export const CardapioModal: React.FC<CardapioModalProps> = ({
  isOpen,
  onClose,
  cardapioUrl,
  cardapioNome = 'Cardápio Oficial PDF',
  obraNome = 'Canteiro de Obras',
  cardapioAtualizadoEm,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  const handleOpenNewTab = () => {
    if (!cardapioUrl) return;
    const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // Na visualização em celulares e WebViews de aplicativos móveis (Android/iOS),
    // o uso de window.open com data: URIs ou novas abas sem barra de navegação resulta em telas brancas inoperáveis.
    // Ativamos o modo Tela Cheia embutido diretamente no app com botão seguro de "Voltar"!
    if (isMobile || cardapioUrl.startsWith('data:')) {
      setIsFullscreen(true);
      return;
    }

    try {
      const win = window.open(cardapioUrl, '_blank', 'noopener,noreferrer');
      if (!win) {
        setIsFullscreen(true);
      }
    } catch (e) {
      console.warn('Falha ao abrir em nova aba, ativando tela cheia interna:', e);
      setIsFullscreen(true);
    }
  };

  // MODO TELA CHEIA (Para celulares / WebViews sem risco de travamento em tela branca)
  if (isFullscreen && cardapioUrl) {
    return (
      <div className="fixed inset-0 z-[100] bg-neutral-900 text-white flex flex-col h-screen w-screen overflow-hidden animate-in fade-in duration-200" id="cardapio-fullscreen-overlay">
        {/* Barra Superior em Tela Cheia com Botão Claro de Voltar */}
        <div className="bg-emerald-950 text-white px-4 py-3 flex items-center justify-between border-b border-emerald-800 shrink-0 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-700 active:bg-emerald-900 text-white font-bold text-xs sm:text-sm rounded-xl transition flex items-center gap-2 cursor-pointer shadow-xs border border-emerald-700 shrink-0"
              id="btn-fullscreen-back-app"
            >
              <ChevronLeft className="h-4 w-4 stroke-[3]" />
              <span>← Voltar ao App</span>
            </button>
            <div className="truncate hidden sm:block">
              <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-md">
                {obraNome} — {cardapioNome}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              title="Baixar o arquivo em PDF"
              id="btn-fullscreen-download-pdf"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  <span>Baixando...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 shrink-0" />
                  <span>Baixar PDF</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="p-2 text-emerald-200 hover:text-white hover:bg-emerald-800/80 rounded-xl transition cursor-pointer"
              title="Sair do modo tela cheia"
              id="btn-fullscreen-exit"
            >
              <Minimize2 className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* PDF Canvas Viewer Container */}
        <div className="flex-1 w-full h-full bg-neutral-900 relative">
          <PdfCanvasViewer
            pdfUrl={cardapioUrl}
            title={`${obraNome} — ${cardapioNome}`}
            onDownload={handleDownload}
            isDownloading={isDownloading}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200" id="cardapio-modal-overlay">
      <div className="bg-white w-full max-w-5xl max-h-[94vh] rounded-2xl shadow-2xl border border-neutral-200 flex flex-col overflow-hidden my-auto" id="cardapio-modal-container">
        
        {/* Header Modal */}
        <div className="bg-emerald-900 text-white px-5 py-4 flex items-center justify-between border-b border-emerald-800 shrink-0 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-800/80 rounded-xl text-emerald-200 border border-emerald-700/60 shrink-0">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-800 text-emerald-200 text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded font-mono">
                  {obraNome}
                </span>
                {cardapioAtualizadoEm && (
                  <span className="text-xs text-emerald-300 font-medium hidden sm:inline">
                    • Atualizado em {new Date(cardapioAtualizadoEm).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-bold leading-tight mt-0.5 text-white">
                Visualização do Cardápio Oficial
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {cardapioUrl && (
              <>
                <button
                  type="button"
                  onClick={handleOpenNewTab}
                  className="px-3 py-2 bg-emerald-800 hover:bg-emerald-700 active:bg-emerald-850 text-emerald-100 hover:text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shrink-0"
                  title="Ampliar o cardápio em tela cheia no aplicativo ou navegador"
                  id="btn-modal-cardapio-newtab-top"
                >
                  <Maximize2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">Tela Cheia / Expandir</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                  title="Baixar o arquivo original em PDF"
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
                      <span>Baixar PDF</span>
                    </>
                  )}
                </button>
              </>
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50/50 flex flex-col justify-between space-y-4">
          
          {cardapioUrl ? (
            <div className="space-y-3 flex-1 flex flex-col">
              
              {/* Quick Info Bar */}
              <div className="bg-white p-3 rounded-xl border border-neutral-200 shadow-2xs flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="font-bold text-neutral-800 truncate max-w-xs sm:max-w-md">
                    {cardapioNome}
                  </span>
                </div>
                {cardapioAtualizadoEm && (
                  <span className="text-[11px] text-neutral-500 font-medium">
                    Data de Publicação: <strong>{new Date(cardapioAtualizadoEm).toLocaleDateString('pt-BR')}</strong>
                  </span>
                )}
              </div>

              {/* Embedded PDF Canvas Viewer */}
              <div className="flex-1 min-h-[440px] sm:min-h-[520px] bg-neutral-900 rounded-xl border border-neutral-300 overflow-hidden shadow-inner relative flex flex-col">
                <PdfCanvasViewer
                  pdfUrl={cardapioUrl}
                  title={`${obraNome} — ${cardapioNome}`}
                  onDownload={handleDownload}
                  isDownloading={isDownloading}
                />
              </div>

              {/* Mobile/WebView Notice */}
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-emerald-950">📌 Dica:</span>
                  <span>Você pode visualizar o cardápio em tela cheia com botão de retorno seguro ou baixar o arquivo em PDF.</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleOpenNewTab}
                    className="text-xs font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer flex items-center gap-1"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    <span>Expandir Tela Cheia</span>
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="py-16 px-4 text-center space-y-3 my-auto">
              <div className="p-4 bg-amber-50 text-amber-600 rounded-full w-16 h-16 mx-auto flex items-center justify-center border border-amber-200">
                <AlertTriangle className="h-8 w-8" />
              </div>
              <h4 className="font-bold text-base text-neutral-800">
                Cardápio Indisponível
              </h4>
              <p className="text-xs text-neutral-600 max-w-md mx-auto">
                Nenhum arquivo PDF do cardápio oficial foi cadastrado para a obra <strong>{obraNome}</strong> no momento.
              </p>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-neutral-200 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <span className="text-xs text-neutral-500 font-medium">
            Cardápio Oficial — FONTANA SGR
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 text-neutral-700 font-bold text-xs rounded-xl transition cursor-pointer"
              id="btn-modal-cardapio-close-footer"
            >
              Fechar
            </button>

            {cardapioUrl && (
              <>
                <button
                  type="button"
                  onClick={handleOpenNewTab}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-900 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  id="btn-modal-cardapio-newtab-footer"
                >
                  <Maximize2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Tela Cheia / Expandir</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  id="btn-modal-cardapio-download-footer"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      <span>Baixando...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 shrink-0" />
                      <span>Baixar Cardápio PDF</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default CardapioModal;
