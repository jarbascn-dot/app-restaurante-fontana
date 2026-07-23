/**
 * Universal file & PDF download helper for Desktop, Mobile Web, and Android WebViews / PWAs (Google Play Store apps).
 * Downloads files directly to the device's Downloads folder without opening OS Share menus.
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
  const { pdfDoc, filename } = options;
  const mimeType = options.mimeType || 'application/pdf';

  const cleanFilename = filename.endsWith('.pdf') || mimeType !== 'application/pdf'
    ? filename
    : `${filename}.pdf`;

  // 1. Direct jsPDF download method (works 100% on Desktop, Mobile browsers, PWAs, and Android TWAs)
  if (pdfDoc && typeof pdfDoc.save === 'function') {
    try {
      pdfDoc.save(cleanFilename);
      return;
    } catch (e) {
      console.warn('pdfDoc.save failed, falling back to blob/dataUrl anchor download:', e);
    }
  }

  // 2. Prepare Blob / Data URL / Direct URL for non-jsPDF or fallback
  let downloadUrl: string | null = options.url || options.dataUrl || null;
  let createdBlobUrl = false;

  if (!downloadUrl && options.blob) {
    try {
      downloadUrl = await blobToDataUrl(options.blob);
    } catch (e) {
      downloadUrl = URL.createObjectURL(options.blob);
      createdBlobUrl = true;
    }
  } else if (!downloadUrl && pdfDoc) {
    try {
      const blob = pdfDoc.output('blob');
      downloadUrl = await blobToDataUrl(blob);
    } catch (e) {
      const blob = pdfDoc.output('blob');
      downloadUrl = URL.createObjectURL(blob);
      createdBlobUrl = true;
    }
  }

  if (!downloadUrl) {
    console.error('No valid download URL could be generated.');
    return;
  }

  // 3. Trigger direct browser download via HTML5 <a download> element
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = cleanFilename;
  link.setAttribute('download', cleanFilename);
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  // Cleanup
  setTimeout(() => {
    if (document.body.contains(link)) {
      document.body.removeChild(link);
    }
    if (createdBlobUrl && downloadUrl.startsWith('blob:')) {
      URL.revokeObjectURL(downloadUrl);
    }
  }, 3000);
}
