/**
 * Universal file & PDF download helper for Desktop, Mobile Web, and Android WebViews / PWAs / TWAs (Google Play Store apps).
 * - On Desktop: Uses direct browser file download (jsPDF.save or DOM <a download> click).
 * - On Mobile / Android WebViews / TWAs:
 *   1. Prioritizes local Blob creation & synchronous URL.createObjectURL.
 *   2. On Android specifically, navigates directly to a data: URI so the native
 *      setDownloadListener configured in MainActivity.kt can intercept and save the file
 *      (a blob: URL is invisible to the native WebView and gets silently discarded).
 *   3. Uses Native File Share API (navigator.share) ONLY when navigator.canShare confirms file sharing is supported.
 *   4. Uses DOM <a> element with download attribute and target="_self" to allow native Android WebView download listeners to intercept.
 *   5. Avoids window.open with Data URIs (blocked by Chrome Android and Android WebView).
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
 * Keeps execution synchronous to preserve User Activation gestures on mobile devices.
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

  const cleanFilename = filename.endsWith('.pdf') || (mimeType !== 'application/pdf' && !mimeType.includes('pdf'))
    ? filename
    : `${filename}.pdf`;

  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

  // 1. Extract or convert Blob synchronously to preserve User Activation context
  let activeBlob: Blob | null = options.blob || null;
  let activeDataUrl: string | null = options.dataUrl || null;

  if (pdfDoc) {
    try {
      activeBlob = pdfDoc.output('blob');
    } catch (e) {
      console.warn('Could not extract blob from jsPDF synchronously:', e);
    }
    if (isAndroid && !activeDataUrl) {
      try {
        activeDataUrl = pdfDoc.output('datauristring');
      } catch (e) {
        console.warn('Could not extract datauristring from jsPDF synchronously:', e);
      }
    }
  } else if (!activeBlob && activeDataUrl && activeDataUrl.startsWith('data:')) {
    try {
      activeBlob = dataUrlToBlob(activeDataUrl);
    } catch (e) {
      console.warn('dataUrlToBlob conversion failed for activeDataUrl:', e);
    }
  } else if (!activeBlob && options.url && options.url.startsWith('data:')) {
    try {
      activeBlob = dataUrlToBlob(options.url);
    } catch (e) {
      console.warn('dataUrlToBlob conversion failed for options.url:', e);
    }
  }

  // 2. If it's a remote HTTP/HTTPS URL and no Blob yet, fetch it
  if (!activeBlob && options.url && (options.url.startsWith('http://') || options.url.startsWith('https://'))) {
    try {
      const resp = await fetch(options.url);
      if (!resp.ok) {
        throw new Error(`Servidor respondeu com código ${resp.status}`);
      }
      activeBlob = await resp.blob();
    } catch (fetchErr: any) {
      console.error('Falha ao obter arquivo remoto via fetch:', fetchErr);
      throw new Error(
        'Não foi possível carregar o arquivo do servidor. Verifique sua conexão com a internet ou tente novamente.'
      );
    }
  }

  // Ensure blob has correct MIME type if missing
  if (activeBlob && (!activeBlob.type || activeBlob.type === 'application/octet-stream')) {
    activeBlob = new Blob([activeBlob], { type: mimeType });
  }

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

    let desktopUrl = activeBlob ? URL.createObjectURL(activeBlob) : (options.url || activeDataUrl || null);
    if (desktopUrl) {
      try {
        const link = document.createElement('a');
        link.href = desktopUrl;
        link.download = cleanFilename;
        link.setAttribute('download', cleanFilename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if (desktopUrl.startsWith('blob:')) {
          setTimeout(() => URL.revokeObjectURL(desktopUrl!), 10000);
        }
        return;
      } catch (err) {
        console.error('Desktop anchor download failed:', err);
      }
    }
  }

  // --- MOBILE / ANDROID WEBVIEW / TWA / PLAY STORE APP PATH ---

  // Attempt 1: Native Mobile Web Share API (Primary solution for mobile browsers and TWAs supporting Web Share)
  if (activeBlob && typeof navigator !== 'undefined' && navigator.canShare && navigator.share) {
    try {
      const file = new File([activeBlob], cleanFilename, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: title,
          text: title,
        });
        return; // Success! Shared or saved natively via Web Share API
      }
    } catch (shareErr: any) {
      if (shareErr?.name === 'AbortError') {
        // User explicitly cancelled the share menu - stop here gracefully
        return;
      }
      console.warn('Mobile Web Share failed or unsupported for this file, attempting direct Blob ObjectURL download:', shareErr);
    }
  }

  // Attempt 2 (Android native WebView app): navigate directly to a data: URI so the
  // setDownloadListener configured in MainActivity.kt can intercept and save the file via
  // DownloadManager/MediaStore. Blob object URLs are invisible to a plain native WebView
  // (they only exist inside the page context), so this is the reliable path for Android.
  if (isAndroid && activeDataUrl && activeDataUrl.startsWith('data:')) {
    try {
      window.location.href = activeDataUrl;
      return;
    } catch (navErr) {
      console.warn('Android data URI navigation failed, falling back to blob anchor:', navErr);
    }
  }

  // Attempt 3: Synchronous Blob Object URL trigger via DOM Anchor element (mobile browsers / fallback)
  // NEVER use window.open with Data URIs on Android WebViews as it gets blocked!
  if (activeBlob) {
    try {
      const blobUrl = URL.createObjectURL(activeBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = cleanFilename;
      link.setAttribute('download', cleanFilename);
      // target="_self" ensures Android WebView DownloadManager interceptors catch the event properly
      link.target = '_self';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        URL.revokeObjectURL(blobUrl);
      }, 10000);

      return;
    } catch (anchorErr) {
      console.warn('Blob ObjectURL anchor download failed on mobile:', anchorErr);
    }
  }

  // Attempt 4: Direct HTTP/HTTPS link download if activeBlob could not be generated
  if (options.url && (options.url.startsWith('http://') || options.url.startsWith('https://'))) {
    try {
      const link = document.createElement('a');
      link.href = options.url;
      link.download = cleanFilename;
      link.setAttribute('download', cleanFilename);
      link.target = isAndroid ? '_self' : '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
      }, 3000);
      return;
    } catch (urlErr) {
      console.warn('Direct URL anchor download failed:', urlErr);
    }
  }

  throw new Error(
    'Não foi possível realizar o download do arquivo no seu dispositivo. Verifique as permissões de download do aplicativo.'
  );
}
