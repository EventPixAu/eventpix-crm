/**
 * CONTACT IMPORT HOOK
 * 
 * Handles CSV and Google Contacts import with duplicate detection
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
}

export interface ImportResult {
  companiesCreated: number;
  companiesSkipped: number;
  contactsCreated: number;
  contactsSkipped: number;
  errors: string[];
}

interface ExistingCompany {
  id: string;
  business_name: string;
  company_email: string | null;
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
  };

  const contacts: ImportedContact[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const contact: ImportedContact = {};

    headers.forEach((header, index) => {
      const mappedField = fieldMappings[header];
      if (mappedField && values[index]) {
        contact[mappedField] = values[index].trim();
      }
    });

    // Only add if we have at least a name or email
    if (contact.firstName || contact.lastName || contact.email) {
      contacts.push(contact);
    }
  }

  return contacts;
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
    const addresses = person.addresses?.[0] || {};

    const mobile = phones.find((p: any) => p.type?.toLowerCase() === 'mobile')?.value;
    const phone = phones.find((p: any) => p.type?.toLowerCase() !== 'mobile')?.value || phones[0]?.value;

    return {
      firstName: names.givenName,
      lastName: names.familyName,
      email: emails.value,
      mobile: mobile || phone,
      phone: phone,
      jobTitle: orgs.title,
      companyName: orgs.name,
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
  const { toast } = useToast();

  const importMutation = useMutation({
    mutationFn: async (contacts: ImportedContact[]): Promise<ImportResult> => {
      const result: ImportResult = {
        companiesCreated: 0,
        companiesSkipped: 0,
        contactsCreated: 0,
        contactsSkipped: 0,
        errors: [],
      };

      if (contacts.length === 0) {
        throw new Error('No contacts to import');
      }

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

          // Skip contact if no company could be determined
          if (!companyId) {
            result.contactsSkipped++;
            result.errors.push(`Skipped contact "${contact.firstName || ''} ${contact.lastName || ''}": No company specified`);
            continue;
          }

          // Check for existing contact by email within the company
          if (contact.email) {
            const { data: existingContact } = await supabase
              .from('client_contacts')
              .select('id')
              .eq('client_id', companyId)
              .eq('email', contact.email)
              .maybeSingle();

            if (existingContact) {
              result.contactsSkipped++;
              continue;
            }
          }

          // Map job title
          let jobTitleId: string | null = null;
          if (contact.jobTitle) {
            jobTitleId = jobTitleMap.get(contact.jobTitle.toLowerCase()) || null;
          }

          // Create contact
          const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email || 'Unknown';

          const { error: contactError } = await supabase
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
            });

          if (contactError) {
            result.errors.push(`Failed to create contact "${contactName}": ${contactError.message}`);
            result.contactsSkipped++;
          } else {
            result.contactsCreated++;
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
      
      toast({
        title: 'Import Complete',
        description: `Created ${result.companiesCreated} companies, ${result.contactsCreated} contacts. Skipped ${result.companiesSkipped} duplicate companies, ${result.contactsSkipped} contacts.`,
      });
    },
    onError: (error: Error) => {
      setImportProgress(null);
      toast({
        title: 'Import Failed',
        description: error.message,
        variant: 'destructive',
      });
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
