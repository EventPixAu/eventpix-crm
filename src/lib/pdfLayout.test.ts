import { describe, expect, it } from 'vitest';
import { nextPdfPageEnd, prepareAgreementLayout } from './pdfLayout';

describe('agreement headings', () => {
  it('renders Event details at clause-heading size alongside 1. Parties', () => {
    const content = document.createElement('div');
    content.innerHTML = [
      '<p>Meet &amp; Greet Photography Services Agreement</p>',
      '<p>Event details</p>',
      '<p>The Event: Wentworth Con MEL</p>',
      '<p>The Client: KClark Productions LLC</p>',
      '<p>1. Parties</p>',
      '<p>EventPix and the Client.</p>',
    ].join('');
    prepareAgreementLayout(content);
    const details = Array.from(content.querySelectorAll('p'))
      .find(paragraph => paragraph.textContent?.trim() === 'Event details');
    const parties = Array.from(content.querySelectorAll('p'))
      .find(paragraph => paragraph.textContent?.trim() === '1. Parties');
    expect(details?.classList.contains('agreement-heading')).toBe(true);
    expect(details?.classList.contains('agreement-label')).toBe(false);
    expect(parties?.classList.contains('agreement-heading')).toBe(true);
  });
});

describe('PDF page boundaries', () => {
  it('moves a crossing paragraph to the next page without losing pixels', () => {
    expect(nextPdfPageEnd(0, 1000, 2000, [{ top: 950, bottom: 1100 }], [])).toBe(950);
    expect(nextPdfPageEnd(950, 1000, 2000, [{ top: 950, bottom: 1100 }], [])).toBe(1950);
  });
  it('splits oversized paragraphs only between lines', () => {
    expect(nextPdfPageEnd(0, 1000, 2400, [{ top: 0, bottom: 2400 }], [{ top: 990, bottom: 1010 }])).toBe(990);
  });
  it('trims the last page without adding an empty page', () => {
    expect(nextPdfPageEnd(1000, 1000, 1500, [], [])).toBe(1500);
  });
});