/** Export-only layout: never changes stored or signed agreement wording. */
export function prepareAgreementLayout(content: HTMLElement): void {
  const nodes = Array.from(content.querySelectorAll('div'));
  for (const node of nodes) {
    // Legacy plain-text contracts are one div with double BR separators.
    if (node.querySelector('p, h1, h2, table, div') || !node.querySelector('br')) continue;
    const paragraphs = node.innerHTML.split(/(?:<br\s*\/?\s*>\s*){2,}/i);
    node.innerHTML = paragraphs
      .filter(part => part.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim())
      .map(part => `<p>${part.trim()}</p>`).join('');
  }
  const detailParagraphs = Array.from(content.querySelectorAll('p'));
  const eventDetails = detailParagraphs.find(paragraph => /^Event details$/i.test(paragraph.textContent?.trim() || ''));
  if (eventDetails) {
    const sectionEnd = detailParagraphs.findIndex(paragraph => /^1\.\s+Parties$/i.test(paragraph.textContent?.trim() || ''));
    const headerParagraphs = sectionEnd < 0 ? detailParagraphs : detailParagraphs.slice(0, sectionEnd);
    const date = headerParagraphs.find(paragraph => /^Date\s*:/i.test(paragraph.textContent?.trim() || ''));
    if (date) eventDetails.after(date);
    headerParagraphs
      .filter(paragraph => /^The Client$/i.test(paragraph.textContent?.trim() || ''))
      .forEach(paragraph => paragraph.remove());
  }
  const paragraphs = Array.from(content.querySelectorAll('p'));
  if (!content.querySelector('h1') && paragraphs[0]) paragraphs[0].classList.add('agreement-title');
  let inClauses = false;
  for (const paragraph of paragraphs) {
    const text = paragraph.textContent?.trim() || '';
    if (/^1\.\s+Parties$/i.test(text)) inClauses = true;
    if (inClauses && /^\d+\.\s+[^\n]+$/.test(text) && text.length < 100 && !/[.!?]$/.test(text)) {
      paragraph.classList.add('agreement-heading');
    }
    if (/^(Event details|The Event|The Client|Client Contact|Venue|Event start date)$/i.test(text)) {
      paragraph.classList.add('agreement-label');
    }
    if (/^[•●]\s/.test(text)) paragraph.classList.add('agreement-bullet');
  }
  const style = document.createElement('style');
  style.textContent = `
    .agreement-pdf, .agreement-pdf div { font-size: 14px !important; line-height: 1.5 !important; }
    .agreement-pdf { color: #000; background: #fff; }
    .agreement-pdf p { margin: 0 0 10px; }
    .agreement-pdf h1, .agreement-pdf .agreement-title { font-size: 24px !important; font-weight: 700; line-height: 1.25 !important; margin: 0 0 20px; }
    .agreement-pdf h2, .agreement-pdf h3, .agreement-pdf .agreement-heading { font-size: 16px !important; font-weight: 700; margin: 18px 0 8px; }
    .agreement-pdf .agreement-label { font-weight: 600; margin: 10px 0 2px; }
    .agreement-pdf .agreement-bullet { padding-left: 14px; margin-bottom: 6px; }
    .agreement-pdf ul, .agreement-pdf ol { margin: 6px 0 12px; padding-left: 22px; }
    .agreement-pdf li { margin-bottom: 5px; }
    .agreement-pdf br { display: inline; margin: 0; }
  `;
  content.classList.add('agreement-pdf');
  content.prepend(style);
}

export interface PdfBlock { top: number; bottom: number }

/** Choose a cut before a paragraph/row, or between lines for oversized blocks. */
export function nextPdfPageEnd(start: number, pageHeight: number, fullHeight: number, blocks: PdfBlock[], lines: PdfBlock[]): number {
  const target = Math.min(start + pageHeight, fullHeight);
  if (target === fullHeight) return target;
  const crossing = blocks.find(block => block.top < target && block.bottom > target && block.top > start);
  if (crossing && crossing.bottom - crossing.top <= pageHeight) return Math.floor(crossing.top);
  const line = lines.find(item => item.top < target && item.bottom > target);
  if (line && line.top > start) return Math.floor(line.top);
  return target;
}

export function measurePdfLayout(content: HTMLElement): { blocks: PdfBlock[]; lines: PdfBlock[] } {
  const origin = content.getBoundingClientRect().top;
  const blocks: PdfBlock[] = [];
  const elements = Array.from(content.querySelectorAll<HTMLElement>('p, h1, h2, h3, h4, h5, h6, li, tr, img, .signature'));
  elements.forEach((element, index) => {
    const rect = element.getBoundingClientRect();
    let bottom = rect.bottom;
    // Keep headings and labels with the first following paragraph or list item.
    if (element.matches('h1,h2,h3,h4,h5,h6,.agreement-heading,.agreement-label')) {
      const next = elements[index + 1];
      if (next) bottom = next.getBoundingClientRect().bottom;
    }
    if (rect.height) blocks.push({ top: Math.max(0, rect.top - origin - 2), bottom: bottom - origin + 2 });
  });
  const lines: PdfBlock[] = [];
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.textContent?.trim() || node.parentElement?.closest('style, script')) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.height) lines.push({ top: Math.max(0, rect.top - origin - 2), bottom: rect.bottom - origin + 2 });
    }
  }
  return { blocks, lines };
}