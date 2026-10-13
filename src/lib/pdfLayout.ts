/** Shared presentation-only layout: never changes stored or signed agreement wording. */
export function prepareAgreementLayout(content: HTMLElement): void {
  const nodes = Array.from(content.querySelectorAll('div'));
  for (const node of nodes) {
    // Legacy headers use both single and double BR separators.
    if (node.querySelector('p, h1, h2, table, div') || !node.querySelector('br')) continue;
    const paragraphs = node.innerHTML.split(/<br\s*\/?\s*>/i);
    node.innerHTML = paragraphs
      .filter(part => part.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim())
      .map(part => `<p>${part.trim()}</p>`).join('');
  }
  
  const initial = Array.from(content.querySelectorAll('p'));
  const cssStart = initial.findIndex(paragraph => /^body\s*\{$/.test(paragraph.textContent?.trim() || ''));
  if (cssStart >= 0) {
    const title = initial.findIndex((paragraph, index) => index > cssStart && /Agreement$/i.test(paragraph.textContent?.trim() || ''));
    if (title > cssStart) initial.slice(0, title).forEach(paragraph => paragraph.remove());
  }
  normalizeAgreementDetails(content);
  
  const paragraphs = Array.from(content.querySelectorAll('p'));
  if (!content.querySelector('h1') && paragraphs[0]) paragraphs[0].classList.add('agreement-title');
  
  let inClauses = false;
  for (const paragraph of paragraphs) {
    const text = paragraph.textContent?.trim() || '';
    if (/^1\.\s+[^\n]+$/i.test(text) && text.length < 100 && !/[.!?]$/.test(text)) inClauses = true;
    if (inClauses && /^\d+\.\s+[^\n]+$/.test(text) && text.length < 100 && !/[.!?]$/.test(text)) {
      paragraph.classList.add('agreement-heading');
    }
    if (/^(Event details|The Event|The Client|Venue|Event date|Event start date)$/i.test(text)) {
      paragraph.classList.add('agreement-label');
    }
    if (/^[•●]\s/.test(text)) paragraph.classList.add('agreement-bullet');
  }
  
  const style = document.createElement('style');
  style.textContent = `
    .agreement-pdf, .agreement-pdf div { font-size: 14px !important; line-height: 1.5 !important; white-space: normal !important; }
    .agreement-pdf { color: hsl(var(--document-foreground, 0 0% 0%)); background: hsl(var(--document-background, 0 0% 100%)); overflow-wrap: anywhere; }
    .agreement-pdf p { margin: 0 0 10px !important; }
    .agreement-pdf h1, .agreement-pdf .agreement-title { font-size: 24px !important; font-weight: 700; line-height: 1.25 !important; margin: 0 0 20px !important; }
    .agreement-pdf h2, .agreement-pdf h3, .agreement-pdf .agreement-heading { font-size: 16px !important; font-weight: 700; margin: 18px 0 8px !important; }
    .agreement-pdf .agreement-label { font-weight: 600; margin: 10px 0 2px !important; }
    .agreement-pdf .agreement-bullet { padding-left: 14px; margin-bottom: 6px; }
    .agreement-pdf ul, .agreement-pdf ol { margin: 6px 0 12px; padding-left: 22px; }
    .agreement-pdf li { margin-bottom: 5px; }
    .agreement-pdf br { display: inline; margin: 0; }
  `;
  content.classList.add('agreement-pdf');
  content.prepend(style);
}

/** Recognise legacy client headers without changing stored wording or team agreements. */
function normalizeAgreementDetails(content: HTMLElement): void {
  const blocks = Array.from(content.querySelectorAll<HTMLElement>('p, h1, h2, h3, tr'));
  // Find where clauses start to limit header search
  const end = blocks.findIndex(block => /^(?:1\.\s+Parties|Services|Agreement Terms and Conditions|Photography in Brief)$/i.test(block.textContent?.trim() || ''));
  const header = end < 0 ? blocks : blocks.slice(0, end);
  
  // Identify labels. Include Date/Agreement Date so we can catch and remove them.
  const labels = /^(Client Contact|Event start date|Event date|Event Venue|Agreement Date|The Event|Event|Job\s*\/\s*(?:Assignment|Project|Event)|The Client|Client|Venue|Location|Date)\s*(?::|\t|$)/i;
  
  const details = header.find(block => /^(Event details|Job details|Series details)$/i.test(block.textContent?.trim() || ''));
  const fields: { key: string; label: string; value: string; block: HTMLElement; extra?: HTMLElement }[] = [];
  
  for (let index = 0; index < header.length; index++) {
    const block = header[index];
    if (!content.contains(block)) continue;
    
    const cells = block.matches('tr') ? Array.from(block.querySelectorAll('td, th')) : [];
    const text = cells.length 
      ? `${cells[0]?.textContent?.trim()}: ${cells.slice(1).map(cell => cell.textContent?.trim()).join(' ')}` 
      : block.textContent?.trim() || '';
    
    const match = text.match(labels) || text.match(/^(Client|Job\s*\/\s*Assignment)(?=\S)/i);
    if (!match) continue;
    
    const labelText = match[1].toLowerCase();
    let value = text.slice(match[0].length).replace(/^[:\s]+/, '').trim();
    let extra: HTMLElement | undefined;
    
    // If no value in current block, look at next block
    if (!value && !cells.length) {
      const next = header[index + 1];
      const nextText = next?.textContent?.trim() || '';
      if (next && nextText && !labels.test(nextText) && !/^(Event details|Job details|Series details)$/i.test(nextText)) {
        value = nextText;
        extra = next;
        index++;
      }
    }
    
    const afterDetails = details ? header.indexOf(block) > header.indexOf(details) : false;
    
    let key = '';
    let displayLabel = '';
    
    if (/client contact/.test(labelText)) {
      key = 'contact';
    } else if (/client/.test(labelText)) {
      key = 'client';
      displayLabel = 'The Client';
    } else if (/venue|location/.test(labelText)) {
      key = 'venue';
      displayLabel = 'Venue';
    } else if (/date/.test(labelText)) {
      // Standalone date before details block is treated as agreement date (to be removed)
      if ((labelText === 'date' && !afterDetails) || labelText === 'agreement date') {
        key = 'agreementDate';
      } else {
        key = 'eventDate';
        displayLabel = /start date/.test(labelText) ? 'Event start date' : 'Event date';
      }
    } else {
      key = 'event';
      displayLabel = 'The Event';
    }
    
    fields.push({ key, label: displayLabel, value, block, extra });
  }
  
  // Safety check: only normalize if we have both an Event/Series and a Client.
  // This avoids touching photographer agreements (team agreements) which typically use "Photographer".
  const hasEvent = fields.some(f => f.key === 'event');
  const hasClient = fields.some(f => f.key === 'client');
  if (!hasEvent || !hasClient) return;
  
  const heading = document.createElement('p');
  heading.textContent = 'Event details';
  heading.classList.add('agreement-label');
  
  const anchor = details || fields[0]?.block;
  if (!anchor) return;
  const insertion = anchor.closest('table') || anchor;
  insertion.before(heading);
  
  let previous: HTMLElement = heading;
  // Consistent order: The Event, The Client, Venue, Event date/start date
  for (const key of ['event', 'client', 'venue', 'eventDate']) {
    const field = fields.find(item => item.key === key);
    if (!field || !field.value) continue;
    
    const paragraph = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = `${field.label}:`;
    paragraph.append(strong, document.createTextNode(` ${field.value}`));
    previous.after(paragraph);
    previous = paragraph;
  }
  
  // Remove all original identified blocks (including standalone Date and Client Contact)
  details?.remove();
  for (const field of fields) {
    field.block.remove();
    field.extra?.remove();
  }
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
