/**
 * CONTACT IMPORT HOOK
 * 
 * Handles CSV and Google Contacts import with duplicate detection
 * Supports tags from Google Contacts and updates existing contacts
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { fetchHardBouncedContacts } from '@/lib/bounceProtection';

export interface ImportedContact {
  firstName?: string;
  lastName?: string;
  email?: string;
  mobile?: string;
  phone?: string;
  jobTitle?: string;
  companyName?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: string;
  leadSource?: string;
  industry?: string;
  tags?: string[];
  source?: string;
  category?: string;
  status?: string;
}

export interface ImportResult {
  companiesCreated: number;
  companiesSkipped: number;
  contactsCreated: number;
  contactsUpdated: number;
  contactsSkipped: number;
  bounceProtected: number;
  errors: string[];
}

interface ExistingCompany {
  id: string;
  business_name: string;
  company_email: string | null;
}

interface ExistingContact {
  id: string;
  email: string | null;
  tags: string[] | null;
  source: string | null;
  category: string | null;
  status: string | null;
  client_id: string | null;
  first_name?: string | null;
  last_name?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  phone_mobile?: string | null;
  job_title_id?: string | null;
}

// Parse CSV file with Zoho-compatible format
export function parseCSV(csvContent: string): ImportedContact[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["\s]/g, ''));
  
  // Common field mappings for Zoho and other CRMs
  const fieldMappings: Record<string, keyof ImportedContact> = {
    'firstname': 'firstName',
    'first_name': 'firstName',
    'first name': 'firstName',
    'lastname': 'lastName',
    'last_name': 'lastName',
    'last name': 'lastName',
    'email': 'email',
    'emailaddress': 'email',
    'email_address': 'email',
    'mobile': 'mobile',
    'mobilephone': 'mobile',
    'mobile_phone': 'mobile',
    'phone': 'phone',
    'telephone': 'phone',
    'jobtitle': 'jobTitle',
    'job_title': 'jobTitle',
    'title': 'jobTitle',
    'company': 'companyName',
    'companyname': 'companyName',
    'company_name': 'companyName',
    'account': 'companyName',
    'accountname': 'companyName',
    'account_name': 'companyName',
    'companyemail': 'companyEmail',
    'company_email': 'companyEmail',
    'companyphone': 'companyPhone',
    'company_phone': 'companyPhone',
    'address': 'companyAddress',
    'companyaddress': 'companyAddress',
    'company_address': 'companyAddress',
    'billingaddress': 'companyAddress',
    'billing_address': 'companyAddress',
    // Lead Source (company-level) mappings
    'leadsource': 'leadSource',
    'lead_source': 'leadSource',
    'lead source': 'leadSource',
    // Contact-level Source tag (e.g. "Answers 2026")
    'source': 'source',
    'contactsource': 'source',
    'contact_source': 'source',
    // Category (contact-level)
    'category': 'category',
    'contactcategory': 'category',
    'contact_category': 'category',
    'type': 'category',
    // Status (contact-level)
    'status': 'status',
    'contactstatus': 'status',
    'contact_status': 'status',
    // Industry mappings
    'industry': 'industry',
    'industrytype': 'industry',
    'industry_type': 'industry',
    'sector': 'industry',
    // Tags mappings
    'tags': 'tags',
    'labels': 'tags',
    'categories': 'tags',
    'groups': 'tags',
  };

  const contacts: ImportedContact[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const contact: ImportedContact = {};

    headers.forEach((header, index) => {
      const mappedField = fieldMappings[header];
      if (mappedField && values[index]) {
        const value = values[index].trim();
        if (mappedField === 'tags') {
          // Parse comma or semicolon separated tags
          contact.tags = value.split(/[,;]/).map(t => t.trim()).filter(Boolean);
        } else {
          (contact as any)[mappedField] = value;
        }
      }
    });

    // Only add if we have at least a name or email
    if (contact.firstName || contact.lastName || contact.email) {
      // If no company name, try to derive from email domain
      if (!contact.companyName && contact.email) {
        const derived = deriveCompanyFromEmail(contact.email);
        if (derived) {
          contact.companyName = derived;
        }
      }
      contacts.push(contact);
    }
  }

  return contacts;
}

// Common free/personal email providers to skip
const FREE_EMAIL_PROVIDERS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'yahoo.com.au',
  'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'outlook.com.au',
  'live.com', 'live.com.au', 'msn.com', 'aol.com', 'icloud.com', 'me.com', 'mac.com',
  'mail.com', 'protonmail.com', 'proton.me', 'zoho.com',
  'ymail.com', 'inbox.com', 'fastmail.com', 'hey.com',
  'bigpond.com', 'bigpond.net.au', 'optusnet.com.au', 'internode.on.net',
  'tpg.com.au', 'iiNet.net.au', 'adam.com.au',
]);

// Derive a company name from an email domain
function deriveCompanyFromEmail(email: string): string | null {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain || FREE_EMAIL_PROVIDERS.has(domain)) return null;

  // Take the domain name part (before TLD), capitalise it
  const parts = domain.split('.');
  // e.g. "acme.com.au" → "acme", "acme.co.uk" → "acme"
  const name = parts[0];
  if (!name || name.length < 2) return null;

  // Title-case
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Parse a single CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  
  return values.map(v => v.replace(/^"|"$/g, ''));
}

// Parse Google Contacts data from People API response
export function parseGoogleContacts(people: any[]): ImportedContact[] {
  return people.map(person => {
    const names = person.names?.[0] || {};
    const emails = person.emailAddresses?.[0] || {};
    const phones = person.phoneNumbers || [];
    const orgs = person.organizations?.[0] || {};
    const memberships = person.memberships || [];

    const mobile = phones.find((p: any) => p.type?.toLowerCase() === 'mobile')?.value;
    const phone = phones.find((p: any) => p.type?.toLowerCase() !== 'mobile')?.value || phones[0]?.value;

    // Extract tags from contact group memberships
    // Google returns memberships with contactGroupMembership containing contactGroupResourceName
    // Format: "contactGroups/abc123" -> need to fetch group names separately
    // Also includes labels from contactGroupMembership.contactGroupId for user-created groups
    const tags: string[] = [];
    
    memberships.forEach((m: any) => {
      // User-created contact groups have displayName in some cases
      const groupMembership = m.contactGroupMembership;
      if (groupMembership) {
        // Check if it's a user-defined label (not system groups like "myContacts")
        const resourceName = groupMembership.contactGroupResourceName || '';
        // System groups start with "contactGroups/myContacts" or similar system prefixes
        if (resourceName && !resourceName.includes('myContacts') && !resourceName.includes('starred')) {
          // For user labels, the contactGroupId contains the readable name in some API versions
          // Otherwise we'll need to store the resource name and resolve later
          // Google People API doesn't always include displayName in memberships
          // The label name might be in metadata or needs a separate groups fetch
          
          // If the person object has metadata about the group, extract it
          if (m.metadata?.source?.id) {
            // This is a user-created label ID
            tags.push(m.metadata.source.id);
          }
        }
      }
    });

    // Also check for user-defined labels in the biographies or other fields
    // that some Google integrations use for tagging
    const biographies = person.biographies || [];
    biographies.forEach((bio: any) => {
      if (bio.contentType === 'TEXT_PLAIN' && bio.metadata?.source?.type === 'CONTACT') {
        // Some users store tags in notes prefixed with #
        const hashTags = bio.value?.match(/#(\w+)/g);
        if (hashTags) {
          hashTags.forEach((tag: string) => tags.push(tag.replace('#', '')));
        }
      }
    });

    return {
      firstName: names.givenName,
      lastName: names.familyName,
      email: emails.value,
      mobile: mobile || phone,
      phone: phone,
      jobTitle: orgs.title,
      companyName: orgs.name,
      tags: tags.length > 0 ? [...new Set(tags)] : undefined, // Dedupe tags
    };
  }).filter(c => c.firstName || c.lastName || c.email);
}

// Fetch Google Contact Group names to resolve labels
export async function fetchGoogleContactGroups(accessToken: string): Promise<Map<string, string>> {
  const groupMap = new Map<string, string>();
  
  try {
    const response = await fetch(
      'https://people.googleapis.com/v1/contactGroups?groupFields=name,groupType',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      (data.contactGroups || []).forEach((group: any) => {
        // Only include user-created groups (not system groups)
        if (group.groupType === 'USER_CONTACT_GROUP' && group.name) {
          // resourceName format: "contactGroups/abc123"
          groupMap.set(group.resourceName, group.name);
        }
      });
    }
  } catch (error) {
    console.error('Failed to fetch Google contact groups:', error);
  }
  
  return groupMap;
}

// Enhanced Google Contacts parsing with group name resolution
export function parseGoogleContactsWithGroups(people: any[], groupMap: Map<string, string>): ImportedContact[] {
  return people.map(person => {
    const names = person.names?.[0] || {};
    const emails = person.emailAddresses?.[0] || {};
    const phones = person.phoneNumbers || [];
    const orgs = person.organizations?.[0] || {};
    const memberships = person.memberships || [];

    const mobile = phones.find((p: any) => p.type?.toLowerCase() === 'mobile')?.value;
    const phone = phones.find((p: any) => p.type?.toLowerCase() !== 'mobile')?.value || phones[0]?.value;

    // Extract tags from contact group memberships with resolved names
    const tags: string[] = [];
    
    memberships.forEach((m: any) => {
      const groupMembership = m.contactGroupMembership;
      if (groupMembership?.contactGroupResourceName) {
        const groupName = groupMap.get(groupMembership.contactGroupResourceName);
        if (groupName) {
          tags.push(groupName);
        }
      }
    });

    // Also check biographies for hashtags
    const biographies = person.biographies || [];
    biographies.forEach((bio: any) => {
      if (bio.contentType === 'TEXT_PLAIN') {
        const hashTags = bio.value?.match(/#(\w+)/g);
        if (hashTags) {
          hashTags.forEach((tag: string) => tags.push(tag.replace('#', '')));
        }
      }
    });

    return {
      firstName: names.givenName,
      lastName: names.familyName,
      email: emails.value,
      mobile: mobile || phone,
      phone: phone,
      jobTitle: orgs.title,
      companyName: orgs.name,
      tags: tags.length > 0 ? [...new Set(tags)] : undefined,
    };
  }).filter(c => c.firstName || c.lastName || c.email);
}

export function useContactImport() {
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    status: string;
  } | null>(null);
  
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (contacts: ImportedContact[]): Promise<ImportResult> => {
      const result: ImportResult = {
        companiesCreated: 0,
        companiesSkipped: 0,
        contactsCreated: 0,
        contactsUpdated: 0,
        contactsSkipped: 0,
        bounceProtected: 0,
        errors: [],
      };

      if (contacts.length === 0) {
        throw new Error('No contacts to import');
      }

      setImportProgress({ current: 0, total: contacts.length, status: 'Loading bounce protection list...' });
      const bounceIndex = await fetchHardBouncedContacts();

      setImportProgress({ current: 0, total: contacts.length, status: 'Fetching existing companies...' });

      // Fetch existing companies for duplicate detection
      const { data: existingCompanies, error: fetchError } = await supabase
        .from('clients')
        .select('id, business_name, company_email');

      if (fetchError) throw fetchError;

      const companyByName = new Map<string, ExistingCompany>();
      const companyByEmail = new Map<string, ExistingCompany>();

      (existingCompanies || []).forEach((c: ExistingCompany) => {
        if (c.business_name) {
          companyByName.set(c.business_name.toLowerCase().trim(), c);
        }
        if (c.company_email) {
          companyByEmail.set(c.company_email.toLowerCase().trim(), c);
        }
      });

      // Fetch job titles for mapping
      const { data: jobTitles } = await supabase
        .from('job_titles')
        .select('id, name')
        .eq('is_active', true);

      const jobTitleMap = new Map<string, string>();
      (jobTitles || []).forEach((jt: { id: string; name: string }) => {
        jobTitleMap.set(jt.name.toLowerCase(), jt.id);
      });

      // Track newly created companies in this import
      const newCompanyMap = new Map<string, string>();

      // Pre-fetch ALL existing contacts for case-insensitive email dedup
      // and to prevent duplicate primary contacts within a company.
      setImportProgress({ current: 0, total: contacts.length, status: 'Loading existing contacts...' });
      const { data: allExisting } = await supabase
        .from('client_contacts')
        .select('id, email, tags, source, category, status, client_id, first_name, last_name, contact_name');

      const contactByEmail = new Map<string, ExistingContact>();
      const contactByCompanyName = new Map<string, ExistingContact>(); // key: `${clientId}::${firstLower}|${lastLower}`
      (allExisting || []).forEach((c: any) => {
        if (c.email) {
          contactByEmail.set(String(c.email).toLowerCase().trim(), c as ExistingContact);
        }
        if (c.client_id) {
          const fl = (c.first_name || '').toLowerCase().trim();
          const ll = (c.last_name || '').toLowerCase().trim();
          const cn = (c.contact_name || '').toLowerCase().trim();
          if (fl || ll) contactByCompanyName.set(`${c.client_id}::${fl}|${ll}`, c as ExistingContact);
          if (cn) contactByCompanyName.set(`${c.client_id}::name::${cn}`, c as ExistingContact);
        }
      });


      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        setImportProgress({ 
          current: i + 1, 
          total: contacts.length, 
          status: `Importing ${contact.firstName || ''} ${contact.lastName || ''}...` 
        });

        try {
          let companyId: string | null = null;

          // Try to find or create company
          if (contact.companyName) {
            const companyNameLower = contact.companyName.toLowerCase().trim();
            const companyEmailLower = contact.companyEmail?.toLowerCase().trim();

            // Check for existing company by name or email
            let existingCompany = companyByName.get(companyNameLower);
            if (!existingCompany && companyEmailLower) {
              existingCompany = companyByEmail.get(companyEmailLower);
            }

            if (existingCompany) {
              companyId = existingCompany.id;
              result.companiesSkipped++;
            } else if (newCompanyMap.has(companyNameLower)) {
              // Company created earlier in this import batch
              companyId = newCompanyMap.get(companyNameLower)!;
            } else {
              // Create new company
              const { data: newCompany, error: companyError } = await supabase
                .from('clients')
                .insert({
                  business_name: contact.companyName,
                  company_email: contact.companyEmail || null,
                  company_phone: contact.companyPhone || null,
                  billing_address: contact.companyAddress || null,
                  lead_source: contact.leadSource || null,
                  industry: contact.industry || null,
                })
                .select('id')
                .single();

              if (companyError) {
                result.errors.push(`Failed to create company "${contact.companyName}": ${companyError.message}`);
              } else {
                companyId = newCompany.id;
                newCompanyMap.set(companyNameLower, companyId);
                companyByName.set(companyNameLower, { 
                  id: companyId, 
                  business_name: contact.companyName, 
                  company_email: contact.companyEmail || null 
                });
                if (contact.companyEmail) {
                  companyByEmail.set(contact.companyEmail.toLowerCase(), { 
                    id: companyId, 
                    business_name: contact.companyName, 
                    company_email: contact.companyEmail 
                  });
                }
                result.companiesCreated++;
              }
            }
          }

          // Check for existing contact using pre-fetched in-memory indexes.
          // PRIMARY: case-insensitive email match (global).
          let existingContact: ExistingContact | null = null;
          const emailKey = contact.email?.toLowerCase().trim() || '';
          if (emailKey) {
            existingContact = contactByEmail.get(emailKey) || null;
          }

          // Prevent duplicate primary contacts: within the same company,
          // match by (first_name, last_name) or contact_name.
          if (!existingContact && companyId && (contact.firstName || contact.lastName)) {
            const fl = (contact.firstName || '').toLowerCase().trim();
            const ll = (contact.lastName || '').toLowerCase().trim();
            const cn = [contact.firstName, contact.lastName].filter(Boolean).join(' ').toLowerCase().trim();
            existingContact =
              contactByCompanyName.get(`${companyId}::${fl}|${ll}`) ||
              (cn ? contactByCompanyName.get(`${companyId}::name::${cn}`) || null : null);
          }


          // If still no match and no company, skip creation (can't create without a company)
          if (!existingContact && !companyId) {
            result.contactsSkipped++;
            result.errors.push(`Skipped "${contact.firstName || ''} ${contact.lastName || ''}": No company and no existing match found`);
            continue;
          }

          // Map job title
          let jobTitleId: string | null = null;
          if (contact.jobTitle) {
            jobTitleId = jobTitleMap.get(contact.jobTitle.toLowerCase()) || null;
          }

          if (existingContact) {
            // Bounce protection — never re-activate or modify a hard-bounced contact
            const emailLower = (existingContact.email || contact.email || '').toLowerCase().trim();
            if (bounceIndex.ids.has(existingContact.id) || (emailLower && bounceIndex.emails.has(emailLower))) {
              result.bounceProtected++;
              continue;
            }

            // Update existing contact - merge tags (also fold in source & category as tags)
            const existingTags = existingContact.tags || [];
            const importTags = [...(contact.tags || [])];
            if (contact.source) importTags.push(contact.source);
            if (contact.category) importTags.push(contact.category);
            const mergedTags = [...new Set([...existingTags, ...importTags].map(t => t.trim()).filter(Boolean))];

            const updateData: Record<string, any> = {};

            // Only update fields that have values in the import
            if (contact.firstName) updateData.first_name = contact.firstName;
            if (contact.lastName) updateData.last_name = contact.lastName;
            if (contact.mobile) updateData.phone_mobile = contact.mobile;
            if (contact.phone) updateData.phone = contact.phone;
            if (jobTitleId) updateData.job_title_id = jobTitleId;

            // Always merge tags if there are any new ones
            if (mergedTags.length !== existingTags.length ||
                !mergedTags.every(t => existingTags.includes(t))) {
              updateData.tags = mergedTags;
            }

            // Update contact name if first/last name changed
            if (contact.firstName || contact.lastName) {
              updateData.contact_name = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
            }

            // Source/category/status: set only if empty on existing (don't overwrite)
            if (contact.source && !existingContact.source) updateData.source = contact.source;
            if (contact.category && !existingContact.category) updateData.category = contact.category;
            if (contact.status && !existingContact.status) updateData.status = contact.status;

            if (Object.keys(updateData).length > 0) {
              const { error: updateError } = await supabase
                .from('client_contacts')
                .update(updateData)
                .eq('id', existingContact.id);

              if (updateError) {
                result.errors.push(`Failed to update contact "${contact.email}": ${updateError.message}`);
                result.contactsSkipped++;
              } else {
                result.contactsUpdated++;
              }
            } else {
              result.contactsSkipped++;
            }
          } else {
            // Bounce protection — don't recreate a hard-bounced email
            const emailLower = (contact.email || '').toLowerCase().trim();
            if (emailLower && bounceIndex.emails.has(emailLower)) {
              result.bounceProtected++;
              continue;
            }
            // Create new contact
            const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email || 'Unknown';

            // Fold source/category into tags for consistent multi-source tracking
            const initialTags = [...(contact.tags || [])];
            if (contact.source) initialTags.push(contact.source);
            if (contact.category) initialTags.push(contact.category);
            const dedupedTags = [...new Set(initialTags.map(t => t.trim()).filter(Boolean))];

            const { data: inserted, error: contactError } = await supabase
              .from('client_contacts')
              .insert({
                client_id: companyId,
                contact_name: contactName,
                first_name: contact.firstName || null,
                last_name: contact.lastName || null,
                email: contact.email || null,
                phone_mobile: contact.mobile || null,
                phone: contact.phone || null,
                job_title_id: jobTitleId,
                tags: dedupedTags,
                source: contact.source || null,
                category: contact.category || null,
                status: contact.status || null,
              })
              .select('id, email, tags, source, category, status, client_id, first_name, last_name, contact_name')
              .maybeSingle();

            if (contactError) {
              result.errors.push(`Failed to create contact "${contactName}": ${contactError.message}`);
              result.contactsSkipped++;
            } else {
              result.contactsCreated++;
              // Register in in-memory indexes so subsequent rows in this
              // batch don't create duplicates for the same person.
              if (inserted) {
                if (inserted.email) contactByEmail.set(String(inserted.email).toLowerCase().trim(), inserted as ExistingContact);
                if (inserted.client_id) {
                  const fl = (inserted.first_name || '').toLowerCase().trim();
                  const ll = (inserted.last_name || '').toLowerCase().trim();
                  const cn = (inserted.contact_name || '').toLowerCase().trim();
                  if (fl || ll) contactByCompanyName.set(`${inserted.client_id}::${fl}|${ll}`, inserted as ExistingContact);
                  if (cn) contactByCompanyName.set(`${inserted.client_id}::name::${cn}`, inserted as ExistingContact);
                }
              }
            }
          }
        } catch (err: any) {
          result.errors.push(`Error processing contact: ${err.message}`);
          result.contactsSkipped++;
        }
      }

      setImportProgress(null);
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['crm-companies'] });
      
      const parts = [];
      if (result.companiesCreated > 0) parts.push(`${result.companiesCreated} companies created`);
      if (result.contactsCreated > 0) parts.push(`${result.contactsCreated} contacts created`);
      if (result.contactsUpdated > 0) parts.push(`${result.contactsUpdated} contacts updated`);
      if (result.bounceProtected > 0) parts.push(`${result.bounceProtected} skipped — hard bounce protection`);

      
      toast.success('Import Complete', { description: parts.join(', ') || 'No changes made' });
    },
    onError: (error: Error) => {
      setImportProgress(null);
      toast.error('Import Failed', { description: error.message });
    },
  });

  return {
    importContacts: importMutation.mutate,
    importProgress,
    isImporting: importMutation.isPending,
    importResult: importMutation.data,
    importError: importMutation.error,
  };
}
