import { describe, expect, it } from 'vitest';
import { appendAgreementSignatories } from './agreementSignatories';

describe('recorded agreement signatories', () => {
  it('includes the recorded signer and Sydney signing time', () => {
    const content = document.createElement('div');
    appendAgreementSignatories(content, {
      status: 'signed', signed_by_name: 'Srikanth Varma Chitragar',
      signed_by_email: 'srikanth@associations.net.au', signed_at: '2026-09-29T00:30:57.545674Z',
    });
    expect(content.textContent).toContain('Srikanth Varma Chitragar');
    expect(content.textContent).toContain('29 September 2026');
    expect(content.textContent).toContain('10:30');
    expect(content.querySelectorAll('.signature')).toHaveLength(1);
  });
  it('uses the client signing date for the authorised EventPix signature', () => {
    const content = document.createElement('div');
    appendAgreementSignatories(content, { status: 'signed', signed_at: '2026-09-29T00:30:57.545674Z' });
    const company = Array.from(content.querySelectorAll('h3')).find(item => item.textContent === 'For EventPix')?.parentElement;
    expect(company?.textContent).toContain('Trevor Connell');
    expect(company?.textContent).toContain('trevor@eventpix.com.au');
    expect(company?.textContent).toContain('29 September 2026');
    expect(company?.querySelector('img')?.src).toContain('eventpix-authorised-signature.jpg');
  });
  it('does not present an unsigned agreement as signed', () => {
    const content = document.createElement('div');
    appendAgreementSignatories(content, { status: 'sent', signed_by_name: 'Unsigned person' });
    expect(content.childElementCount).toBe(0);
  });
});