/**
 * GENERATE PROPOSAL PDF HOOK
 * 
 * Generates a PDF of a quote/proposal for email attachment.
 * Uses the generate-proposal-pdf edge function to create HTML,
 * then converts to PDF using html2pdf.js in the browser.
 */
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
  // Dynamic import of html2pdf.js
  const html2pdf = (await import('html2pdf.js')).default;
  
  // Create a container for the HTML - visible but off-screen to ensure proper rendering
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'fixed';
  // Keep it rendered but not visible to the user.
  // IMPORTANT: Do NOT use opacity: 0 (html2canvas will capture it as fully transparent).
  // Also avoid negative z-index (can end up behind the page background in some browsers).
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
  await new Promise(resolve => setTimeout(resolve, 250));
  
  try {
    const pdfBlob = await html2pdf()
      .set({
        margin: [15, 15, 15, 15], // Add margins in mm
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          letterRendering: true,
          backgroundColor: '#ffffff',
          logging: false,
          windowWidth: 794, // A4 width in px at 96 DPI
          windowHeight: 1123, // A4 height in px at 96 DPI
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait' 
        },
        
      })
      .from(container)
      .outputPdf('blob');
    
    return pdfBlob;
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
