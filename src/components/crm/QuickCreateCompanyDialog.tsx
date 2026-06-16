/**
 * Quick dialog to create a new company inline
 * Used when user needs to add a company while linking to a contact
 */
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useCompanyCategories, useCreateCompanyCategory } from '@/hooks/useCompanyCategories';
import { useCompanyStatuses } from '@/hooks/useCompanyStatuses';

interface QuickCreateCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompanyCreated: (companyId: string, companyName: string) => void;
}

export function QuickCreateCompanyDialog({
  open,
  onOpenChange,
  onCompanyCreated,
}: QuickCreateCompanyDialogProps) {
  const [businessName, setBusinessName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [manualStatus, setManualStatus] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [tags, setTags] = useState('');
  const [billingAddress, setBillingAddress] = useState('');

  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const queryClient = useQueryClient();
  const { data: categories = [] } = useCompanyCategories();
  const { data: companyStatuses = [] } = useCompanyStatuses();
  const createCategory = useCreateCompanyCategory();

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    const newCat = await createCategory.mutateAsync(newCategoryName.trim());
    setCategoryId(newCat.id);
    setIsAddingCategory(false);
    setNewCategoryName('');
  };

  const createCompany = useMutation({
    mutationFn: async () => {
      const tagsArray = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const { data, error } = await supabase
        .from('clients')
        .insert([{
          business_name: businessName.trim(),
          category_id: categoryId || null,
          manual_status: manualStatus || null,
          company_email: companyEmail.trim() || null,
          company_phone: companyPhone.trim() || null,
          website: website.trim() || null,
          lead_source: leadSource.trim() || null,
          tags: tagsArray.length > 0 ? tagsArray : null,
          billing_address: billingAddress.trim() || null,
        }])
        .select('id, business_name')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Company "${data.business_name}" created`);
      queryClient.invalidateQueries({ queryKey: ['available-companies'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      onCompanyCreated(data.id, data.business_name);
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('A company with this name already exists');
      } else {
        toast.error('Failed to create company');
      }
    },
  });

  const resetForm = () => {
    setBusinessName('');
    setCategoryId('');
    setManualStatus('');
    setCompanyEmail('');
    setCompanyPhone('');
    setWebsite('');
    setLeadSource('');
    setTags('');
    setBillingAddress('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) return;
    createCompany.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Company</DialogTitle>
          <DialogDescription>Add a new company to the CRM</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">Company Name *</Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g., Acme Corporation"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category_id">Category</Label>
              {isAddingCategory ? (
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    placeholder="New category name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCategory();
                      }
                      if (e.key === 'Escape') {
                        setIsAddingCategory(false);
                        setNewCategoryName('');
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddCategory}
                    disabled={!newCategoryName.trim() || createCategory.isPending}
                  >
                    {createCategory.isPending ? '...' : 'Add'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsAddingCategory(false);
                      setNewCategoryName('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Select
                  value={categoryId}
                  onValueChange={(value) => {
                    if (value === '__add_new__') {
                      setIsAddingCategory(true);
                    } else {
                      setCategoryId(value);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="__add_new__" className="text-primary font-medium">
                      + Add new category
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual_status">Status</Label>
              <Select
                value={manualStatus}
                onValueChange={(value) => setManualStatus(value === '__none__' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Auto-computed —</SelectItem>
                  {companyStatuses.map((status) => (
                    <SelectItem key={status.id} value={status.name}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Leave as auto-computed to let the system determine status from events and leads.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyPhone">Company Phone</Label>
                <Input
                  id="companyPhone"
                  type="tel"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  placeholder="+61 2 1234 5678"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyEmail">Company Email</Label>
                <Input
                  id="companyEmail"
                  type="email"
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  placeholder="info@company.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://www.example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead_source">Source</Label>
              <Input
                id="lead_source"
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value)}
                placeholder="e.g. Associations Forum, Australian Event Awards"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. EPX Client - Previous, EPX Client - current"
              />
              <p className="text-xs text-muted-foreground">Comma-separated tags</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="billing_address">Address</Label>
              <Textarea
                id="billing_address"
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                rows={3}
                placeholder="Street Address&#10;Suburb, State, Postcode&#10;Country"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!businessName.trim() || createCompany.isPending}
            >
              {createCompany.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Company'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
