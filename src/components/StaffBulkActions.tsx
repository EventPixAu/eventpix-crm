import { useState } from 'react';
import { Download, UserCog, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type { Staff } from '@/hooks/useStaff';

interface StaffBulkActionsProps {
  selectedStaff: Staff[];
  onClearSelection: () => void;
}

export function StaffBulkActions({ selectedStaff, onClearSelection }: StaffBulkActionsProps) {
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<'active' | 'inactive'>('active');
  const [newRole, setNewRole] = useState<'photographer' | 'videographer' | 'assistant'>('photographer');
  const [isUpdating, setIsUpdating] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleBulkStatusChange = async () => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('staff')
        .update({ status: newStatus })
        .in('id', selectedStaff.map(s => s.id));

      if (error) throw error;

      toast({ title: `Updated status for ${selectedStaff.length} staff members` });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setStatusDialogOpen(false);
      onClearSelection();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Failed to update status', description: error.message });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBulkRoleChange = async () => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('staff')
        .update({ role: newRole })
        .in('id', selectedStaff.map(s => s.id));

      if (error) throw error;

      toast({ title: `Updated role for ${selectedStaff.length} staff members` });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setRoleDialogOpen(false);
      onClearSelection();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Failed to update role', description: error.message });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Role', 'Status'];
    const rows = selectedStaff.map(member => [
      member.name,
      member.email,
      member.phone || '',
      member.role,
      member.status,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `staff-export-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: `Exported ${selectedStaff.length} staff members to CSV` });
  };

  if (selectedStaff.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4 text-primary" />
          <span>{selectedStaff.length} selected</span>
        </div>
        
        <div className="flex-1" />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <UserCog className="h-4 w-4 mr-2" />
              Bulk Actions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setStatusDialogOpen(true)}>
              Change Status
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRoleDialogOpen(true)}>
              Change Role
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export to CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          Clear
        </Button>
      </div>

      {/* Status Change Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Status</DialogTitle>
            <DialogDescription>
              Update the status for {selectedStaff.length} selected staff member{selectedStaff.length > 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Status</Label>
              <Select value={newStatus} onValueChange={(v: 'active' | 'inactive') => setNewStatus(v)}>
                <SelectTrigger className="bg-secondary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkStatusChange} disabled={isUpdating}>
              {isUpdating ? 'Updating...' : 'Update Status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Update the role for {selectedStaff.length} selected staff member{selectedStaff.length > 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Role</Label>
              <Select 
                value={newRole} 
                onValueChange={(v: 'photographer' | 'videographer' | 'assistant') => setNewRole(v)}
              >
                <SelectTrigger className="bg-secondary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="photographer">Photographer</SelectItem>
                  <SelectItem value="videographer">Videographer</SelectItem>
                  <SelectItem value="assistant">Assistant</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkRoleChange} disabled={isUpdating}>
              {isUpdating ? 'Updating...' : 'Update Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
