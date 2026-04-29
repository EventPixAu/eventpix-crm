import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, Check, RotateCcw, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useCompanyStatuses } from '@/hooks/useCompanyStatuses';

// Fallback options if database query fails
const FALLBACK_STATUS_OPTIONS = [
  { value: 'prospect', label: 'Prospect', variant: 'secondary' as const },
  { value: 'current_client', label: 'Current Client', variant: 'default' as const },
  { value: 'previous_client', label: 'Previous Client', variant: 'outline' as const },
  { value: 'active', label: 'Active Client', variant: 'default' as const },
  { value: 'inactive', label: 'Inactive', variant: 'outline' as const },
  { value: 'lost', label: 'Lost', variant: 'destructive' as const },
];

interface CompanyStatusBadgeDropdownProps {
  companyId: string;
  currentStatus: string;
  manualStatus?: string | null;
  onStatusChange?: () => void;
}

export function CompanyStatusBadgeDropdown({
  companyId,
  currentStatus,
  manualStatus,
  onStatusChange,
}: CompanyStatusBadgeDropdownProps) {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { data: dbStatuses, isLoading: statusesLoading } = useCompanyStatuses();
  
  const [isReasonDialogOpen, setIsReasonDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Map database statuses to dropdown format, with fallback
  const STATUS_OPTIONS = dbStatuses?.map(s => ({
    value: s.name,
    label: s.label,
    variant: (s.badge_variant || 'secondary') as 'default' | 'secondary' | 'destructive' | 'outline',
  })) || FALLBACK_STATUS_OPTIONS;

  // Derive display status
  const displayStatus = manualStatus || currentStatus || 'prospect';
  const statusConfig = STATUS_OPTIONS.find(s => s.value === displayStatus) || {
    value: displayStatus,
    label: displayStatus.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
    variant: 'secondary' as const,
  };

  const handleStatusClick = (newStatus: string) => {
    if (newStatus === displayStatus) return;
    setPendingStatus(newStatus);
    setIsReasonDialogOpen(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!pendingStatus || reason.trim().length < 10) {
      toast.error('Reason required', { description: 'Please provide a reason (at least 10 characters)' });
      return;
    }

    setIsUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Log to audit
      await supabase.from('company_status_audit').insert({
        company_id: companyId,
        action: 'status_override_set',
        old_status: displayStatus,
        new_status: pendingStatus,
        changed_by: user?.id,
        override_reason: reason.trim(),
      });

      // Update client status
      await supabase.from('clients').update({
        manual_status: pendingStatus,
        status_override_at: new Date().toISOString(),
        status_override_by: user?.id,
        status_override_reason: reason.trim(),
      }).eq('id', companyId);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['lead'] });
      queryClient.invalidateQueries({ queryKey: ['client'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['crm-companies'] });

      toast.success('Status updated successfully');
      setIsReasonDialogOpen(false);
      setPendingStatus(null);
      setReason('');
      onStatusChange?.();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClearOverride = async () => {
    setIsUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Log to audit
      await supabase.from('company_status_audit').insert({
        company_id: companyId,
        action: 'status_override_cleared',
        old_status: manualStatus,
        new_status: currentStatus,
        changed_by: user?.id,
        override_reason: null,
      });

      // Clear override
      await supabase.from('clients').update({
        manual_status: null,
        status_override_at: null,
        status_override_by: null,
        status_override_reason: null,
      }).eq('id', companyId);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['lead'] });
      queryClient.invalidateQueries({ queryKey: ['client'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['crm-companies'] });

      toast.success('Override cleared - status will auto-compute');
      onStatusChange?.();
    } catch (error) {
      console.error('Error clearing override:', error);
      toast.error('Failed to clear override');
    } finally {
      setIsUpdating(false);
    }
  };

  // Non-admins see a read-only badge
  if (!isAdmin) {
    return (
      <Badge variant={statusConfig.variant} className="text-xs">
        {statusesLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : statusConfig.label}
      </Badge>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Badge 
            variant={statusConfig.variant} 
            className="text-xs cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1"
          >
            {statusConfig.label}
            <ChevronDown className="h-3 w-3" />
          </Badge>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {STATUS_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleStatusClick(option.value)}
              className="flex items-center justify-between"
            >
              <span>{option.label}</span>
              {option.value === displayStatus && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
          
          {manualStatus && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleClearOverride}
                disabled={isUpdating}
                className="text-muted-foreground"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Clear Override
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Reason Dialog */}
      <Dialog open={isReasonDialogOpen} onOpenChange={setIsReasonDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Company Status</DialogTitle>
            <DialogDescription>
              You are changing the status from "{statusConfig.label}" to "
              {STATUS_OPTIONS.find(s => s.value === pendingStatus)?.label || pendingStatus}".
              Please provide a reason for this change.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Enter reason for status change (min 10 characters)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {reason.length}/10 characters minimum
            </p>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsReasonDialogOpen(false);
                setPendingStatus(null);
                setReason('');
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmStatusChange} 
              disabled={isUpdating || reason.trim().length < 10}
            >
              {isUpdating ? 'Updating...' : 'Confirm Change'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
