/**
 * CONTACT SELECTOR COMPONENT
 * 
 * Standardized contact selection across the platform:
 * - Search CRM contacts by name, email, phone
 * - Display results with Name, Job Title, Company, Email, Mobile
 * - Inline creation with duplicate checking
 * - Returns contact_id reference
 */
import { useState, useEffect, useRef } from 'react';
import { Search, User, Building2, Phone, Mail, Plus, X, Loader2, Check, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  useContactSearch,
  useContactById,
  useCreateCrmContact,
  type CrmContact,
  type CreateContactData,
} from '@/hooks/useContactSearch';
import { useJobTitles } from '@/hooks/useJobTitles';
import { useClients } from '@/hooks/useSales';

interface ContactSelectorProps {
  value: string | null; // contact_id
  onChange: (contactId: string | null, contact?: CrmContact | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  // Optional: filter to specific company's contacts
  companyId?: string | null;
  // Optional: show legacy contact info (for backwards compatibility)
  legacyName?: string | null;
  legacyEmail?: string | null;
  legacyPhone?: string | null;
  onLinkLegacy?: (contactId: string) => void;
}

interface CreateContactFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone_mobile: string;
  phone_office: string;
  job_title_id: string;
  role_title: string;
  company_id: string;
}

const initialFormData: CreateContactFormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone_mobile: '',
  phone_office: '',
  job_title_id: '',
  role_title: '',
  company_id: '',
};

