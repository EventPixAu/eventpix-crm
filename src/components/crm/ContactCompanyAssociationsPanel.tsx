/**
 * Panel showing all company associations for a contact
 * Allows adding/editing/removing company relationships
 * For standalone contacts, allows linking to companies
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Building2, Briefcase, X, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useContactAssociations,
  useCreateContactAssociation,
  useUpdateContactAssociation,
  useDeleteContactAssociation,
  RELATIONSHIP_TYPES,
  ContactCompanyAssociation,
} from '@/hooks/useContactCompanyAssociations';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useJobTitles } from '@/hooks/useJobTitles';
import { useToast } from '@/hooks/use-toast';

interface ContactCompanyAssociationsPanelProps {
  contactId: string;
  primaryCompanyId?: string | null;
  isStandalone?: boolean;
}

export function ContactCompanyAssociationsPanel({ 
  contactId, 
  primaryCompanyId,
  isStandalone = false,
}: ContactCompanyAssociationsPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [relationshipType, setRelationshipType] = useState('contractor');
  const [jobTitleId, setJobTitleId] = useState<string>('');
  const [customTitle, setCustomTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: associations = [], isLoading } = useContactAssociations(contactId);
  const createAssociation = useCreateContactAssociation();
  const updateAssociation = useUpdateContactAssociation();
  const deleteAssociation = useDeleteContactAssociation();
  const { data: jobTitles = [] } = useJobTitles();

  // Check if this is a standalone contact (no primary company)
  const hasNoPrimaryCompany = !primaryCompanyId;
  const hasPrimaryAssociation = associations.some(a => a.is_primary);

  // Fetch available companies (excluding already associated)
  const associatedCompanyIds = associations.map(a => a.company_id);
  const { data: availableCompanies = [] } = useQuery({
    queryKey: ['available-companies', primaryCompanyId, associatedCompanyIds],
    queryFn: async () => {
      const excludeIds = [...associatedCompanyIds];
      if (primaryCompanyId) excludeIds.push(primaryCompanyId);
      
      let query = supabase
        .from('clients')
        .select('id, business_name')
        .eq('is_training', false)
        .order('business_name');
      
      if (excludeIds.length > 0) {
        query = query.not('id', 'in', `(${excludeIds.join(',')})`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const handleAdd = async () => {
    if (!selectedCompanyId) return;
    
    createAssociation.mutate({
      contact_id: contactId,
      company_id: selectedCompanyId,
      relationship_type: relationshipType,
      job_title_id: jobTitleId || null,
      custom_title: customTitle || null,
      notes: notes || null,
    }, {
      onSuccess: async (data) => {
        // If marked as primary, update the association
        if (isPrimary && data) {
          await updateAssociation.mutateAsync({
            id: data.id,
            contact_id: contactId,
            company_id: selectedCompanyId,
            is_primary: true,
          });
        }
        
        // Invalidate contact query to refresh the page
        queryClient.invalidateQueries({ queryKey: ['contact', contactId] });
        queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
        
        setDialogOpen(false);
        resetForm();
      },
    });
  };

  const handleSetPrimary = async (assoc: ContactCompanyAssociation) => {
    try {
      // First, clear any existing primary
      const currentPrimary = associations.find(a => a.is_primary);
      if (currentPrimary && currentPrimary.id !== assoc.id) {
        await updateAssociation.mutateAsync({
          id: currentPrimary.id,
          contact_id: currentPrimary.contact_id,
          company_id: currentPrimary.company_id,
          is_primary: false,
        });
      }
      
      // Set this one as primary
      await updateAssociation.mutateAsync({
        id: assoc.id,
        contact_id: assoc.contact_id,
        company_id: assoc.company_id,
        is_primary: true,
      });
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] });
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      
      toast({ title: 'Primary company updated' });
    } catch (error) {
      toast({ title: 'Failed to update primary company', variant: 'destructive' });
    }
  };

  const handleRemove = (assoc: ContactCompanyAssociation) => {
    if (confirm('Remove this company association?')) {
      deleteAssociation.mutate({
        id: assoc.id,
        contact_id: assoc.contact_id,
        company_id: assoc.company_id,
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['contact', contactId] });
          queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
        },
      });
    }
  };

  const resetForm = () => {
    setSelectedCompanyId('');
    setRelationshipType('contractor');
    setJobTitleId('');
    setCustomTitle('');
    setNotes('');
    setIsPrimary(false);
  };

  // Determine title and empty state message based on context
  const panelTitle = hasNoPrimaryCompany ? 'Company Links' : 'Other Company Associations';
  const emptyMessage = hasNoPrimaryCompany 
    ? 'No company links. Link this contact to one or more companies.'
    : 'No additional company associations. Add this contact as a contractor or consultant for other companies.';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {panelTitle}
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Link Company</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : associations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          <div className="space-y-3">
            {associations.map((assoc) => (
              <div 
                key={assoc.id} 
                className="flex items-start justify-between gap-2 p-3 rounded-lg border border-border bg-muted/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link 
                      to={`/crm/companies/${assoc.company_id}`}
                      className="font-medium text-sm hover:text-primary truncate"
                    >
                      {assoc.company?.business_name || 'Unknown Company'}
                    </Link>
                    {assoc.is_primary && (
                      <Badge variant="default" className="text-xs shrink-0">
                        <Star className="h-3 w-3 mr-1" />
                        Primary
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {RELATIONSHIP_TYPES.find(t => t.value === assoc.relationship_type)?.label || assoc.relationship_type}
                    </Badge>
                    {(assoc.job_title?.name || assoc.custom_title) && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        {assoc.job_title?.name || assoc.custom_title}
                      </span>
                    )}
                    {!assoc.is_active && (
                      <Badge variant="outline" className="text-xs">Inactive</Badge>
                    )}
                  </div>
                  {assoc.notes && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{assoc.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!assoc.is_primary && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title="Set as primary company"
                      onClick={() => handleSetPrimary(assoc)}
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => handleRemove(assoc)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Add Association Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link to Company</DialogTitle>
            <DialogDescription>
              Associate this contact with a company.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Company *</Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {availableCompanies.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No companies available
                    </div>
                  ) : (
                    availableCompanies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.business_name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Relationship Type</Label>
              <Select value={relationshipType} onValueChange={setRelationshipType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {RELATIONSHIP_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Job Title</Label>
              <Select value={jobTitleId} onValueChange={setJobTitleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select or leave blank" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="">None</SelectItem>
                  {jobTitles.map((title) => (
                    <SelectItem key={title.id} value={title.id}>
                      {title.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Custom Title (optional)</Label>
              <Input 
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="e.g., Senior Event Manager"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional context about this relationship"
                rows={2}
              />
            </div>

            {/* Show "Set as primary" option for standalone contacts or if no primary exists */}
            {(hasNoPrimaryCompany || !hasPrimaryAssociation) && (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                <div>
                  <Label htmlFor="isPrimary" className="cursor-pointer">Set as primary company</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Primary company appears on contact list
                  </p>
                </div>
                <Switch
                  id="isPrimary"
                  checked={isPrimary}
                  onCheckedChange={setIsPrimary}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAdd} 
              disabled={!selectedCompanyId || createAssociation.isPending}
            >
              {createAssociation.isPending ? 'Linking...' : 'Link Company'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
