/**
 * Dialog to create a standalone contact without requiring a company link
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

interface CreateStandaloneContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ContactFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone_mobile: string;
  phone_office: string;
  job_title_id: string;
  role_title: string;
  notes: string;
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
};

export function CreateStandaloneContactDialog({
  open,
  onOpenChange,
}: CreateStandaloneContactDialogProps) {
  const [formData, setFormData] = useState<ContactFormData>(initialFormData);
  const queryClient = useQueryClient();
  const { data: jobTitles = [] } = useJobTitles();

  // Create contact mutation
  const createContact = useMutation({
    mutationFn: async (data: ContactFormData) => {
      const contactName = [data.first_name, data.last_name].filter(Boolean).join(' ').trim();
      
      if (!contactName) {
        throw new Error('Please enter a first or last name');
      }

      const { data: contact, error } = await supabase
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
          // No client_id - this is an independent contact
          is_freelance: true,
        })
        .select()
        .single();

      if (error) throw error;
      return contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['all-contacts-for-linking'] });
      toast.success('Contact created successfully');
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
              <Label htmlFor="role_title">Custom Title</Label>
              <Input
                id="role_title"
                value={formData.role_title}
                onChange={(e) => setFormData({ ...formData, role_title: e.target.value })}
                placeholder="Or enter custom"
              />
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
