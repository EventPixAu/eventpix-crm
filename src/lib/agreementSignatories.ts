import eventpixSignature from '@/assets/eventpix-signature.asset.json';
import { getPublicBaseUrl } from '@/lib/utils';

export interface AgreementSigningRecord {
  status?: string | null;
  signed_by_name?: string | null;
  signed_by_email?: string | null;
  signed_at?: string | null;
  signature_data?: string | null;
}

/** Recorded client evidence alongside the company signature authorised by the owner. */
export function appendAgreementSignatories(content: HTMLElement, record?: AgreementSigningRecord): void {
  if (!record || record.status !== 'signed') return;
  const section = document.createElement('section');
  section.className = 'signature';
  const heading = document.createElement('h2');
  heading.textContent = 'Signatories';
  section.appendChild(heading);
  const columns = document.createElement('div');
  columns.style.display = 'grid';
  columns.style.gridTemplateColumns = '1fr 1fr';
  columns.style.gap = '24px';
  const client = document.createElement('div');
  const company = document.createElement('div');
  columns.append(client, company);
  section.appendChild(columns);
  const addDetail = (target: HTMLElement, label: string, value?: string | null) => {
    if (!value) return;
    const paragraph = document.createElement('p');
    const bold = document.createElement('strong');
    bold.textContent = `${label}: `;
    paragraph.append(bold, document.createTextNode(value));
    target.appendChild(paragraph);
  };
  const addLabel = (target: HTMLElement, text: string) => {
    const label = document.createElement('h3');
    label.textContent = text;
    target.appendChild(label);
  };
  addLabel(client, 'For the Client');
  addLabel(company, 'For EventPix');
  addDetail(client, 'Signed by', record.signed_by_name);
  addDetail(client, 'Email', record.signed_by_email);
  addDetail(company, 'Signed by', 'Trevor Connell');
  addDetail(company, 'Email', 'trevor@eventpix.com.au');
  if (record.signed_at) {
    const date = new Date(record.signed_at);
    if (!Number.isNaN(date.getTime())) {
      addDetail(client, 'Signed on', new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Sydney', day: 'numeric', month: 'long', year: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
      }).format(date));
      addDetail(company, 'Signed on', new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Sydney', day: 'numeric', month: 'long', year: 'numeric',
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
    client.appendChild(image);
  }
  const companyImage = document.createElement('img');
  companyImage.crossOrigin = 'anonymous';
  companyImage.src = `${getPublicBaseUrl()}${eventpixSignature.url}`;
  companyImage.alt = 'Trevor Connell — authorised EventPix signature';
  companyImage.style.maxWidth = '240px';
  companyImage.style.width = '100%';
  companyImage.style.height = '125px';
  companyImage.style.objectFit = 'contain';
  companyImage.style.objectPosition = 'left';
  company.appendChild(companyImage);
  content.appendChild(section);
}