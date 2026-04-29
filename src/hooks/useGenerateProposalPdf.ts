/**
 * GENERATE PROPOSAL PDF HOOK
 * 
 * Generates a PDF of a quote/proposal for email attachment.
 * Uses the generate-proposal-pdf edge function to create HTML,
 * then converts to PDF using html2pdf.js in the browser.
 */
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface GeneratePdfResult {
  success: boolean;
  html?: string;
  htmlBase64?: string;
  quote?: {
    quote_number: string;
    client_name: string;
    total: number;
  };
  error?: string;
}

export function useGenerateProposalPdf() {
  return useMutation({
    mutationFn: async (quoteId: string): Promise<GeneratePdfResult> => {
      const { data, error } = await supabase.functions.invoke('generate-proposal-pdf', {
        body: { quoteId },
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to generate PDF');
      
      return data;
    },
  });
}

/**
 * Convert HTML to a PDF blob using html2canvas and jsPDF
 * This runs in the browser since Edge Functions can't render HTML to PDF directly
 */
export async function htmlToPdfBlob(html: string, filename: string): Promise<Blob> {
  // NOTE: We intentionally do NOT use html2pdf.js here.
  // html2pdf.js renders via an internal hidden overlay; in this app that path has
  // repeatedly resulted in blank canvases/PDFs for email attachments.
  // Instead we render with html2canvas directly and build the PDF with jsPDF.
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');

  // Normalize HTML strings that may contain full documents (<html><head>...) or fragments.
  // We render only the <body> content and explicitly re-inject any <style> rules.
  const normalizeHtmlForContainer = (raw: string) => {
    try {
      const doc = new DOMParser().parseFromString(raw, 'text/html');
      const bodyHtml = doc.body?.innerHTML?.trim() || raw;
      const styleText = Array.from(doc.querySelectorAll('style'))
        .map((s) => s.textContent || '')
        .join('\n');
      return { bodyHtml, styleText };
    } catch {
      return { bodyHtml: raw, styleText: '' };
    }
  };

  const { bodyHtml, styleText } = normalizeHtmlForContainer(html);
  
  // Create a container for the HTML - off-screen but fully rendered.
  // IMPORTANT: Do NOT set opacity to 0, and do NOT use display:none/visibility:hidden.
  const container = document.createElement('div');
  // IMPORTANT: Keep this element rendered (opacity > 0), otherwise html2canvas can produce a blank PDF.
  container.innerHTML = '';

  if (styleText) {
    const styleEl = document.createElement('style');
    styleEl.textContent = styleText;
    container.appendChild(styleEl);
  }

  const contentEl = document.createElement('div');
  contentEl.innerHTML = bodyHtml;
  container.appendChild(contentEl);

  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '210mm'; // A4 width
  container.style.minHeight = '297mm'; // A4 height
  container.style.padding = '20mm';
  container.style.backgroundColor = 'white';
  container.style.color = 'black';
  container.style.zIndex = '0';
  container.style.opacity = '1';
  container.style.pointerEvents = 'none';
  container.style.boxSizing = 'border-box';
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  container.style.fontSize = '14px';
  container.style.lineHeight = '1.6';
  document.body.appendChild(container);
  
  // Wait for any images or fonts to load
  await new Promise(resolve => setTimeout(resolve, 200));
  
  try {
    const marginsMm: [number, number, number, number] = [15, 15, 15, 15]; // top, right, bottom, left
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    const pdfPageWidth = pdf.internal.pageSize.getWidth();
    const pdfPageHeight = pdf.internal.pageSize.getHeight();
    const innerWidth = pdfPageWidth - marginsMm[1] - marginsMm[3];
    const innerHeight = pdfPageHeight - marginsMm[0] - marginsMm[2];

    // Render DOM to canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    // Split into A4 pages (similar approach to html2pdf's internal toPdf)
    const pxFullHeight = canvas.height;
    const pxPageHeight = Math.floor(canvas.width * (innerHeight / innerWidth));
    const nPages = Math.max(1, Math.ceil(pxFullHeight / pxPageHeight));

    const pageCanvas = document.createElement('canvas');
    const pageCtx = pageCanvas.getContext('2d');
    if (!pageCtx) throw new Error('Failed to create canvas context');

    pageCanvas.width = canvas.width;
    pageCanvas.height = pxPageHeight;

    for (let page = 0; page < nPages; page++) {
      // Trim final page
      const isLast = page === nPages - 1;
      const remaining = pxFullHeight - page * pxPageHeight;
      const sliceHeight = isLast ? Math.min(pxPageHeight, remaining) : pxPageHeight;

      if (pageCanvas.height !== sliceHeight) pageCanvas.height = sliceHeight;

      pageCtx.fillStyle = '#ffffff';
      pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      pageCtx.drawImage(
        canvas,
        0,
        page * pxPageHeight,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight
      );

      const imgData = pageCanvas.toDataURL('image/jpeg', 0.98);
      const pageHeightMm = (sliceHeight * innerWidth) / canvas.width;

      if (page > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', marginsMm[3], marginsMm[0], innerWidth, pageHeightMm);
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Convert a Blob to base64 string
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove the data URL prefix to get just the base64 content
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
