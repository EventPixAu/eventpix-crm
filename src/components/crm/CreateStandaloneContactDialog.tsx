/**
 * Dialog to create a standalone contact with optional company creation
 */
import { useState } from 'react';
import { Loader2, Building2, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useJobTitles, useCreateJobTitle } from '@/hooks/useJobTitles';
import { cn } from '@/lib/utils';

interface CreateStandaloneContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ContactType = 'individual' | 'company';

interface ContactFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone_mobile: string;
  phone_office: string;
  job_title_id: string;
  role_title: string;
  notes: string;
  contact_type: ContactType;
  company_name: string;
}

const initialFormData: ContactFormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone_mobile: '',
  phone_office: '',
  job_title_id: '',
  role_title: '',
  notes: '',
  contact_type: 'individual',
  company_name: '',
};

export function CreateStandaloneContactDialog({
  open,
  onOpenChange,
}: CreateStandaloneContactDialogProps) {
  const [formData, setFormData] = useState<ContactFormData>(initialFormData);
  const [showNewJobTitle, setShowNewJobTitle] = useState(false);
  const [newJobTitleName, setNewJobTitleName] = useState('');
  const queryClient = useQueryClient();
  const { data: jobTitles = [] } = useJobTitles();
  const createJobTitle = useCreateJobTitle();

  // Create contact (and optionally company) mutation
  const createContact = useMutation({
    mutationFn: async (data: ContactFormData) => {
      const contactName = [data.first_name, data.last_name].filter(Boolean).join(' ').trim();
      
      if (!contactName) {
        throw new Error('Please enter a first or last name');
      }

      let companyId: string | null = null;

      // If company type, create the company first
      if (data.contact_type === 'company') {
        if (!data.company_name.trim()) {
          throw new Error('Please enter a company name');
        }

        const { data: company, error: companyError } = await supabase
          .from('clients')
          .insert({
            business_name: data.company_name.trim(),
            primary_contact_name: contactName,
            primary_contact_email: data.email || null,
            primary_contact_phone: data.phone_mobile || data.phone_office || null,
          })
          .select()
          .single();

        if (companyError) throw companyError;
        companyId = company.id;
      }

      // Create the contact
      const { data: contact, error: contactError } = await supabase
        .from('client_contacts')
        .insert({
          contact_name: contactName,
          first_name: data.first_name || null,
          last_name: data.last_name || null,
          email: data.email || null,
          phone_mobile: data.phone_mobile || null,
          phone_office: data.phone_office || null,
          job_title_id: data.job_title_id || null,
          role_title: data.role_title || null,
          notes: data.notes || null,
          client_id: companyId, // Link directly if company was created
          is_freelance: data.contact_type === 'individual',
        })
        .select()
        .single();

      if (contactError) throw contactError;

      // If company was created, also create the association record
      if (companyId) {
        const { error: assocError } = await supabase
          .from('contact_company_associations')
          .insert({
            contact_id: contact.id,
            company_id: companyId,
            is_primary: true,
            is_active: true,
          });

        if (assocError) {
          console.error('Failed to create association:', assocError);
          // Don't throw - contact and company were created successfully
        }
      }

      return { contact, companyId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['all-contacts-for-linking'] });
      if (result.companyId) {
        queryClient.invalidateQueries({ queryKey: ['clients'] });
        queryClient.invalidateQueries({ queryKey: ['crm-companies'] });
        toast.success('Contact and company created successfully');
      } else {
        toast.success('Contact created successfully');
      }
      setFormData(initialFormData);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create contact');
    },
  });

  const handleSubmit = () => {
    if (!formData.first_name.trim() && !formData.last_name.trim()) {
      toast.error('Please enter at least a first or last name');
      return;
    }
    if (formData.contact_type === 'company' && !formData.company_name.trim()) {
      toast.error('Please enter a company name');
      return;
    }
    createContact.mutate(formData);
  };

  const handleClose = () => {
    setFormData(initialFormData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Contact</DialogTitle>
          <DialogDescription>
            Add a new contact to the CRM. You can optionally link them to a company later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Contact Type Selection */}
          <div className="space-y-3">
            <Label>Contact Type</Label>
            <RadioGroup
              value={formData.contact_type}
              onValueChange={(value: ContactType) => 
                setFormData({ ...formData, contact_type: value, company_name: value === 'individual' ? '' : formData.company_name })
              }
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="individual" id="individual" />
                <Label htmlFor="individual" className="flex items-center gap-1.5 cursor-pointer font-normal">
                  <User className="h-4 w-4" />
                  Individual
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="company" id="company" />
                <Label htmlFor="company" className="flex items-center gap-1.5 cursor-pointer font-normal">
                  <Building2 className="h-4 w-4" />
                  Company
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Company Name (shown when company type selected) */}
          {formData.contact_type === 'company' && (
            <div className="space-y-2 p-3 rounded-lg bg-muted/50 border">
              <Label htmlFor="company_name">Company Name *</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="Acme Corporation"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                A new company will be created with this contact as the primary contact.
              </p>
            </div>
          )}

          {/* First & Last Name */}
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

          {/* Phone Numbers */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone_mobile">Mobile Phone</Label>
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
              {showNewJobTitle ? (
                <div className="flex gap-2">
                  <Input
                    value={newJobTitleName}
                    onChange={(e) => setNewJobTitleName(e.target.value)}
                    placeholder="New job title name"
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={!newJobTitleName.trim() || createJobTitle.isPending}
                    onClick={async () => {
                      const result = await createJobTitle.mutateAsync(newJobTitleName.trim());
                      setFormData({ ...formData, job_title_id: result.id });
                      setNewJobTitleName('');
                      setShowNewJobTitle(false);
                    }}
                  >
                    Add
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowNewJobTitle(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Select
                  value={formData.job_title_id}
                  onValueChange={(value) => {
                    if (value === '__new__') {
                      setShowNewJobTitle(true);
                    } else {
                      setFormData({ ...formData, job_title_id: value });
                    }
                  }}
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
                    <SelectItem value="__new__" className="text-primary font-medium">
                      + Add new job title
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role_title">Optional Job Title</Label>
              <Input
                id="role_title"
                value={formData.role_title}
                onChange={(e) => setFormData({ ...formData, role_title: e.target.value })}
                placeholder="e.g. Senior Events Coordinator"
              />
              <p className="text-xs text-muted-foreground">For specific titles not in the dropdown</p>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Additional notes..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createContact.isPending}>
            {createContact.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Contact'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
