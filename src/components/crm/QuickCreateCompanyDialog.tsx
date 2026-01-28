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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  
  const queryClient = useQueryClient();

  const createCompany = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .insert([{
          business_name: businessName.trim(),
          company_email: companyEmail.trim() || null,
          company_phone: companyPhone.trim() || null,
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
    setCompanyEmail('');
    setCompanyPhone('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) return;
    createCompany.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Company</DialogTitle>
          <DialogDescription>
            Add a new company to the CRM
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name *</Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g., Acme Corporation"
                autoFocus
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
