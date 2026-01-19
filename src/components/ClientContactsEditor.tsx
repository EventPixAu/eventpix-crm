/**
 * CLIENT CONTACTS EDITOR
 * 
 * Manages client contacts with support for:
 * - Multiple phone numbers (mobile, office)
 * - Contact roles from lookup table
 * - Add, edit, delete contacts
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Phone, Mail, ChevronsUpDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { useContactRoles, useCreateContactRole } from '@/hooks/useContactRoles';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ClientContact {
  id: string;
  client_id: string;
  contact_name: string;
  email: string | null;
  phone: string | null;
  phone_mobile: string | null;
  phone_office: string | null;
  role: string | null;
  role_title: string | null;
  is_primary: boolean | null;
  notes: string | null;
}

interface ClientContactsEditorProps {
  clientId: string;
  contacts: ClientContact[];
}

interface ContactFormData {
  contact_name: string;
  email: string;
  phone_mobile: string;
  phone_office: string;
  role: string;
  role_title: string;
  is_primary: boolean;
  notes: string;
}

const emptyForm: ContactFormData = {
  contact_name: '',
  email: '',
  phone_mobile: '',
  phone_office: '',
  role: '',
  role_title: '',
  is_primary: false,
  notes: '',
};

export function ClientContactsEditor({ clientId, contacts }: ClientContactsEditorProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ContactFormData>(emptyForm);
  const [rolePopoverOpen, setRolePopoverOpen] = useState(false);
  const [roleSearchValue, setRoleSearchValue] = useState('');

  const queryClient = useQueryClient();
  const { data: contactRoles = [] } = useContactRoles();
  const createContactRole = useCreateContactRole();

  const createMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      const { error } = await supabase
        .from('client_contacts')
        .insert({
          client_id: clientId,
          contact_name: data.contact_name,
          email: data.email || null,
          phone_mobile: data.phone_mobile || null,
          phone_office: data.phone_office || null,
          role: data.role || null,
          role_title: data.role_title || null,
          is_primary: data.is_primary,
          notes: data.notes || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', clientId] });
      toast.success('Contact added');
      handleClose();
    },
    onError: (error: Error) => {
      toast.error('Failed to add contact: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ContactFormData }) => {
      const { error } = await supabase
        .from('client_contacts')
        .update({
          contact_name: data.contact_name,
          email: data.email || null,
          phone_mobile: data.phone_mobile || null,
          phone_office: data.phone_office || null,
          role: data.role || null,
          role_title: data.role_title || null,
          is_primary: data.is_primary,
          notes: data.notes || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', clientId] });
      toast.success('Contact updated');
      handleClose();
    },
    onError: (error: Error) => {
      toast.error('Failed to update contact: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('client_contacts')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', clientId] });
      toast.success('Contact deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete contact: ' + error.message);
    },
  });

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (contact: ClientContact) => {
    setEditingId(contact.id);
    setFormData({
      contact_name: contact.contact_name || '',
      email: contact.email || '',
      phone_mobile: contact.phone_mobile || '',
      phone_office: contact.phone_office || '',
      role: contact.role || '',
      role_title: contact.role_title || '',
      is_primary: contact.is_primary || false,
      notes: contact.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleSave = () => {
    if (!formData.contact_name.trim()) {
      toast.error('Contact name is required');
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this contact?')) {
      deleteMutation.mutate(id);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">Contacts</h3>
        <Button variant="outline" size="sm" onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Add Contact
        </Button>
      </div>

      {contacts.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">
          No contacts recorded
        </p>
      ) : (
        <div className="space-y-3">
          {contacts.map((contact) => (
            <div key={contact.id} className="p-3 border rounded-lg bg-card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium">{contact.contact_name}</h4>
                    {contact.is_primary && (
                      <Badge>Primary</Badge>
                    )}
                    {contact.role && (
                      <Badge variant="outline">{contact.role}</Badge>
                    )}
                  </div>
                  {contact.role_title && (
                    <p className="text-sm text-muted-foreground mt-0.5">{contact.role_title}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleOpenEdit(contact)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive"
                    onClick={() => handleDelete(contact.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                {contact.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3 w-3" />
                    <a href={`mailto:${contact.email}`} className="hover:text-foreground">
                      {contact.email}
                    </a>
                  </div>
                )}
                {contact.phone_mobile && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3" />
                    <a href={`tel:${contact.phone_mobile}`} className="hover:text-foreground">
                      {contact.phone_mobile} <span className="text-xs">(Mobile)</span>
                    </a>
                  </div>
                )}
                {contact.phone_office && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3" />
                    <a href={`tel:${contact.phone_office}`} className="hover:text-foreground">
                      {contact.phone_office} <span className="text-xs">(Office)</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update contact details' : 'Add a new contact for this client'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="contact_name">Name *</Label>
              <Input
                id="contact_name"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                placeholder="Contact name"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone_mobile">Mobile Phone</Label>
                <Input
                  id="phone_mobile"
                  value={formData.phone_mobile}
                  onChange={(e) => setFormData({ ...formData, phone_mobile: e.target.value })}
                  placeholder="Mobile number"
                />
              </div>
              <div>
                <Label htmlFor="phone_office">Office Phone</Label>
                <Input
                  id="phone_office"
                  value={formData.phone_office}
                  onChange={(e) => setFormData({ ...formData, phone_office: e.target.value })}
                  placeholder="Office number"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="role">Role</Label>
                <Popover open={rolePopoverOpen} onOpenChange={setRolePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={rolePopoverOpen}
                      className="w-full justify-between font-normal"
                    >
                      {formData.role || "Select role..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Search or add role..." 
                        value={roleSearchValue}
                        onValueChange={setRoleSearchValue}
                      />
                      <CommandList>
                        <CommandEmpty className="py-2">
                          {roleSearchValue.trim() ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start"
                              onClick={async () => {
                                try {
                                  await createContactRole.mutateAsync(roleSearchValue.trim());
                                  setFormData({ ...formData, role: roleSearchValue.trim() });
                                  setRoleSearchValue('');
                                  setRolePopoverOpen(false);
                                  toast.success(`Role "${roleSearchValue.trim()}" added`);
                                } catch (error) {
                                  toast.error('Failed to create role');
                                }
                              }}
                              disabled={createContactRole.isPending}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Add "{roleSearchValue.trim()}"
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground px-2">No roles found</span>
                          )}
                        </CommandEmpty>
                        <CommandGroup>
                          {contactRoles.map((role) => (
                            <CommandItem
                              key={role.id}
                              value={role.name}
                              onSelect={(currentValue) => {
                                setFormData({ ...formData, role: currentValue === formData.role ? '' : currentValue });
                                setRolePopoverOpen(false);
                                setRoleSearchValue('');
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.role === role.name ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {role.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="role_title">Job Title</Label>
                <Input
                  id="role_title"
                  value={formData.role_title}
                  onChange={(e) => setFormData({ ...formData, role_title: e.target.value })}
                  placeholder="e.g. Marketing Manager"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_primary" className="cursor-pointer">
                Primary Contact
              </Label>
              <Switch
                id="is_primary"
                checked={formData.is_primary}
                onCheckedChange={(checked) => setFormData({ ...formData, is_primary: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isPending || !formData.contact_name.trim()}>
              {isPending ? 'Saving...' : editingId ? 'Save Changes' : 'Add Contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
