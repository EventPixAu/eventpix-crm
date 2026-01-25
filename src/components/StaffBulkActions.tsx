import { useState } from 'react';
import { Download, MapPin, UserCog, Users } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
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
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<'active' | 'inactive'>('active');
  const [newRole, setNewRole] = useState<'photographer' | 'videographer' | 'assistant'>('photographer');
  const [newLocation, setNewLocation] = useState('');
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

      toast({ title: `Updated status for ${selectedStaff.length} team members` });
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

      toast({ title: `Updated role for ${selectedStaff.length} team members` });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setRoleDialogOpen(false);
      onClearSelection();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Failed to update role', description: error.message });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBulkLocationChange = async () => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('staff')
        .update({ location: newLocation || null })
        .in('id', selectedStaff.map(s => s.id));

      if (error) throw error;

      toast({ title: `Updated location for ${selectedStaff.length} team members` });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setLocationDialogOpen(false);
      setNewLocation('');
      onClearSelection();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Failed to update location', description: error.message });
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
    
    toast({ title: `Exported ${selectedStaff.length} team members to CSV` });
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
            <DropdownMenuItem onClick={() => setLocationDialogOpen(true)}>
              <MapPin className="h-4 w-4 mr-2" />
              Change Location
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
              Update the status for {selectedStaff.length} selected team member{selectedStaff.length > 1 ? 's' : ''}.
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
              Update the role for {selectedStaff.length} selected team member{selectedStaff.length > 1 ? 's' : ''}.
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

      {/* Location Change Dialog */}
      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Location</DialogTitle>
            <DialogDescription>
              Update the location for {selectedStaff.length} selected team member{selectedStaff.length > 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Location</Label>
              <Input
                placeholder="e.g. Sydney, Melbourne, Brisbane"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                className="bg-secondary"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to clear the location for selected members.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setLocationDialogOpen(false); setNewLocation(''); }}>
              Cancel
            </Button>
            <Button onClick={handleBulkLocationChange} disabled={isUpdating}>
              {isUpdating ? 'Updating...' : 'Update Location'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
