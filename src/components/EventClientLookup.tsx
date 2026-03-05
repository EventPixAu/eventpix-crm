import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Loader2, Search, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useClients } from '@/hooks/useSales';
import { useContactSearch, type CrmContact } from '@/hooks/useContactSearch';

interface EventClientLookupProps {
  value: string;
  onValueChange: (value: string) => void;
  onCompanySelect: (company: { id: string; business_name: string }) => void;
  onContactSelect: (selection: {
    contactName: string;
    phone: string;
    companyId: string | null;
    companyName: string | null;
  }) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

function getContactCompany(contact: CrmContact) {
  return (
    contact.client ??
    contact.companies?.find((company) => company.is_primary)?.company ??
    contact.companies?.[0]?.company ??
    null
  );
}

function getContactPhone(contact: CrmContact) {
  return contact.phone_mobile || contact.phone || contact.phone_office || '';
}

export function EventClientLookup({
  value,
  onValueChange,
  onCompanySelect,
  onContactSelect,
  disabled = false,
  className,
  placeholder = 'Search client or contact',
}: EventClientLookupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { data: companies = [], isLoading: isLoadingCompanies } = useClients();
  const { data: contacts = [], isLoading: isLoadingContacts } = useContactSearch(value.trim());

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const companyMatches = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (query.length < 2) return [];

    return companies
      .filter((company) => company.business_name.toLowerCase().includes(query))
      .slice(0, 8);
  }, [companies, value]);

  const contactMatches = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (query.length < 2) return [];

    return contacts
      .filter((contact) => {
        const company = getContactCompany(contact);
        return (
          contact.contact_name.toLowerCase().includes(query) ||
          company?.business_name.toLowerCase().includes(query)
        );
      })
      .slice(0, 8);
  }, [contacts, value]);

  const shouldShowResults = isOpen && value.trim().length >= 2;
  const hasResults = companyMatches.length > 0 || contactMatches.length > 0;
  const isLoading = isLoadingCompanies || isLoadingContacts;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="bg-secondary pl-9"
        disabled={disabled}
        autoComplete="off"
      />

      {shouldShowResults && (
        <div className="absolute top-full z-50 mt-2 w-full rounded-lg border border-border bg-popover shadow-lg">
          <div className="max-h-80 overflow-y-auto p-2">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching existing records...
              </div>
            ) : hasResults ? (
              <div className="space-y-2">
                {companyMatches.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Companies
                    </div>
                    <div className="space-y-1">
                      {companyMatches.map((company) => (
                        <button
                          key={company.id}
                          type="button"
                          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            onCompanySelect({ id: company.id, business_name: company.business_name });
                            setIsOpen(false);
                          }}
                        >
                          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate text-sm font-medium">{company.business_name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {contactMatches.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Contacts
                    </div>
                    <div className="space-y-1">
                      {contactMatches.map((contact) => {
                        const company = getContactCompany(contact);
                        const phone = getContactPhone(contact);

                        return (
                          <button
                            key={contact.id}
                            type="button"
                            className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              onContactSelect({
                                contactName: contact.contact_name,
                                phone,
                                companyId: company?.id ?? null,
                                companyName: company?.business_name ?? null,
                              });
                              setIsOpen(false);
                            }}
                          >
                            <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">{contact.contact_name}</div>
                              <div className="truncate text-xs text-muted-foreground">
                                {company?.business_name || 'Standalone contact'}
                                {phone ? ` · ${phone}` : ''}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="px-3 py-6 text-sm text-muted-foreground">
                No existing clients or contacts found. Keep typing to use a new client name.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
