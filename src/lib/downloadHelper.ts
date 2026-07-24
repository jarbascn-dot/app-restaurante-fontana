/**
 * Universal file & PDF download helper for Desktop, Mobile Web, and Android WebViews / PWAs / TWAs (Google Play Store apps).
 * - On Desktop: Uses direct browser file download (jsPDF.save / <a download>).
 * - On Mobile / Android WebViews / TWAs: Uses native Android File Share API (navigator.share)
 *   which allows saving directly to device storage, opening in native PDF viewer, or sharing via WhatsApp/Drive.
 *   Converts remote HTTP/HTTPS URLs and Data URIs to Blobs so all 3 document types (Privacy Policy, Reports, Menu)
 *   follow the exact same unified native share/save pipeline.
 */

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Synchronously converts a base64 Data URI (e.g. data:application/pdf;base64,...) to a Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
  const bstr = atob(parts[1] || '');
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
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

  // --- MOBILE / ANDROID WEBVIEW / TWA / PLAY STORE APP PATH ---
  let mobileBlob: Blob | null = options.blob || null;
  let mobileDataUrl: string | null = options.dataUrl || null;

  // 1. Extract or convert Blob synchronously if possible
  if (pdfDoc) {
    try {
      mobileBlob = pdfDoc.output('blob');
      mobileDataUrl = pdfDoc.output('datauristring');
    } catch (e) {
      console.warn('Could not extract blob from jsPDF synchronously:', e);
    }
  } else if (!mobileBlob && options.dataUrl && options.dataUrl.startsWith('data:')) {
    try {
      mobileBlob = dataUrlToBlob(options.dataUrl);
    } catch (e) {
      console.warn('dataUrlToBlob conversion failed:', e);
    }
  } else if (!mobileBlob && options.url && options.url.startsWith('data:')) {
    try {
      mobileBlob = dataUrlToBlob(options.url);
    } catch (e) {
      console.warn('dataUrlToBlob conversion failed for url:', e);
    }
  }

  // 2. If it's a remote HTTP/HTTPS URL and no Blob yet, fetch it explicitly
  if (!mobileBlob && options.url && (options.url.startsWith('http://') || options.url.startsWith('https://'))) {
    try {
      const resp = await fetch(options.url);
      if (!resp.ok) {
        throw new Error(`Servidor respondeu com código ${resp.status}`);
      }
      mobileBlob = await resp.blob();
    } catch (fetchErr: any) {
      console.error('Falha ao obter arquivo remoto via fetch:', fetchErr);
      throw new Error(
        'Não foi possível carregar o arquivo do servidor. Caso persistir, pode ser uma restrição de segurança (CORS) do servidor de arquivos ou conexão instável. Tente novamente.'
      );
    }
  }

  // 3. Native Mobile Web Share API (Primary solution for Android WebViews & TWAs)
  if (mobileBlob && typeof navigator !== 'undefined' && navigator.canShare && navigator.share) {
    try {
      const file = new File([mobileBlob], cleanFilename, { type: mimeType || mobileBlob.type || 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: title,
          text: title,
        });
        return; // Success! Shared or saved natively.
      }
    } catch (shareErr: any) {
      if (shareErr?.name === 'AbortError') {
        // User deliberately closed or cancelled the share dialog
        return;
      }
      console.warn('Mobile Web Share failed, attempting immediate fallbacks:', shareErr);
    }
  }

  // 4. Fallbacks if navigator.share is unavailable or failed (executed immediately with zero async delays)
  const targetUrl = mobileDataUrl || (mobileBlob ? URL.createObjectURL(mobileBlob) : null) || options.url;
  if (!targetUrl) {
    throw new Error('Não foi possível gerar o formato de arquivo para download.');
  }

  // Fallback A: Anchor click
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

  // Fallback B: Window open
  try {
    const win = window.open(targetUrl, '_blank');
    if (!win) {
      throw new Error('Janela de abertura foi bloqueada pelo navegador.');
    }
  } catch (err) {
    console.error('All mobile download fallbacks failed:', err);
    throw new Error(
      'Não foi possível realizar o download do arquivo no seu aplicativo. Verifique as permissões do navegador ou do dispositivo.'
    );
  }
}
