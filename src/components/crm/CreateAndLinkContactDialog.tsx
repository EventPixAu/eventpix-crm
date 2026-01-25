/**
 * Dialog to create a new contact and automatically link to a company
 * 
 * After creating the contact, it's automatically linked via contact_company_associations
 */
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useJobTitles } from '@/hooks/useJobTitles';
import {
  useCreateContactAssociation,
  RELATIONSHIP_TYPES,
} from '@/hooks/useContactCompanyAssociations';

interface CreateAndLinkContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName?: string;
}

interface ContactFormData {
  contact_name: string;
  email: string;
  phone_mobile: string;
  phone_office: string;
  job_title_id: string;
  custom_title: string;
  relationship_type: string;
  notes: string;
}

const initialFormData: ContactFormData = {
  contact_name: '',
  email: '',
  phone_mobile: '',
  phone_office: '',
  job_title_id: '',
  custom_title: '',
  relationship_type: 'contractor',
  notes: '',
};

export function CreateAndLinkContactDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
}: CreateAndLinkContactDialogProps) {
  const [formData, setFormData] = useState<ContactFormData>(initialFormData);
  const queryClient = useQueryClient();
  const { data: jobTitles = [] } = useJobTitles();
  const createAssociation = useCreateContactAssociation();

  // Create contact mutation
  const createContact = useMutation({
    mutationFn: async (data: Omit<ContactFormData, 'relationship_type'>) => {
      const { data: contact, error } = await supabase
        .from('client_contacts')
        .insert({
          contact_name: data.contact_name,
          email: data.email || null,
          phone_mobile: data.phone_mobile || null,
          phone_office: data.phone_office || null,
          job_title_id: data.job_title_id || null,
          notes: data.notes || null,
          // No client_id - this is a freelance/independent contact
          is_freelance: true,
        })
        .select()
        .single();

      if (error) throw error;
      return contact;
    },
  });

  const handleSubmit = async () => {
    if (!formData.contact_name.trim()) {
      toast.error('Please enter a contact name');
      return;
    }

    try {
      // 1. Create the contact
      const newContact = await createContact.mutateAsync({
        contact_name: formData.contact_name,
        email: formData.email,
        phone_mobile: formData.phone_mobile,
        phone_office: formData.phone_office,
        job_title_id: formData.job_title_id,
        custom_title: formData.custom_title,
        notes: formData.notes,
      });

      // 2. Link to company
      await createAssociation.mutateAsync({
        contact_id: newContact.id,
        company_id: companyId,
        relationship_type: formData.relationship_type,
        job_title_id: formData.job_title_id || null,
        custom_title: formData.custom_title || null,
      });

      // 3. Invalidate queries - both company associations and CRM contacts list
      queryClient.invalidateQueries({ queryKey: ['all-contacts-for-linking'] });
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });

      toast.success(`Contact "${formData.contact_name}" created and linked`);
      
      // Reset and close
      setFormData(initialFormData);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create contact');
    }
  };

  const handleClose = () => {
    setFormData(initialFormData);
    onOpenChange(false);
  };

  const isPending = createContact.isPending || createAssociation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Contact</DialogTitle>
          <DialogDescription>
            Create a contact and link to {companyName || 'this company'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Contact Name */}
          <div className="space-y-2">
            <Label htmlFor="contact_name">Contact Name *</Label>
            <Input
              id="contact_name"
              value={formData.contact_name}
              onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
              placeholder="Jane Smith"
            />
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label htmlFor="phone_mobile">Mobile Phone</Label>
              <Input
                id="phone_mobile"
                value={formData.phone_mobile}
                onChange={(e) => setFormData({ ...formData, phone_mobile: e.target.value })}
                placeholder="+61 400 000 000"
              />
            </div>
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

          {/* Job Title */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="job_title_id">Job Title</Label>
              <Select
                value={formData.job_title_id}
                onValueChange={(value) => setFormData({ ...formData, job_title_id: value })}
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
              <Label htmlFor="custom_title">Custom Title</Label>
              <Input
                id="custom_title"
                value={formData.custom_title}
                onChange={(e) => setFormData({ ...formData, custom_title: e.target.value })}
                placeholder="Or enter custom"
              />
            </div>
          </div>

          {/* Relationship Type */}
          <div className="space-y-2">
            <Label htmlFor="relationship_type">Relationship to Company</Label>
            <Select
              value={formData.relationship_type}
              onValueChange={(value) => setFormData({ ...formData, relationship_type: value })}
            >
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
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create & Link'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
