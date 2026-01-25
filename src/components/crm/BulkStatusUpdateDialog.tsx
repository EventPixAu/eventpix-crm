/**
 * BULK STATUS UPDATE DIALOG
 * 
 * Dialog for bulk updating company statuses.
 */
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type ComputedStatus = 'prospect' | 'active_event' | 'current_client' | 'previous_client';

const STATUS_OPTIONS: { value: ComputedStatus; label: string }[] = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'active_event', label: 'Active Event' },
  { value: 'current_client', label: 'Current Client' },
  { value: 'previous_client', label: 'Previous Client' },
];

interface BulkStatusUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCompanyIds: string[];
  companies: Array<{ id: string; display_status: string }>;
  onComplete: () => void;
}

export function BulkStatusUpdateDialog({
  open,
  onOpenChange,
  selectedCompanyIds,
  companies,
  onComplete,
}: BulkStatusUpdateDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState<ComputedStatus | ''>('');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleBulkUpdate = async () => {
    if (!selectedStatus || selectedCompanyIds.length === 0) return;

    setIsUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date().toISOString();

      // Create audit entries for each company
      const auditEntries = selectedCompanyIds.map(companyId => {
        const company = companies.find(c => c.id === companyId);
        return {
          company_id: companyId,
          action: 'status_override_set' as const,
          old_status: company?.display_status || null,
          new_status: selectedStatus,
          changed_by: user?.id,
        };
      });

      await supabase.from('company_status_audit').insert(auditEntries);

      // Bulk update companies
      const { error } = await supabase
        .from('clients')
        .update({
          manual_status: selectedStatus,
          status_override_at: now,
          status_override_by: user?.id,
        })
        .in('id', selectedCompanyIds);

      if (error) throw error;

      toast.success(`Updated status for ${selectedCompanyIds.length} ${selectedCompanyIds.length === 1 ? 'company' : 'companies'}`);
      onOpenChange(false);
      setSelectedStatus('');
      onComplete();
    } catch (error) {
      console.error('Error bulk updating:', error);
      toast.error('Failed to update statuses');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set Status</DialogTitle>
          <DialogDescription>
            Update status for {selectedCompanyIds.length} selected {selectedCompanyIds.length === 1 ? 'company' : 'companies'}.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Select value={selectedStatus} onValueChange={(val) => setSelectedStatus(val as ComputedStatus)}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleBulkUpdate}
            disabled={!selectedStatus || isUpdating}
          >
            {isUpdating ? 'Updating...' : 'Update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
