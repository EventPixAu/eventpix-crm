import { describe, expect, it } from 'vitest';
import { appendAgreementSignatories } from './agreementSignatories';

describe('recorded agreement signatories', () => {
  it('includes the recorded signer and Sydney signing time, without inventing a countersignatory', () => {
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
  it('does not present an unsigned agreement as signed', () => {
    const content = document.createElement('div');
    appendAgreementSignatories(content, { status: 'sent', signed_by_name: 'Unsigned person' });
    expect(content.childElementCount).toBe(0);
  });
});