/**
 * Universal file & PDF download helper for Desktop, Mobile Web, and Android WebViews / PWAs (Google Play Store apps).
 * - On Desktop: Uses direct browser file download (jsPDF.save / <a download>).
 * - On Mobile / Android WebViews: Uses native Android File Share API (navigator.share) which allows
 *   saving to device, opening in PDF Viewer, or sharing, avoiding WebView download blocks.
 *   Fallback opens the base64 Data URI in a window or triggers anchor download.
 */

export async function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
    });
}

export interface DownloadOptions {
    pdfDoc?: any;       // jsPDF instance if available
  blob?: Blob | null; // Blob if available
  dataUrl?: string;   // data: URL if available
  url?: string;       // http/https URL if available
  filename: string;
    title?: string;
    mimeType?: string;
}

export async function downloadPdfOrFile(options: DownloadOptions): Promise<void> {
    const { pdfDoc, filename, title = 'Documento SGR Fontana' } = options;
    const mimeType = options.mimeType || 'application/pdf';

  const cleanFilename = filename.endsWith('.pdf') || mimeType !== 'application/pdf'
      ? filename
        : `${filename}.pdf`;

  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // --- DESKTOP PATH ---
  if (!isMobile) {
        if (pdfDoc && typeof pdfDoc.save === 'function') {
                try {
                          pdfDoc.save(cleanFilename);
                          return;
                } catch (e) {
                          console.warn('pdfDoc.save failed on desktop, trying fallback anchor:', e);
                }
        }

      let desktopUrl = options.url || options.dataUrl || null;
        let isTempBlob = false;

      if (!desktopUrl && options.blob) {
              desktopUrl = URL.createObjectURL(options.blob);
              isTempBlob = true;
      } else if (!desktopUrl && pdfDoc) {
              const b = pdfDoc.output('blob');
              desktopUrl = URL.createObjectURL(b);
              isTempBlob = true;
      }

      if (desktopUrl) {
              try {
                        const link = document.createElement('a');
                        link.href = desktopUrl;
                        link.download = cleanFilename;
                        link.setAttribute('download', cleanFilename);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        if (isTempBlob && desktopUrl.startsWith('blob:')) {
                                    setTimeout(() => URL.revokeObjectURL(desktopUrl!), 10000);
                        }
                        return;
              } catch (err) {
                        console.error('Desktop anchor download failed:', err);
              }
      }
  }

  // --- MOBILE / ANDROID WEBVIEW / PLAY STORE APP PATH ---
  // Synchronously extract Blob and Data URI from jsPDF doc if available
  let mobileBlob: Blob | null = options.blob || null;
    let mobileDataUrl: string | null = options.dataUrl || null;

  if (pdfDoc) {
        try {
                mobileBlob = pdfDoc.output('blob');
                mobileDataUrl = pdfDoc.output('datauristring');
        } catch (e) {
                console.warn('Could not extract blob/datauristring from jsPDF synchronously:', e);
        }
  }

  // 1. Primary Mobile Solution: Web Share API (native Android system share & save dialog)
  // MUST be called directly within user gesture window
  if (mobileBlob && typeof navigator !== 'undefined' && navigator.canShare && navigator.share) {
        try {
                const file = new File([mobileBlob], cleanFilename, { type: mimeType });
                if (navigator.canShare({ files: [file] })) {
                          await navigator.share({
                                      files: [file],
                                      title: title,
                                      text: title,
                          });
                          return; // Success! User shared or saved file.
                }
        } catch (shareErr: any) {
                if (shareErr?.name === 'AbortError') {
                          // User closed or cancelled the native Android share sheet deliberately
                  return;
                }
                console.warn('Mobile Web Share failed, falling back to Data URI / window open:', shareErr);
        }
  }

  // Convert blob to Data URI if needed for fallback
  if (mobileBlob && !mobileDataUrl) {
        try {
                mobileDataUrl = await blobToDataUrl(mobileBlob);
        } catch (e) {
                console.warn('blobToDataUrl failed on mobile:', e);
        }
  }

  const targetUrl = mobileDataUrl || options.url || (mobileBlob ? URL.createObjectURL(mobileBlob) : null);
    if (!targetUrl) {
          throw new Error('Não foi possível gerar o formato de download para este documento.');
    }

  // 2. Mobile Fallback A: Data URI anchor click
  let anchorSucceeded = false;
    try {
          const link = document.createElement('a');
          link.href = targetUrl;
          link.download = cleanFilename;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
                  if (document.body.contains(link)) {
                            document.body.removeChild(link);
                  }
          }, 3000);
          anchorSucceeded = true;
    } catch (err) {
          console.warn('Data URI anchor click failed:', err);
    }

  if (anchorSucceeded) {
        return;
  }

  // 3. Mobile Fallback B: Direct window open to trigger native mobile PDF viewer
  try {
        const win = window.open(targetUrl, '_blank');
        if (!win) {
                throw new Error('O navegador bloqueou a abertura da janela do documento.');
        }
  } catch (err) {
        console.error('All mobile download fallbacks failed:', err);
        throw new Error('Não foi possível realizar o download ou compartilhamento do PDF no seu aplicativo. Verifique as permissões de armazenamento do seu dispositivo.');
  }
}
