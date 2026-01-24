/**
 * Panel showing all company associations for a contact
 * Allows adding/editing/removing secondary company relationships
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Building2, Briefcase, X, Edit2, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  useDeleteContactAssociation,
  RELATIONSHIP_TYPES,
  ContactCompanyAssociation,
} from '@/hooks/useContactCompanyAssociations';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useJobTitles } from '@/hooks/useJobTitles';

interface ContactCompanyAssociationsPanelProps {
  contactId: string;
  primaryCompanyId?: string | null;
}

export function ContactCompanyAssociationsPanel({ 
  contactId, 
  primaryCompanyId 
}: ContactCompanyAssociationsPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [relationshipType, setRelationshipType] = useState('contractor');
  const [jobTitleId, setJobTitleId] = useState<string>('');
  const [customTitle, setCustomTitle] = useState('');
  const [notes, setNotes] = useState('');

  const { data: associations = [], isLoading } = useContactAssociations(contactId);
  const createAssociation = useCreateContactAssociation();
  const deleteAssociation = useDeleteContactAssociation();
  const { data: jobTitles = [] } = useJobTitles();

  // Fetch available companies (excluding primary and already associated)
  const associatedCompanyIds = associations.map(a => a.company_id);
  const { data: availableCompanies = [] } = useQuery({
    queryKey: ['available-companies', primaryCompanyId, associatedCompanyIds],
    queryFn: async () => {
      const excludeIds = [primaryCompanyId, ...associatedCompanyIds].filter(Boolean);
      
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

  const handleAdd = () => {
    if (!selectedCompanyId) return;
    
    createAssociation.mutate({
      contact_id: contactId,
      company_id: selectedCompanyId,
      relationship_type: relationshipType,
      job_title_id: jobTitleId || null,
      custom_title: customTitle || null,
      notes: notes || null,
    }, {
      onSuccess: () => {
        setDialogOpen(false);
        resetForm();
      },
    });
  };

  const handleRemove = (assoc: ContactCompanyAssociation) => {
    if (confirm('Remove this company association?')) {
      deleteAssociation.mutate({
        id: assoc.id,
        contact_id: assoc.contact_id,
        company_id: assoc.company_id,
      });
    }
  };

  const resetForm = () => {
    setSelectedCompanyId('');
    setRelationshipType('contractor');
    setJobTitleId('');
    setCustomTitle('');
    setNotes('');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Other Company Associations
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Add</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : associations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No additional company associations. Add this contact as a contractor or consultant for other companies.
          </p>
        ) : (
          <div className="space-y-3">
            {associations.map((assoc) => (
              <div 
                key={assoc.id} 
                className="flex items-start justify-between gap-2 p-3 rounded-lg border border-border bg-muted/30"
              >
                <div className="min-w-0 flex-1">
                  <Link 
                    to={`/crm/companies/${assoc.company_id}`}
                    className="font-medium text-sm hover:text-primary truncate block"
                  >
                    {assoc.company?.business_name || 'Unknown Company'}
                  </Link>
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
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={() => handleRemove(assoc)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Add Association Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Company Association</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Company</Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {availableCompanies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.business_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            <div className="space-y-2">
              <Label>Job Title</Label>
              <Select value={jobTitleId} onValueChange={setJobTitleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select or leave blank" />
                </SelectTrigger>
                <SelectContent>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAdd} 
              disabled={!selectedCompanyId || createAssociation.isPending}
            >
              {createAssociation.isPending ? 'Adding...' : 'Add Association'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
