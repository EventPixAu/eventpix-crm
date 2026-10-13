import { useLayoutEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { prepareAgreementLayout } from '@/lib/pdfLayout';
import { appendAgreementSignatories, type AgreementSigningRecord } from '@/lib/agreementSignatories';

/** One read-only presentation for every client agreement, including legacy templates. */
export function AgreementDocument({ html, signingRecord }: { html: string; signingRecord?: AgreementSigningRecord }) {
  const container = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    element.innerHTML = DOMPurify.sanitize(html);
    prepareAgreementLayout(element);
    appendAgreementSignatories(element, signingRecord);
  }, [html, signingRecord]);
  return <div ref={container} className="agreement-document min-w-0" />;
}