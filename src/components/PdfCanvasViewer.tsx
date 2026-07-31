/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Download, ZoomIn, ZoomOut, AlertTriangle, Loader2, ChevronLeft, ChevronRight, RotateCw, FileText } from 'lucide-react';

// Configure pdf.js worker URL dynamically from cdnjs matching installed pdfjs-dist version
try {
  if (typeof window !== 'undefined' && pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  }
} catch (e) {
  console.warn('Failed to set pdfjs workerSrc:', e);
}

interface PdfCanvasViewerProps {
  pdfUrl: string;
  title?: string;
  onDownload?: () => void;
  isDownloading?: boolean;
}

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({
  pdfUrl,
  title = 'Cardápio PDF',
  onDownload,
  isDownloading = false,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isImage, setIsImage] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  // Helper to convert base64 data URL to Uint8Array safely
  const dataUrlToUint8Array = (dataUrl: string): Uint8Array => {
    const base64 = dataUrl.split(',')[1] || dataUrl;
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  // Check if url is an image or pdf
  useEffect(() => {
    if (!pdfUrl) return;

    if (pdfUrl.startsWith('data:image/') || /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(pdfUrl)) {
      setIsImage(true);
      setLoading(false);
      setError(null);
      return;
    }

    setIsImage(false);
    let isCancelled = false;

    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(null);

        let loadingTask;
        if (pdfUrl.startsWith('data:')) {
          const bytes = dataUrlToUint8Array(pdfUrl);
          loadingTask = pdfjsLib.getDocument({ data: bytes });
        } else {
          loadingTask = pdfjsLib.getDocument(pdfUrl);
        }

        const pdf = await loadingTask.promise;
        if (isCancelled) return;

        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setCurrentPage(1);
        setLoading(false);
      } catch (err: any) {
        console.warn('Erro ao carregar PDF via PDF.js:', err);
        if (!isCancelled) {
          setError('Não foi possível renderizar a pré-visualização direta do PDF.');
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [pdfUrl]);

  // Render current page onto canvas
  useEffect(() => {
    if (isImage || !pdfDocRef.current || currentPage < 1 || loading) return;

    let renderTask: any = null;

    const renderPage = async () => {
      try {
        const page = await pdfDocRef.current!.getPage(currentPage);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const viewport = page.getViewport({ scale });
        const context = canvas.getContext('2d');
        if (!context) return;

        // Support high DPI screens (retina / mobile)
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

        const renderContext = {
          canvasContext: context,
          transform: transform || undefined,
          viewport,
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('Erro ao renderizar página do PDF:', err);
        }
      }
    };

    renderPage();

    return () => {
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [currentPage, scale, loading, isImage]);

  // Image mode
  if (isImage) {
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-neutral-900 rounded-xl overflow-auto min-h-[400px]">
        <img
          src={pdfUrl}
          alt={title}
          className="max-w-full h-auto rounded shadow-lg object-contain"
          style={{ transform: `scale(${scale})`, transformOrigin: 'top center', transition: 'transform 0.2s ease' }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-neutral-900 rounded-xl overflow-hidden border border-neutral-700 shadow-inner">
      {/* Viewer Toolbar */}
      <div className="bg-neutral-800 text-neutral-200 px-3 py-2 flex items-center justify-between border-b border-neutral-700 text-xs flex-wrap gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="font-bold truncate max-w-[180px] sm:max-w-xs">{title}</span>
        </div>

        {!loading && !error && numPages > 0 && (
          <div className="flex items-center gap-2">
            {/* Page Navigation */}
            <div className="flex items-center bg-neutral-900 rounded-lg p-0.5 border border-neutral-700">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 hover:bg-neutral-800 rounded disabled:opacity-30 transition cursor-pointer"
                title="Página Anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 font-mono text-[11px] font-bold text-emerald-300">
                {currentPage} / {numPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                disabled={currentPage >= numPages}
                className="p-1 hover:bg-neutral-800 rounded disabled:opacity-30 transition cursor-pointer"
                title="Próxima Página"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center bg-neutral-900 rounded-lg p-0.5 border border-neutral-700">
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.6, parseFloat((s - 0.2).toFixed(1))))}
                className="p-1 hover:bg-neutral-800 rounded transition cursor-pointer"
                title="Diminuir Zoom"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="px-1.5 font-mono text-[11px] text-neutral-300">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(2.5, parseFloat((s + 0.2).toFixed(1))))}
                className="p-1 hover:bg-neutral-800 rounded transition cursor-pointer"
                title="Aumentar Zoom"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            disabled={isDownloading}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50 ml-auto"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Baixar PDF</span>
          </button>
        )}
      </div>

      {/* Canvas Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-4 flex flex-col items-center justify-start min-h-[420px] sm:min-h-[520px] bg-neutral-950/80"
      >
        {loading && (
          <div className="my-auto py-12 text-center space-y-3">
            <Loader2 className="h-10 w-10 text-emerald-500 animate-spin mx-auto" />
            <p className="text-xs text-neutral-300 font-medium">Renderizando páginas do cardápio...</p>
          </div>
        )}

        {error && (
          <div className="my-auto py-10 px-6 max-w-md text-center bg-neutral-900 border border-neutral-800 rounded-2xl space-y-4 shadow-xl">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-full w-14 h-14 mx-auto flex items-center justify-center border border-amber-500/20">
              <FileText className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">Visualização Direta Indisponível</h4>
              <p className="text-xs text-neutral-400">
                O arquivo PDF está protegido ou seu dispositivo requer o download direto para leitura.
              </p>
            </div>
            {onDownload && (
              <button
                type="button"
                onClick={onDownload}
                disabled={isDownloading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>Baixar Cardápio em PDF</span>
              </button>
            )}
          </div>
        )}

        {!loading && !error && (
          <div className="bg-white shadow-2xl rounded-sm p-1 my-auto overflow-hidden">
            <canvas ref={canvasRef} className="block max-w-full h-auto mx-auto" />
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfCanvasViewer;
