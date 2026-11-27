interface EmailContact {
  contact_email?: string | null;
  client_contact?: { email?: string | null } | null;
}

// Display the current linked CRM email, keeping stored event details untouched.
export function eventContactEmail(contact?: EmailContact | null): string | null {
  return contact?.client_contact?.email?.trim() || contact?.contact_email?.trim() || null;
}