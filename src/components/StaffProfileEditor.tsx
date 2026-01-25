import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useStaffRoles } from '@/hooks/useStaff';
import { toast } from 'sonner';

interface StaffProfile {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  home_city: string | null;
  home_state: string | null;
  status: string | null;
  seniority: string | null;
  travel_ready: boolean | null;
  preferred_start_time: string | null;
  preferred_end_time: string | null;
  notes_internal: string | null;
  default_role_id?: string | null;
  vehicle_registration?: string | null;
  dietary_requirements?: string | null;
  assigned_equipment_notes?: string | null;
  location?: string | null;
  location_state?: string | null;
  location_postcode?: string | null;
}

interface StaffProfileEditorProps {
  profile: StaffProfile;
  sourceTable?: 'profiles' | 'staff';
  staffId?: string;
}

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
const SENIORITY_LEVELS = ['junior', 'mid', 'senior', 'lead'];
const STATUS_OPTIONS = ['active', 'inactive', 'on_leave'];

export function StaffProfileEditor({ profile, sourceTable = 'profiles', staffId }: StaffProfileEditorProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    full_name: profile.full_name || '',
    phone: profile.phone || '',
    home_city: profile.home_city || '',
    home_state: profile.home_state || '',
    status: profile.status || 'active',
    seniority: profile.seniority || 'mid',
    travel_ready: profile.travel_ready ?? false,
    preferred_start_time: profile.preferred_start_time || '',
    preferred_end_time: profile.preferred_end_time || '',
    notes_internal: profile.notes_internal || '',
    default_role_id: profile.default_role_id || '',
    vehicle_registration: profile.vehicle_registration || '',
    dietary_requirements: profile.dietary_requirements || '',
    assigned_equipment_notes: profile.assigned_equipment_notes || '',
    location: profile.location || '',
    location_state: profile.location_state || '',
    location_postcode: profile.location_postcode || '',
  });

  const queryClient = useQueryClient();
  const { data: roles = [] } = useStaffRoles();

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (sourceTable === 'staff' && staffId) {
        // Update staff table for members without linked accounts
        const { error } = await supabase
          .from('staff')
          .update({
            name: data.full_name || null,
            phone: data.phone || null,
            status: data.status === 'active' ? 'active' : 'inactive',
            notes: data.notes_internal || null,
            location: data.location || null,
          })
          .eq('id', staffId);

        if (error) throw error;
      } else {
        // Update profiles table for members with linked accounts
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: data.full_name || null,
            phone: data.phone || null,
            home_city: data.home_city || null,
            home_state: data.home_state || null,
            status: data.status,
            seniority: data.seniority,
            travel_ready: data.travel_ready,
            preferred_start_time: data.preferred_start_time || null,
            preferred_end_time: data.preferred_end_time || null,
            notes_internal: data.notes_internal || null,
            default_role_id: data.default_role_id || null,
            vehicle_registration: data.vehicle_registration || null,
            dietary_requirements: data.dietary_requirements || null,
            assigned_equipment_notes: data.assigned_equipment_notes || null,
            location: data.location || null,
            location_state: data.location_state || null,
            location_postcode: data.location_postcode || null,
          })
          .eq('id', profile.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Profile updated successfully');
      queryClient.invalidateQueries({ queryKey: ['staff-profile', profile.id] });
      if (staffId) {
        queryClient.invalidateQueries({ queryKey: ['staff-profile', staffId] });
        queryClient.invalidateQueries({ queryKey: ['staff'] });
      }
      queryClient.invalidateQueries({ queryKey: ['staff-profiles'] });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update profile');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      // Reset form data when opening
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        home_city: profile.home_city || '',
        home_state: profile.home_state || '',
        status: profile.status || 'active',
        seniority: profile.seniority || 'mid',
        travel_ready: profile.travel_ready ?? false,
        preferred_start_time: profile.preferred_start_time || '',
        preferred_end_time: profile.preferred_end_time || '',
        notes_internal: profile.notes_internal || '',
        default_role_id: profile.default_role_id || '',
        vehicle_registration: profile.vehicle_registration || '',
        dietary_requirements: profile.dietary_requirements || '',
        assigned_equipment_notes: profile.assigned_equipment_notes || '',
        location: profile.location || '',
        location_state: profile.location_state || '',
        location_postcode: profile.location_postcode || '',
      });
    }
    setOpen(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4 mr-2" />
          Edit Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Staff Profile</DialogTitle>
          <DialogDescription>
            Update profile information for {profile.full_name || profile.email}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {sourceTable === 'staff' && (
            <div className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-md">
              This team member does not have a linked user account. Some fields are not available until they create an account.
            </div>
          )}
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Enter full name"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Enter phone number"
              />
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g. Sydney, Melbourne"
            />
          </div>

          {/* Home City & State - profiles only */}
          {sourceTable !== 'staff' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="home_city">City</Label>
                <Input
                  id="home_city"
                  value={formData.home_city}
                  onChange={(e) => setFormData({ ...formData, home_city: e.target.value })}
                  placeholder="e.g. Sydney"
                />
              </div>
              <div>
                <Label htmlFor="home_state">State</Label>
                <Select
                  value={formData.home_state}
                  onValueChange={(value) => setFormData({ ...formData, home_state: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATES.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Role & Status */}
          <div className="grid grid-cols-2 gap-4">
            {sourceTable !== 'staff' && (
              <div>
                <Label htmlFor="default_role_id">Default Role</Label>
                <Select
                  value={formData.default_role_id}
                  onValueChange={(value) => setFormData({ ...formData, default_role_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className={sourceTable === 'staff' ? 'col-span-2' : ''}>
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {(sourceTable === 'staff' ? ['active', 'inactive'] : STATUS_OPTIONS).map((status) => (
                    <SelectItem key={status} value={status}>
                      <span className="capitalize">{status.replace('_', ' ')}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Seniority & Travel - profiles only */}
          {sourceTable !== 'staff' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="seniority">Seniority</Label>
                <Select
                  value={formData.seniority}
                  onValueChange={(value) => setFormData({ ...formData, seniority: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select seniority" />
                  </SelectTrigger>
                  <SelectContent>
                    {SENIORITY_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        <span className="capitalize">{level}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between pt-6">
                <Label htmlFor="travel_ready" className="cursor-pointer">
                  Travel Ready
                </Label>
                <Switch
                  id="travel_ready"
                  checked={formData.travel_ready}
                  onCheckedChange={(checked) => setFormData({ ...formData, travel_ready: checked })}
                />
              </div>
            </div>
          )}

          {/* Preferred Hours - profiles only */}
          {sourceTable !== 'staff' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="preferred_start_time">Preferred Start Time</Label>
                <Input
                  id="preferred_start_time"
                  type="time"
                  value={formData.preferred_start_time}
                  onChange={(e) => setFormData({ ...formData, preferred_start_time: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="preferred_end_time">Preferred End Time</Label>
                <Input
                  id="preferred_end_time"
                  type="time"
                  value={formData.preferred_end_time}
                  onChange={(e) => setFormData({ ...formData, preferred_end_time: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Operational Details - profiles only */}
          {sourceTable !== 'staff' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="vehicle_registration">Vehicle Registration</Label>
                <Input
                  id="vehicle_registration"
                  value={formData.vehicle_registration}
                  onChange={(e) => setFormData({ ...formData, vehicle_registration: e.target.value })}
                  placeholder="e.g. ABC123"
                />
              </div>
              <div>
                <Label htmlFor="dietary_requirements">Dietary Requirements</Label>
                <Input
                  id="dietary_requirements"
                  value={formData.dietary_requirements}
                  onChange={(e) => setFormData({ ...formData, dietary_requirements: e.target.value })}
                  placeholder="e.g. Vegetarian"
                />
              </div>
            </div>
          )}

          {/* Equipment Notes - profiles only */}
          {sourceTable !== 'staff' && (
            <div>
              <Label htmlFor="assigned_equipment_notes">Assigned Equipment Notes</Label>
              <Textarea
                id="assigned_equipment_notes"
                value={formData.assigned_equipment_notes}
                onChange={(e) => setFormData({ ...formData, assigned_equipment_notes: e.target.value })}
                placeholder="Notes about assigned equipment..."
                rows={2}
              />
            </div>
          )}

          {/* Internal Notes */}
          <div>
            <Label htmlFor="notes_internal">Internal Notes</Label>
            <Textarea
              id="notes_internal"
              value={formData.notes_internal}
              onChange={(e) => setFormData({ ...formData, notes_internal: e.target.value })}
              placeholder="Internal notes about this team member..."
              rows={3}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={updateMutation.isPending}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}