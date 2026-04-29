/**
 * MARK AS CLIENT BUTTON
 * 
 * Converts a Prospect company to Current Client status.
 * Only visible when Lead is linked to a Prospect company.
 * Requires Admin role to confirm the status change.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UserCheck, Send } from 'lucide-react';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

interface MarkAsClientButtonProps {
  clientId: string | null | undefined;
  clientStatus: string | null | undefined;
  clientName?: string;
  leadId?: string;
  leadName?: string;
  leadStatus: string | null | undefined;
  onStatusChanged?: () => void;
}

export function MarkAsClientButton({
  clientId,
  clientStatus,
  clientName,
  leadId,
  leadName,
  leadStatus,
  onStatusChanged,
}: MarkAsClientButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const queryClient = useQueryClient();
  const { user, isAdmin, isSales } = useAuth();

  // Only show for Prospect companies that haven't been converted yet
  const isProspect = clientStatus?.toLowerCase() === 'prospect';
  const isLeadConverted = leadStatus === 'accepted' || leadStatus === 'won';
  
  const canShow = clientId && isProspect && !isLeadConverted;
  const canTrigger = isAdmin || isSales;
  const canConfirm = isAdmin;

  if (!canShow || !canTrigger) {
    return null;
  }

  const handleConfirm = async () => {
    if (!canConfirm) {
      toast.error('Only Admins can confirm this action');
      return;
    }

    setIsUpdating(true);
    try {
      // Insert audit log first
      const { error: auditError } = await supabase
        .from('company_status_audit')
        .insert({
          company_id: clientId,
          action: 'status_override_set',
          old_status: 'prospect',
          new_status: 'current_client',
          changed_by: user?.id,
          override_reason: reason.trim(),
        });

      if (auditError) throw auditError;

      // Update company status with manual override
      const { error: updateError } = await supabase
        .from('clients')
        .update({
          manual_status: 'current_client',
          status_override_at: new Date().toISOString(),
          status_override_by: user?.id,
          status_override_reason: reason.trim(),
        })
        .eq('id', clientId);

      if (updateError) throw updateError;

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['lead'] });
      queryClient.invalidateQueries({ queryKey: ['client'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['crm-companies'] });

      toast.success('Company status updated to Current Client');
      setIsDialogOpen(false);
      setReason('');
      onStatusChanged?.();
    } catch (error) {
      console.error('Error updating company status:', error);
      toast.error('Failed to update company status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRequestApproval = async () => {
    if (!isSales || isAdmin) return;

    setIsUpdating(true);
    try {
      // Get all admin users to notify
      const { data: adminUsers, error: adminError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (adminError) throw adminError;

      if (!adminUsers || adminUsers.length === 0) {
        toast.error('No admin users found to notify');
        return;
      }

      // Create notifications for all admin users
      const notificationPromises = adminUsers.map((admin) =>
        supabase.rpc('create_notification', {
          p_user_id: admin.user_id,
          p_type: 'approval_request',
          p_title: 'Client Status Approval Required',
          p_message: `${user?.user_metadata?.full_name || 'A Sales user'} requests approval to mark "${clientName || 'a company'}" as Current Client. Reason: ${reason.trim()}`,
          p_entity_type: 'lead',
          p_entity_id: leadId || null,
          p_severity: 'warning',
          p_dedupe_hours: 24,
        })
      );

      await Promise.all(notificationPromises);

      toast.success('Approval request sent to Admins');
      setIsDialogOpen(false);
      setReason('');
    } catch (error) {
      console.error('Error sending approval request:', error);
      toast.error('Failed to send approval request');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <UserCheck className="h-4 w-4 mr-1" />
          Mark as Client
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {canConfirm ? 'Confirm Client Status Change' : 'Request Approval'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {canConfirm ? (
              <>
                This will change the company status from <strong>Prospect</strong> to{' '}
                <strong>Current Client</strong>. This action sets a manual override and will be
                logged in the audit trail.
              </>
            ) : (
              <>
                You're requesting Admin approval to change the company status from{' '}
                <strong>Prospect</strong> to <strong>Current Client</strong>. An Admin will
                review and confirm this request.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4">
          <Label htmlFor="reason">
            {canConfirm ? 'Reason for status change' : 'Reason for request'}
          </Label>
          <Input
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Contract signed, first invoice paid..."
            className="mt-2"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Minimum 10 characters required
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {canConfirm ? (
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={reason.trim().length < 10 || isUpdating}
            >
              {isUpdating ? 'Updating...' : 'Confirm'}
            </AlertDialogAction>
          ) : (
            <Button
              onClick={handleRequestApproval}
              disabled={reason.trim().length < 10 || isUpdating}
            >
              <Send className="h-4 w-4 mr-1" />
              {isUpdating ? 'Sending...' : 'Request Approval'}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
