/**
 * MARK AS CLIENT BUTTON
 * 
 * Converts a Prospect company to Current Client status.
 * Only visible when Lead is linked to a Prospect company.
 * Requires Admin role to confirm the status change.
 */
import { useState } from 'react';
import { UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface MarkAsClientButtonProps {
  clientId: string | null | undefined;
  clientStatus: string | null | undefined;
  leadStatus: string | null | undefined;
  onStatusChanged?: () => void;
}

export function MarkAsClientButton({
  clientId,
  clientStatus,
  leadStatus,
  onStatusChanged,
}: MarkAsClientButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reason, setReason] = useState('Lead converted to client');
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();
  const { user, isAdmin, isSales } = useAuth();
  const queryClient = useQueryClient();

  // Only show if:
  // 1. Lead has a linked company
  // 2. Company status is 'prospect'
  // 3. Lead is not already converted (accepted/won)
  const isProspect = clientStatus === 'prospect';
  const isLeadConverted = leadStatus === 'accepted' || leadStatus === 'won';
  const canShow = clientId && isProspect && !isLeadConverted;
  
  // Sales can trigger, but only Admin can confirm
  const canTrigger = isAdmin || isSales;
  const canConfirm = isAdmin;

  if (!canShow || !canTrigger) {
    return null;
  }

  const handleConfirm = async () => {
    if (!clientId || !user) return;

    // Only Admin can confirm
    if (!canConfirm) {
      toast({
        title: 'Admin Required',
        description: 'Only administrators can confirm this status change. Please contact an admin.',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdating(true);

    try {
      // 1. Insert audit log entry
      const { error: auditError } = await supabase
        .from('company_status_audit')
        .insert({
          company_id: clientId,
          action: 'status_override_set',
          old_status: 'prospect',
          new_status: 'current_client',
          changed_by: user.id,
          override_reason: reason.trim(),
        });

      if (auditError) {
        console.error('Audit log error:', auditError);
      }

      // 2. Update company status
      const { error: updateError } = await supabase
        .from('clients')
        .update({
          manual_status: 'current_client',
          status_override_at: new Date().toISOString(),
          status_override_by: user.id,
          status_override_reason: reason.trim(),
        })
        .eq('id', clientId);

      if (updateError) {
        throw updateError;
      }

      // 3. Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['lead'] });
      queryClient.invalidateQueries({ queryKey: ['client'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['crm-companies'] });

      toast({
        title: 'Success',
        description: 'Company status updated to Current Client.',
      });

      setIsDialogOpen(false);
      onStatusChanged?.();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update company status. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      <Button
        variant="secondary"
        className="bg-primary hover:bg-primary/90"
        onClick={() => setIsDialogOpen(true)}
      >
        <UserCheck className="h-4 w-4 mr-2" />
        Mark as Client
      </Button>

      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert Prospect to Client</AlertDialogTitle>
            <AlertDialogDescription>
              This will update the linked company status from <strong>Prospect</strong> to{' '}
              <strong>Current Client</strong>. This is a manual override that will be logged
              for audit purposes.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <Label htmlFor="reason">Reason for Status Change</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for converting to client..."
              className="mt-2"
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Minimum 10 characters required for audit trail.
            </p>
          </div>

          {!canConfirm && (
            <div className="bg-muted border border-border rounded-md p-3 text-sm text-muted-foreground">
              <strong>Note:</strong> Only administrators can confirm this action.
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isUpdating || reason.trim().length < 10 || !canConfirm}
              className="bg-primary hover:bg-primary/90"
            >
              {isUpdating ? 'Updating...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
