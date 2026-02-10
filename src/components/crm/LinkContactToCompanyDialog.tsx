/**
 * Dialog to search and link existing contacts to a company
 * 
 * Features:
 * - Search contacts by name, email, phone
 * - Shows results with contact details
 * - Prevents duplicate linking
 * - Allows setting relationship type
 */
import { useState, useMemo } from 'react';
import { Search, User, Mail, Phone, Check, Loader2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  useCreateContactAssociation,
  RELATIONSHIP_TYPES,
} from '@/hooks/useContactCompanyAssociations';

interface LinkContactToCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName?: string;
  existingContactIds: string[];
}

export function LinkContactToCompanyDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  existingContactIds,
}: LinkContactToCompanyDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [relationshipType, setRelationshipType] = useState('employee');
  const [linking, setLinking] = useState(false);
  
  const createAssociation = useCreateContactAssociation();

  // Fetch all contacts for search
  const { data: allContacts = [], isLoading } = useQuery({
    queryKey: ['all-contacts-for-linking'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_contacts')
        .select(`
          id,
          contact_name,
          email,
          phone_mobile,
          phone,
          client_id,
          client:clients(id, business_name)
        `)
        .order('contact_name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Filter contacts based on search and exclude already linked
  const filteredContacts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    
    return allContacts.filter(contact => {
      // Exclude already linked contacts
      if (existingContactIds.includes(contact.id)) return false;
      
      // If no search query, show all
      if (!query) return true;
      
      // Search by name, email, or phone
      const name = (contact.contact_name || '').toLowerCase();
      const email = (contact.email || '').toLowerCase();
      const phone = (contact.phone_mobile || contact.phone || '').toLowerCase();
      
      return name.includes(query) || email.includes(query) || phone.includes(query);
    });
  }, [allContacts, searchQuery, existingContactIds]);

  const handleLink = async () => {
    if (!selectedContactId) return;
    
    setLinking(true);
    try {
      await createAssociation.mutateAsync({
        contact_id: selectedContactId,
        company_id: companyId,
        relationship_type: relationshipType,
      });
      
      // Reset and close
      setSelectedContactId(null);
      setSearchQuery('');
    setRelationshipType('employee');
      onOpenChange(false);
    } finally {
      setLinking(false);
    }
  };

  const handleClose = () => {
    setSelectedContactId(null);
    setSearchQuery('');
    setRelationshipType('employee');
    onOpenChange(false);
  };

  const selectedContact = allContacts.find(c => c.id === selectedContactId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Link Existing Contact</DialogTitle>
          <DialogDescription>
            Search for a contact to link to {companyName || 'this company'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Results List */}
          <ScrollArea className="flex-1 min-h-[200px] max-h-[300px] border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? (
                  <>
                    <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No contacts found matching "{searchQuery}"</p>
                  </>
                ) : existingContactIds.length === allContacts.length ? (
                  <>
                    <Check className="h-6 w-6 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">All contacts are already linked</p>
                  </>
                ) : (
                  <>
                    <User className="h-6 w-6 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Type to search for contacts</p>
                  </>
                )}
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredContacts.map((contact) => {
                  const isSelected = selectedContactId === contact.id;
                  const primaryCompany = (contact as any).client?.business_name;
                  
                  return (
                    <button
                      key={contact.id}
                      onClick={() => setSelectedContactId(isSelected ? null : contact.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        isSelected 
                          ? 'border-primary bg-primary/5' 
                          : 'border-transparent hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm flex items-center gap-2">
                            {contact.contact_name}
                            {isSelected && <Check className="h-4 w-4 text-primary" />}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                            {contact.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {contact.email}
                              </span>
                            )}
                            {(contact.phone_mobile || contact.phone) && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {contact.phone_mobile || contact.phone}
                              </span>
                            )}
                          </div>
                          {primaryCompany && (
                            <Badge variant="outline" className="mt-1.5 text-xs">
                              Primary: {primaryCompany}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Selected Contact & Relationship Type */}
          {selectedContact && (
            <div className="space-y-3 border-t pt-4">
              <div className="text-sm">
                <span className="text-muted-foreground">Selected: </span>
                <span className="font-medium">{selectedContact.contact_name}</span>
              </div>
              
              <div className="space-y-2">
                <Label>Relationship Type</Label>
                <Select value={relationshipType} onValueChange={setRelationshipType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleLink} 
            disabled={!selectedContactId || linking}
          >
            {linking ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Linking...
              </>
            ) : (
              'Link Contact'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
