export interface AgreementSigningRecord {
  status?: string | null;
  signed_by_name?: string | null;
  signed_by_email?: string | null;
  signed_at?: string | null;
  signature_data?: string | null;
}

/** Append only recorded signing evidence; never imply a company countersignature. */
export function appendAgreementSignatories(content: HTMLElement, record?: AgreementSigningRecord): void {
  if (!record || record.status !== 'signed') return;
  const section = document.createElement('section');
  section.className = 'signature';
  const heading = document.createElement('h2');
  heading.textContent = 'Signatories';
  section.appendChild(heading);
  const addDetail = (label: string, value?: string | null) => {
    if (!value) return;
    const paragraph = document.createElement('p');
    const bold = document.createElement('strong');
    bold.textContent = `${label}: `;
    paragraph.append(bold, document.createTextNode(value));
    section.appendChild(paragraph);
  };
  addDetail('Signed by', record.signed_by_name);
  addDetail('Email', record.signed_by_email);
  if (record.signed_at) {
    const date = new Date(record.signed_at);
    if (!Number.isNaN(date.getTime())) {
      addDetail('Signed on', new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Sydney', day: 'numeric', month: 'long', year: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
      }).format(date));
    }
  }
  if (record.signature_data && /^data:image\/(png|jpeg|webp);base64,[a-z\d+/=\s]+$/i.test(record.signature_data)) {
    const image = document.createElement('img');
    image.src = record.signature_data;
    image.alt = 'Recorded electronic signature';
    image.style.maxWidth = '240px';
    image.style.height = '80px';
    image.style.objectFit = 'contain';
    image.style.objectPosition = 'left';
    section.appendChild(image);
  }
  content.appendChild(section);
}