export function ContactSelector({
  value,
  onChange,
  placeholder = 'Search contacts...',
  disabled = false,
  className,
  companyId,
  legacyName,
  legacyEmail,
  legacyPhone,
  onLinkLegacy,
}: ContactSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CreateContactFormData>(initialFormData);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch selected contact details
  const { data: selectedContact } = useContactById(value);

  // Search contacts
  const { data: searchResults = [], isLoading: isSearching } = useContactSearch(searchTerm);

  // Create contact mutation
  const createContact = useCreateCrmContact();

  // Job titles and companies for create form
  const { data: jobTitles = [] } = useJobTitles();
  const { data: companies = [] } = useClients();

  // Reset search when popover closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  // Pre-fill company if provided
  useEffect(() => {
    if (companyId) {
      setFormData(prev => ({ ...prev, company_id: companyId }));
    }
  }, [companyId]);

  const handleSelect = (contact: CrmContact) => {
    onChange(contact.id, contact);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = () => {
    onChange(null, null);
  };

  const handleOpenCreate = () => {
    // Pre-fill from search term if it looks like a name
    const parts = searchTerm.trim().split(' ');
    setFormData({
      ...initialFormData,
      first_name: parts[0] || '',
      last_name: parts.slice(1).join(' ') || '',
      company_id: companyId || '',
    });
    setIsCreateDialogOpen(true);
    setIsOpen(false);
  };

  const handleCreate = async () => {
    try {
      const contact = await createContact.mutateAsync({
        first_name: formData.first_name,
        last_name: formData.last_name || undefined,
        email: formData.email || undefined,
        phone_mobile: formData.phone_mobile || undefined,
        phone_office: formData.phone_office || undefined,
        job_title_id: formData.job_title_id || undefined,
        role_title: formData.role_title || undefined,
        company_id: formData.company_id || undefined,
      });

      if (contact) {
        onChange(contact.id, contact as unknown as CrmContact);
        setIsCreateDialogOpen(false);
        setFormData(initialFormData);
      }
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleLinkLegacy = () => {
    if (selectedContact && onLinkLegacy) {
      onLinkLegacy(selectedContact.id);
    }
  };

  // Get display info for contact
  const getContactDisplay = (contact: CrmContact) => {
    const company = contact.client?.business_name || 
      contact.companies?.find(c => c.is_primary)?.company?.business_name ||
      contact.companies?.[0]?.company?.business_name;
    const jobTitle = contact.job_title?.name || contact.role_title;
    const phone = contact.phone_mobile || contact.phone_office || contact.phone;

    return { company, jobTitle, phone };
  };

  // Check if there's legacy data without a linked contact
  const hasUnlinkedLegacy = !value && (legacyName || legacyEmail || legacyPhone);

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild disabled={disabled}>
          <div className={cn('relative', className)}>
            {/* Selected Contact Display */}
            {selectedContact ? (
              <div className="flex items-center gap-2 p-2 border rounded-lg bg-card">
                <div className="p-1.5 bg-muted rounded shrink-0">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{selectedContact.contact_name}</span>
                    {getContactDisplay(selectedContact).jobTitle && (
                      <span className="text-xs text-muted-foreground truncate">
                        {getContactDisplay(selectedContact).jobTitle}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {selectedContact.email && (
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3" />
                        {selectedContact.email}
                      </span>
                    )}
                    {getContactDisplay(selectedContact).phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {getContactDisplay(selectedContact).phone}
                      </span>
                    )}
                  </div>
                </div>
                {!disabled && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClear();
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ) : hasUnlinkedLegacy ? (
              /* Legacy unlinked contact display */
              <div className="flex items-center gap-2 p-2 border border-dashed border-warning rounded-lg bg-warning/5">
                <div className="p-1.5 bg-warning/10 rounded shrink-0">
                  <AlertCircle className="h-4 w-4 text-warning" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{legacyName || 'Unknown'}</span>
                    <Badge variant="outline" className="text-xs">Unlinked</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {legacyEmail && <span className="truncate">{legacyEmail}</span>}
                    {legacyPhone && <span>{legacyPhone}</span>}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(true);
                  }}
                >
                  Link
                </Button>
              </div>
            ) : (
              /* Search input trigger */
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  placeholder={placeholder}
                  className="pl-9 cursor-pointer"
                  readOnly
                  disabled={disabled}
                />
              </div>
            )}
          </div>
        </PopoverTrigger>

        <PopoverContent className="w-[400px] p-0 z-50 bg-popover" align="start">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
          </div>

          <ScrollArea className="max-h-[300px]">
            {isSearching ? (
              <div className="p-4 text-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                Searching...
              </div>
            ) : searchTerm.length < 2 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                Type at least 2 characters to search
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No contacts found
              </div>
            ) : (
              <div className="p-1">
                {searchResults.map((contact) => {
                  const display = getContactDisplay(contact);
                  const isSelected = contact.id === value;

                  return (
                    <button
                      key={contact.id}
                      className={cn(
                        'w-full flex items-start gap-3 p-2 rounded-md text-left hover:bg-accent transition-colors',
                        isSelected && 'bg-accent'
                      )}
                      onClick={() => handleSelect(contact)}
                    >
                      <div className="p-1.5 bg-muted rounded shrink-0 mt-0.5">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{contact.contact_name}</span>
                          {display.jobTitle && (
                            <span className="text-xs text-muted-foreground">
                              {display.jobTitle}
                            </span>
                          )}
                          {isSelected && (
                            <Check className="h-4 w-4 text-primary ml-auto" />
                          )}
                        </div>
                        {display.company && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            {display.company}
                          </div>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          {contact.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {contact.email}
                            </span>
                          )}
                          {display.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {display.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Create New Contact */}
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-primary"
              onClick={handleOpenCreate}
            >
              <Plus className="h-4 w-4" />
              Create new contact
              {searchTerm && <span className="text-muted-foreground">"{searchTerm}"</span>}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Create Contact Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Contact</DialogTitle>
            <DialogDescription>
              Add a new contact to the CRM. This contact will be available for selection across all forms.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Names */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="Jane"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Smith"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="jane@example.com"
              />
            </div>

            {/* Phones */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone_mobile">Mobile</Label>
                <Input
                  id="phone_mobile"
                  value={formData.phone_mobile}
                  onChange={(e) => setFormData({ ...formData, phone_mobile: e.target.value })}
                  placeholder="+61 400 000 000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone_office">Office Phone</Label>
                <Input
                  id="phone_office"
                  value={formData.phone_office}
                  onChange={(e) => setFormData({ ...formData, phone_office: e.target.value })}
                  placeholder="+61 2 0000 0000"
                />
              </div>
            </div>

            {/* Job Title */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="job_title_id">Job Title</Label>
                <Select
                  value={formData.job_title_id}
                  onValueChange={(v) => setFormData({ ...formData, job_title_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select title" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobTitles.map((title) => (
                      <SelectItem key={title.id} value={title.id}>
                        {title.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role_title">Custom Title</Label>
                <Input
                  id="role_title"
                  value={formData.role_title}
                  onChange={(e) => setFormData({ ...formData, role_title: e.target.value })}
                  placeholder="Or enter custom"
                />
              </div>
            </div>

            {/* Company Link */}
            <div className="space-y-2">
              <Label htmlFor="company_id">Link to Company (optional)</Label>
              <Select
                value={formData.company_id || '__none__'}
                onValueChange={(v) => setFormData({ ...formData, company_id: v === '__none__' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No company</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.business_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.first_name.trim() || createContact.isPending}
            >
              {createContact.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create & Select'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
