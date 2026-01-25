/**
 * BULK STATUS UPDATE DIALOG
 * 
 * Admin-only dialog to set status on multiple companies at once.
 * Requires a reason when setting override (min 10 characters).
 * Logs each change to audit with reason.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';

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
  const { isAdmin } = useAuth();
  const [selectedStatus, setSelectedStatus] = useState<ComputedStatus | ''>('');
  const [reason, setReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Only Admin can use bulk update
  if (!isAdmin) {
    return null;
  }

  const handleBulkUpdate = async () => {
    if (!selectedStatus || selectedCompanyIds.length === 0) return;
    if (reason.trim().length < 10) {
      toast.error('Please provide a reason (minimum 10 characters)');
      return;
    }

    setIsUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date().toISOString();

      // Create audit entries for each company with reason
      const auditEntries = selectedCompanyIds.map(companyId => {
        const company = companies.find(c => c.id === companyId);
        return {
          company_id: companyId,
          action: 'status_override_set' as const,
          old_status: company?.display_status || null,
          new_status: selectedStatus,
          changed_by: user?.id,
          override_reason: reason.trim(),
        };
      });

      await supabase.from('company_status_audit').insert(auditEntries);

      // Bulk update companies with reason
      const { error } = await supabase
        .from('clients')
        .update({
          manual_status: selectedStatus,
          status_override_at: now,
          status_override_by: user?.id,
          status_override_reason: reason.trim(),
        })
        .in('id', selectedCompanyIds);

      if (error) throw error;

      toast.success(`Updated status for ${selectedCompanyIds.length} ${selectedCompanyIds.length === 1 ? 'company' : 'companies'}`);
      onOpenChange(false);
      setSelectedStatus('');
      setReason('');
      onComplete();
    } catch (error) {
      console.error('Error bulk updating:', error);
      toast.error('Failed to update statuses');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    setSelectedStatus('');
    setReason('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Status Update</DialogTitle>
          <DialogDescription>
            Set status for {selectedCompanyIds.length} selected {selectedCompanyIds.length === 1 ? 'company' : 'companies'}.
            This will override the auto-computed status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">New Status</label>
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

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Override Reason <span className="text-destructive">*</span>
            </label>
            <Textarea
              placeholder="Enter the reason for this bulk override (minimum 10 characters)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[80px]"
            />
            <p className="text-xs text-muted-foreground">
              {reason.trim().length}/10 minimum characters
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleBulkUpdate}
            disabled={!selectedStatus || isUpdating || reason.trim().length < 10}
          >
            {isUpdating ? 'Updating...' : `Update ${selectedCompanyIds.length} Companies`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}