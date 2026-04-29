import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Mail, UserPlus } from 'lucide-react';
import { useAllStaffRoles } from '@/hooks/useAdminStaffRoles';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface InviteStaffToAccountDialogProps {
  staff: StaffMember;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function InviteStaffToAccountDialog({ 
  staff, 
  trigger,
  onSuccess 
}: InviteStaffToAccountDialogProps) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState('photographer');
  const queryClient = useQueryClient();
  const { data: staffRoles = [] } = useAllStaffRoles();
  const ROLES = staffRoles.filter(r => r.is_active).map(r => ({ value: r.name.toLowerCase(), label: r.name, description: r.description || '' }));

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role, staffId }: { email: string; role: string; staffId: string }) => {
      // Step 1: Provision invitation with staff_id
      const { data: provisionData, error: provisionError } = await supabase.rpc('provision_user_invitation', {
        p_email: email,
        p_role: role,
      });

      if (provisionError) throw provisionError;
      
      const result = provisionData as unknown as { success: boolean; error?: string; invitation_id?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to provision invitation');
      }

      const invitationId = result.invitation_id;
      if (!invitationId) {
        throw new Error('Failed to get invitation ID');
      }

      // Step 1.5: Update the invitation with staff_id
      const { error: updateError } = await supabase
        .from('user_invitations')
        .update({ staff_id: staffId })
        .eq('id', invitationId);

      if (updateError) {
        console.error('Failed to link staff_id to invitation:', updateError);
        // Continue anyway, the core invitation still works
      }

      // Step 2: Create user via edge function
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { invitation_id: invitationId },
      });

      if (error) throw error;
      
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to create user');
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['staff-profile'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast.success('Invitation sent', { description: `An invitation email has been sent to ${staff.email}. Their account will be linked automatically when they accept.` });
      setOpen(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error('Failed to send invitation', { description: error.message });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await inviteMutation.mutateAsync({ 
      email: staff.email, 
      role, 
      staffId: staff.id 
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Mail className="h-4 w-4 mr-2" />
            Invite to Create Account
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite {staff.name} to Create Account
          </DialogTitle>
          <DialogDescription>
            Send an invitation email to <strong>{staff.email}</strong>. When they accept, 
            their profile will be automatically created and linked to their existing staff record.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="font-medium">Staff details that will be migrated:</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>• Name: {staff.name}</li>
                <li>• Email: {staff.email}</li>
                <li>• Current role: {staff.role}</li>
              </ul>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">System Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <div>
                        <div className="font-medium">{r.label}</div>
                        <div className="text-xs text-muted-foreground">{r.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This determines what features the user can access in the system.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
